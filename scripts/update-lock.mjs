#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const org = 'mts241alikhlash'
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const manifestDir = path.join(root, 'gateway', 'manifests')
const GATEWAY_TAG_SUFFIX = { staging: '-staging', production: '' }
const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ')

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

export function latestVersion(tags, prefix) {
  let best = null
  for (const tag of tags) {
    if (!tag.startsWith(`${prefix}@`)) continue
    const version = tag.slice(prefix.length + 1)
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue
    if (!best || compareVersions(version, best) > 0) best = version
  }
  return best
}

export function manifestFileName(app, version) {
  return `${app}-${version}.json`
}

export function referencedManifests(locks) {
  const names = new Set()
  for (const lock of locks) {
    for (const [app, pin] of Object.entries(lock.apps)) {
      names.add(manifestFileName(app, pin.routesVersion))
    }
  }
  return names
}

function remoteTags(repo) {
  return execFileSync('git', ['ls-remote', '--tags', '--refs', `https://github.com/${org}/${repo}.git`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[1].replace('refs/tags/', ''))
}

async function imageDigest(name, tag) {
  const auth = await fetch(`https://ghcr.io/token?scope=repository:${org}/${name}:pull`)
  if (!auth.ok) throw new Error(`ghcr token for ${name}: ${auth.status}`)
  const { token } = await auth.json()
  const res = await fetch(`https://ghcr.io/v2/${org}/${name}/manifests/${tag}`, {
    method: 'HEAD',
    headers: { Authorization: `Bearer ${token}`, Accept: MANIFEST_ACCEPT },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${name}:${tag} -> ${res.status}`)
  return res.headers.get('docker-content-digest')
}

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function fetchManifest(app, version) {
  const tag = encodeURIComponent(`${app}-web@${version}`)
  const base = `https://github.com/${org}/${app}-web/releases/download/${tag}/${app}-web-routes-${version}.json`
  const raw = await download(base)
  const expected = (await download(`${base}.sha256`)).toString('utf8').trim().replace(/^sha256:/, '').split(/\s+/)[0]
  const actual = createHash('sha256').update(raw).digest('hex')
  if (actual !== expected) throw new Error(`${app} ${version}: manifest checksum mismatch`)
  return { raw, sha256: actual }
}

function readLock(env) {
  return JSON.parse(readFileSync(path.join(root, 'deployment', `${env}.lock.json`), 'utf8'))
}

function image(name, digest) {
  return `ghcr.io/${org}/${name}@${digest}`
}

async function updateStaging(lock, changes) {
  const webTags = {}
  for (const app of Object.keys(lock.apps)) webTags[app] = remoteTags(`${app}-web`)
  const serviceTags = remoteTags('services')

  for (const [app, pin] of Object.entries(lock.apps)) {
    const version = latestVersion(webTags[app], `${app}-web`)
    if (!version || version === pin.webVersion) continue
    const digest = await imageDigest(`${app}-web`, version)
    if (!digest) continue
    const { raw, sha256 } = await fetchManifest(app, version)
    writeFileSync(path.join(manifestDir, manifestFileName(app, version)), raw)
    Object.assign(pin, {
      webVersion: version,
      webImage: image(`${app}-web`, digest),
      routesVersion: version,
      routesSha256: sha256,
    })
    changes.push(`${app}-web ${version}`)
  }

  for (const [service, pin] of Object.entries(lock.services)) {
    const version = latestVersion(serviceTags, `${service}-service`)
    if (!version || version === pin.version) continue
    const digest = await imageDigest(`${service}-service`, version)
    if (!digest) continue
    Object.assign(pin, { version, image: image(`${service}-service`, digest) })
    changes.push(`${service}-service ${version}`)
  }
}

function promote(lock, staging, changes) {
  for (const [app, pin] of Object.entries(lock.apps)) {
    const from = staging.apps[app]
    if (pin.webImage === from.webImage && pin.routesSha256 === from.routesSha256) continue
    for (const key of ['webVersion', 'webImage', 'routesVersion', 'routesSha256']) pin[key] = from[key]
    changes.push(`${app}-web ${from.webVersion}`)
  }
  for (const [service, pin] of Object.entries(lock.services)) {
    const from = staging.services[service]
    if (pin.image === from.image) continue
    Object.assign(pin, { version: from.version, image: from.image })
    changes.push(`${service}-service ${from.version}`)
  }
}

async function updateGateway(lock, env, changes) {
  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  const tag = `${version}${GATEWAY_TAG_SUFFIX[env]}`
  const digest = await imageDigest('platform-gateway', tag)
  if (!digest) return
  const pinned = image('platform-gateway', digest)
  if (lock.gatewayImage === pinned) return
  lock.gatewayImage = pinned
  changes.push(`platform-gateway ${tag}`)
}

function writeCompose(env, lock) {
  const file = path.join(root, 'compose', `docker-compose.${env}.yml`)
  const images = [
    lock.gatewayImage,
    ...Object.values(lock.apps).map((pin) => pin.webImage),
    ...Object.values(lock.services).map((pin) => pin.image),
  ]
  let compose = readFileSync(file, 'utf8')
  for (const pinned of images) {
    const name = pinned.slice(0, pinned.indexOf('@'))
    compose = compose.replace(new RegExp(`${name.replaceAll('.', '\\.')}@sha256:[a-f0-9]{64}`, 'g'), pinned)
  }
  writeFileSync(file, compose)
}

function pruneManifests() {
  const keep = referencedManifests([readLock('staging'), readLock('production')])
  for (const name of readdirSync(manifestDir)) {
    if (name.endsWith('.json') && !keep.has(name)) unlinkSync(path.join(manifestDir, name))
  }
}

async function main() {
  const env = process.argv[2]
  if (env !== 'staging' && env !== 'production') {
    console.error('usage: node scripts/update-lock.mjs staging|production')
    process.exit(2)
  }
  const lock = readLock(env)
  const changes = []
  if (env === 'staging') await updateStaging(lock, changes)
  else promote(lock, readLock('staging'), changes)
  await updateGateway(lock, env, changes)
  if (changes.length === 0) {
    console.log('no changes')
    return
  }
  writeFileSync(path.join(root, 'deployment', `${env}.lock.json`), `${JSON.stringify(lock, null, 2)}\n`)
  writeCompose(env, lock)
  pruneManifests()
  for (const change of changes) console.log(change)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()

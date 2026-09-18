#!/usr/bin/env node
// Reports (and optionally pins) the latest published digest of every
// component this platform deploys. Each of the 16 services/apps plus the
// gateway versions independently — there is no single "platform version" —
// so this replaces checking 17 GitHub Packages pages by hand.
//
// Usage:
//   GITHUB_TOKEN=... node scripts/latest-digests.mjs
//   GITHUB_TOKEN=... node scripts/latest-digests.mjs --write production

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const org = 'mts241alikhlash'

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
if (!token) {
  console.error('Set GITHUB_TOKEN (a PAT with read:packages) first.')
  process.exit(1)
}

const APPS = [
  'academic-web', 'admin-web', 'admission-web', 'assessment-web',
  'hr-web', 'inventory-web', 'portal-web',
]
const SERVICES = [
  'identity-service', 'academic-service', 'inventory-service',
  'presence-service', 'portal-service', 'admission-service',
  'hr-service', 'student-service', 'assessment-service',
]
const COMPONENTS = [...APPS, ...SERVICES]

const GATEWAY_TAG_SUFFIX = { staging: '', production: '-production' }

async function gh(apiPath) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) {
    throw new Error(`${apiPath} -> ${res.status} ${await res.text()}`)
  }
  return res.json()
}

function isSemver(tag, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\d+\\.\\d+\\.\\d+${escaped}$`).test(tag)
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

async function latestFor(name, suffix = '') {
  const versions = await gh(
    `/orgs/${org}/packages/container/${name}/versions?per_page=100`,
  )
  let best = null
  for (const v of versions) {
    for (const tag of v.metadata?.container?.tags ?? []) {
      if (!isSemver(tag, suffix)) continue
      const bareVersion = suffix ? tag.slice(0, -suffix.length) : tag
      if (!best || compareSemver(bareVersion, best.version) > 0) {
        best = { version: bareVersion, digest: v.name }
      }
    }
  }
  return best
}

const results = {}
for (const name of COMPONENTS) {
  try {
    results[name] = await latestFor(name)
  } catch (err) {
    results[name] = null
    console.error(`  ! ${name}: ${err.message}`)
  }
}
const gatewayResults = {}
for (const [env, suffix] of Object.entries(GATEWAY_TAG_SUFFIX)) {
  try {
    gatewayResults[env] = await latestFor('platform-gateway', suffix)
  } catch (err) {
    gatewayResults[env] = null
    console.error(`  ! platform-gateway (${env}): ${err.message}`)
  }
}

const rows = [
  ...COMPONENTS.map((name) => {
    const r = results[name]
    return { name, version: r?.version ?? '(none published)', digest: r?.digest ?? '' }
  }),
  ...Object.entries(gatewayResults).map(([env, r]) => ({
    name: `platform-gateway (${env})`,
    version: r?.version ?? '(none published)',
    digest: r?.digest ?? '',
  })),
]
const nameWidth = Math.max(...rows.map((r) => r.name.length))
console.log()
for (const r of rows) {
  console.log(`  ${r.name.padEnd(nameWidth)}  ${r.version.padEnd(10)}  ${r.digest}`)
}
console.log()

const missing = [
  ...COMPONENTS.filter((name) => !results[name]),
  ...Object.entries(gatewayResults)
    .filter(([, r]) => !r)
    .map(([env]) => `platform-gateway (${env})`),
]
if (missing.length) {
  console.error(`Missing a published image for: ${missing.join(', ')}`)
}

const envArgIndex = process.argv.indexOf('--write')
if (envArgIndex === -1) {
  if (missing.length) process.exit(1)
  process.exit(0)
}
const env = process.argv[envArgIndex + 1]
if (env !== 'production' && env !== 'staging') {
  console.error('Usage: --write production|staging')
  process.exit(1)
}
if (missing.length) {
  console.error('Refusing to write a lock file with missing images above.')
  process.exit(1)
}

// --- deployment/<env>.lock.json ---
const lockPath = path.join(root, 'deployment', `${env}.lock.json`)
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
lock.gatewayImage = `ghcr.io/${org}/platform-gateway@sha256:${gatewayResults[env].digest.replace('sha256:', '')}`
for (const key of Object.keys(lock.apps)) {
  const r = results[`${key}-web`]
  lock.apps[key].webVersion = r.version
  lock.apps[key].webImage = `ghcr.io/${org}/${key}-web@sha256:${r.digest.replace('sha256:', '')}`
}
for (const key of Object.keys(lock.services)) {
  const r = results[`${key}-service`]
  lock.services[key].version = r.version
  lock.services[key].image = `ghcr.io/${org}/${key}-service@sha256:${r.digest.replace('sha256:', '')}`
}
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
console.log(`wrote ${path.relative(root, lockPath)}`)

// --- compose/docker-compose.<env>.yml ---
const composePath = path.join(root, 'compose', `docker-compose.${env}.yml`)
let compose = readFileSync(composePath, 'utf8')
for (const [name, r] of [...COMPONENTS.map((n) => [n, results[n]]), ['platform-gateway', gatewayResults[env]]]) {
  const digest = r.digest.replace('sha256:', '')
  compose = compose.replaceAll(
    new RegExp(`ghcr\\.io/${org}/${name}@sha256:\\S+`, 'g'),
    `ghcr.io/${org}/${name}@sha256:${digest}`,
  )
}
writeFileSync(composePath, compose)
console.log(`wrote ${path.relative(root, composePath)}`)

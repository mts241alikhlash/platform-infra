#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PREFIX_RE = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
const HOST_RE = /^(?:_|[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?)$/
const ROOT_RE = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/
const CHECKSUM_RE = /^[a-f0-9]{64}$/
const PINNED_IMAGE_RE = /^ghcr\.io\/[^/]+\/[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$/
const PLACEHOLDER_IMAGE_RE =
  /^ghcr\.io\/[^/]+\/[A-Za-z0-9._/-]+@sha256:REPLACE_BEFORE_DEPLOYMENT$/
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

export const EXPECTED_APPS = [
  'academic',
  'admission',
  'admin',
  'assessment',
  'hr',
  'inventory',
  'portal',
]

const TARGETS = [
  { file: path.join(here, 'nginx.conf'), ssl: false },
  { file: path.join(here, 'nginx.ssl.conf'), ssl: true },
]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown property "${key}"`)
  }
}

function assertUnique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} contains duplicate item "${value}"`)
    seen.add(value)
  }
}

function assertPrefix(value, label) {
  if (typeof value !== 'string' || !PREFIX_RE.test(value)) {
    throw new Error(`${label} must be a lowercase URL prefix`)
  }
}

function assertHost(value, label) {
  if (typeof value !== 'string' || !HOST_RE.test(value)) {
    throw new Error(`${label} must be a valid gateway host name`)
  }
}

function assertVersion(value, label) {
  if (typeof value !== 'string' || !VERSION_RE.test(value)) {
    throw new Error(`${label} must be a semantic version`)
  }
}

function assertChecksum(value, label) {
  if (typeof value !== 'string' || !CHECKSUM_RE.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 checksum`)
  }
}

function assertImage(value, label, requirePinned) {
  if (typeof value !== 'string') throw new Error(`${label} must be an image reference`)
  if (PINNED_IMAGE_RE.test(value)) return
  if (!requirePinned && PLACEHOLDER_IMAGE_RE.test(value)) return
  throw new Error(
    `${label} must be pinned by sha256 digest before deployment`,
  )
}

function assertMatching(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} does not match upstream registry`)
  }
}

export function validateManifest(manifest, schema = null) {
  if (!isRecord(manifest)) throw new Error('manifest must be a JSON object')

  assertOnlyKeys(
    manifest,
    new Set([
      'schemaVersion',
      'app',
      'webVersion',
      'servicePrefixes',
      'unroutedPrefixes',
      'healthRoutes',
    ]),
    'manifest',
  )

  if (manifest.schemaVersion !== 1) throw new Error('schemaVersion must be 1')

  const allowedApps = schema?.properties?.app?.enum ?? EXPECTED_APPS
  if (!allowedApps.includes(manifest.app)) {
    throw new Error(`manifest app "${manifest.app}" is not supported`)
  }
  assertVersion(manifest.webVersion, 'webVersion')

  if (!isRecord(manifest.servicePrefixes)) {
    throw new Error('servicePrefixes must be an object')
  }
  for (const [service, prefixes] of Object.entries(manifest.servicePrefixes)) {
    if (!/^[a-z][a-z0-9-]*$/.test(service)) {
      throw new Error(`invalid service name "${service}"`)
    }
    if (!Array.isArray(prefixes)) {
      throw new Error(`servicePrefixes.${service} must be an array`)
    }
    assertUnique(prefixes, `servicePrefixes.${service}`)
    prefixes.forEach((prefix, index) =>
      assertPrefix(prefix, `servicePrefixes.${service}[${index}]`),
    )
  }

  if (!Array.isArray(manifest.unroutedPrefixes)) {
    throw new Error('unroutedPrefixes must be an array')
  }
  assertUnique(manifest.unroutedPrefixes, 'unroutedPrefixes')
  manifest.unroutedPrefixes.forEach((prefix, index) =>
    assertPrefix(prefix, `unroutedPrefixes[${index}]`),
  )

  if (!Array.isArray(manifest.healthRoutes)) {
    throw new Error('healthRoutes must be an array')
  }
  for (const [index, route] of manifest.healthRoutes.entries()) {
    if (!isRecord(route)) throw new Error(`healthRoutes[${index}] must be an object`)
  }
  assertUnique(
    manifest.healthRoutes.map((route) => route.path),
    'healthRoutes paths',
  )
  for (const [index, route] of manifest.healthRoutes.entries()) {
    if (!isRecord(route)) throw new Error(`healthRoutes[${index}] must be an object`)
    assertOnlyKeys(route, new Set(['path', 'service']), `healthRoutes[${index}]`)
    assertPrefix(route.path, `healthRoutes[${index}].path`)
    if (typeof route.service !== 'string' || !/^[a-z][a-z0-9-]*$/.test(route.service)) {
      throw new Error(`healthRoutes[${index}].service must be a service name`)
    }
  }

  return manifest
}

export function validateUpstreams(upstreams) {
  if (!isRecord(upstreams)) throw new Error('upstreams must be a JSON object')

  for (const [service, upstream] of Object.entries(upstreams)) {
    if (!/^[a-z][a-z0-9-]*$/.test(service)) {
      throw new Error(`invalid upstream service name "${service}"`)
    }
    if (!isRecord(upstream)) throw new Error(`upstreams.${service} must be an object`)
    assertOnlyKeys(
      upstream,
      new Set(['host', 'port', 'healthPath']),
      `upstreams.${service}`,
    )
    if (
      typeof upstream.host !== 'string' ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(upstream.host)
    ) {
      throw new Error(`upstreams.${service}.host must be a DNS service name`)
    }
    if (!Number.isInteger(upstream.port) || upstream.port < 1 || upstream.port > 65535) {
      throw new Error(`upstreams.${service}.port must be a valid TCP port`)
    }
    assertPrefix(upstream.healthPath, `upstreams.${service}.healthPath`)
  }

  return upstreams
}

export function validateDeploymentLock(
  lock,
  {
    environment = null,
    expectedApps = null,
    upstreams = null,
    requirePinnedImages = false,
  } = {},
) {
  if (!isRecord(lock)) throw new Error('deployment lock must be a JSON object')
  assertOnlyKeys(
    lock,
    new Set(['schemaVersion', 'environment', 'gatewayImage', 'apps', 'services']),
    'deployment lock',
  )
  if (lock.schemaVersion !== 1) throw new Error('unsupported deployment lock schema')
  if (!['staging', 'production'].includes(lock.environment)) {
    throw new Error('invalid deployment environment')
  }
  if (environment !== null && lock.environment !== environment) {
    throw new Error(`deployment lock environment must be ${environment}`)
  }
  assertImage(lock.gatewayImage, 'gateway image', requirePinnedImages)

  if (!isRecord(lock.apps)) throw new Error('deployment lock apps must be an object')
  const appNames = Object.keys(lock.apps).sort()
  if (expectedApps) {
    const expected = [...expectedApps].sort()
    if (JSON.stringify(appNames) !== JSON.stringify(expected)) {
      throw new Error('deployment lock apps do not match expected applications')
    }
  }
  for (const app of appNames) {
    const entry = lock.apps[app]
    if (!isRecord(entry)) throw new Error(`deployment apps.${app} must be an object`)
    assertOnlyKeys(
      entry,
      new Set([
        'host',
        'sslHost',
        'root',
        'webVersion',
        'webImage',
        'routesVersion',
        'routesSha256',
      ]),
      `deployment apps.${app}`,
    )
    assertHost(entry.host, `deployment apps.${app}.host`)
    assertHost(entry.sslHost, `deployment apps.${app}.sslHost`)
    if (typeof entry.root !== 'string' || !ROOT_RE.test(entry.root)) {
      throw new Error(`deployment apps.${app}.root must be an absolute path`)
    }
    assertVersion(entry.webVersion, `deployment apps.${app}.webVersion`)
    assertImage(entry.webImage, `deployment apps.${app}.webImage`, requirePinnedImages)
    assertVersion(entry.routesVersion, `deployment apps.${app}.routesVersion`)
    assertChecksum(entry.routesSha256, `deployment apps.${app}.routesSha256`)
    if (entry.webVersion !== entry.routesVersion) {
      throw new Error(`deployment apps.${app} web and route versions must match`)
    }
  }

  if (!isRecord(lock.services)) throw new Error('deployment lock services must be an object')
  const serviceNames = Object.keys(lock.services).sort()
  if (upstreams) {
    const expected = Object.keys(upstreams).sort()
    if (JSON.stringify(serviceNames) !== JSON.stringify(expected)) {
      throw new Error('deployment lock services do not match upstream registry')
    }
  }
  for (const service of serviceNames) {
    if (!/^[a-z][a-z0-9-]*$/.test(service)) {
      throw new Error(`invalid deployment service name "${service}"`)
    }
    const entry = lock.services[service]
    if (!isRecord(entry)) throw new Error(`deployment services.${service} must be an object`)
    assertOnlyKeys(
      entry,
      new Set(['version', 'image', 'upstream', 'healthPath']),
      `deployment services.${service}`,
    )
    assertVersion(entry.version, `deployment services.${service}.version`)
    assertImage(entry.image, `deployment services.${service}.image`, requirePinnedImages)
    const upstreamParts =
      typeof entry.upstream === 'string' ? entry.upstream.split(':') : []
    if (
      upstreamParts.length !== 2 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(upstreamParts[0]) ||
      !/^\d+$/.test(upstreamParts[1]) ||
      Number(upstreamParts[1]) < 1 ||
      Number(upstreamParts[1]) > 65535
    ) {
      throw new Error(`deployment services.${service}.upstream must be host:port`)
    }
    assertPrefix(entry.healthPath, `deployment services.${service}.healthPath`)
    if (upstreams?.[service]) {
      const upstream = upstreams[service]
      assertMatching(
        entry.upstream,
        `${upstream.host}:${upstream.port}`,
        `deployment services.${service}.upstream`,
      )
      assertMatching(
        entry.healthPath,
        upstream.healthPath,
        `deployment services.${service}.healthPath`,
      )
    }
  }

  return lock
}

function prefixesOverlap(left, right) {
  return (
    left === right ||
    (left.startsWith(`${right}/`)) ||
    (right.startsWith(`${left}/`))
  )
}

function assertNoOverlaps(app, routes) {
  // ponytail: O(n^2) scan; use a prefix trie only if release manifests grow materially.
  const ordered = [...routes].sort(
    (left, right) => compare(left.path, right.path) || compare(left.kind, right.kind),
  )
  for (let index = 0; index < ordered.length; index += 1) {
    for (let next = index + 1; next < ordered.length; next += 1) {
      if (!prefixesOverlap(ordered[index].path, ordered[next].path)) continue
      if (ordered[index].path === ordered[next].path) {
        throw new Error(`${app}: duplicate prefix "${ordered[index].path}"`)
      }
      throw new Error(
        `${app}: overlapping prefix "${ordered[index].path}" and "${ordered[next].path}"`,
      )
    }
  }
}

export function validateModel({
  manifests,
  upstreams,
  deployments = null,
  lock = null,
  artifacts = null,
}) {
  if (!Array.isArray(manifests) || !isRecord(upstreams)) {
    throw new Error('gateway model is incomplete')
  }

  const appNames = new Set()
  const serverNames = new Set()
  const sslServerNames = new Set()

  for (const manifest of manifests) {
    validateManifest(manifest)
    if (appNames.has(manifest.app)) throw new Error(`duplicate manifest for "${manifest.app}"`)
    appNames.add(manifest.app)

    const lockedDeployment = lock?.apps?.[manifest.app]
    const deployment = deployments?.[manifest.app] ??
      (lockedDeployment && {
        serverName: lockedDeployment.host,
        sslServerName: lockedDeployment.sslHost,
        root: lockedDeployment.root,
      })
    if (deployment && serverNames.has(deployment.serverName)) {
      throw new Error(`duplicate gateway server name "${deployment.serverName}"`)
    }
    if (deployment) serverNames.add(deployment.serverName)
    if (deployment && sslServerNames.has(deployment.sslServerName)) {
      throw new Error(`duplicate TLS server name "${deployment.sslServerName}"`)
    }
    if (deployment) {
      assertHost(deployment.serverName, `${manifest.app}.deployment.serverName`)
      assertHost(deployment.sslServerName, `${manifest.app}.deployment.sslServerName`)
      if (typeof deployment.root !== 'string' || !ROOT_RE.test(deployment.root)) {
        throw new Error(`${manifest.app}.deployment.root must be an absolute path`)
      }
      sslServerNames.add(deployment.sslServerName)
    }

    const routes = []
    for (const [service, prefixes] of Object.entries(manifest.servicePrefixes)) {
      if (!upstreams[service]) {
        throw new Error(`${manifest.app}: no upstream declared for "${service}"`)
      }
      routes.push(...prefixes.map((path) => ({ path, kind: 'routed' })))
    }
    routes.push(...manifest.unroutedPrefixes.map((path) => ({ path, kind: 'unrouted' })))
    for (const route of manifest.healthRoutes) {
      if (!upstreams[route.service]) {
        throw new Error(`${manifest.app}: no upstream declared for "${route.service}"`)
      }
      routes.push({ path: route.path, kind: 'health' })
    }
    assertNoOverlaps(manifest.app, routes)
  }

  if (lock && artifacts) {
    for (const artifact of artifacts) {
      const pin = lock.apps?.[artifact.manifest.app]
      if (!pin || pin.routesVersion !== artifact.manifest.webVersion) {
        throw new Error(`${artifact.manifest.app}: deployment lock manifest version mismatch`)
      }
      if (pin.routesSha256 !== artifact.checksum) {
        throw new Error(`${artifact.manifest.app}: manifest checksum mismatch`)
      }
    }
  }

  return true
}

async function readJson(file, label) {
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error.message}`)
  }
  try {
    return { value: JSON.parse(raw), raw }
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`)
  }
}

function sha256(raw) {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export async function loadInputs({
  rootDir = path.resolve(here, '..'),
  environment = 'staging',
  requirePinnedImages = environment === 'production',
} = {}) {
  const root = path.resolve(rootDir)
  const schemaFile = path.join(root, 'gateway', 'schema', 'routing-manifest.schema.json')
  const upstreamFile = path.join(root, 'upstreams', 'services.json')
  const lockFile = path.join(root, 'deployment', `${environment}.lock.json`)
  const manifestDir = path.join(root, 'gateway', 'manifests')

  const { value: schema } = await readJson(schemaFile, 'routing manifest schema')
  const { value: upstreams } = await readJson(upstreamFile, 'upstream registry')
  validateUpstreams(upstreams)
  const { value: lock } = await readJson(lockFile, `${environment} deployment lock`)
  validateDeploymentLock(lock, {
    environment,
    expectedApps: EXPECTED_APPS,
    upstreams,
    requirePinnedImages,
  })

  let files
  try {
    files = await readdir(manifestDir, { withFileTypes: true })
  } catch (error) {
    throw new Error(`routing manifest directory cannot be read: ${error.message}`)
  }
  const manifestFiles = files
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
  if (manifestFiles.length === 0) throw new Error('no routing manifests found')

  const artifacts = []
  const versions = new Set()
  for (const fileName of manifestFiles) {
    const file = path.join(manifestDir, fileName)
    const { value: manifest, raw } = await readJson(file, `routing manifest ${fileName}`)
    validateManifest(manifest, schema)
    validateModel({ manifests: [manifest], upstreams, lock })
    const key = `${manifest.app}@${manifest.webVersion}`
    if (versions.has(key)) throw new Error(`duplicate routing manifest ${key}`)
    versions.add(key)
    artifacts.push({ manifest, fileName, checksum: sha256(raw) })
  }

  const selected = EXPECTED_APPS.map((app) => {
    const pin = lock.apps[app]
    const artifact = artifacts.find(
      ({ manifest }) => manifest.app === app && manifest.webVersion === pin.routesVersion,
    )
    if (!artifact) throw new Error(`${app}: locked routing manifest is missing`)
    if (artifact.checksum !== pin.routesSha256) {
      throw new Error(`${app}: manifest checksum mismatch`)
    }
    return artifact
  })

  const manifests = selected.map(({ manifest }) => manifest)
  const deployments = Object.fromEntries(
    EXPECTED_APPS.map((app) => [
      app,
      {
        serverName: lock.apps[app].host,
        sslServerName: lock.apps[app].sslHost,
        root: lock.apps[app].root,
      },
    ]),
  )
  validateModel({ manifests, upstreams, lock, artifacts: selected, deployments })
  return {
    environment,
    schema,
    upstreams,
    lock,
    manifests,
    deployments,
    artifacts: selected,
  }
}

function regexGroup(prefixes) {
  return prefixes
    .map((prefix) => prefix.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
}

function banner(label) {
  return `    # ${'-'.repeat(Math.max(1, 64 - label.length))} ${label}`
}

function upstreamName(service) {
  return `${service}_service`
}

function webUpstreamName(app) {
  return `${app}_web`
}

function webServiceName(app) {
  return `${app}-web`
}

function proxyBlock({ service, prefixes }, upstreams, ssl) {
  const sortedPrefixes = [...prefixes].sort()
  const upstream = upstreamName(service)
  return `${banner(service)}
    location ~ ^/(${regexGroup(sortedPrefixes)})(/|$) {
        proxy_pass         http://${upstream};
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto ${ssl ? 'https' : '$scheme'};
        proxy_pass_header  Set-Cookie;
    }`
}

function healthBlock({ path: routePath, service }, upstreams, ssl) {
  const upstream = upstreamName(service)
  return `    location = ${routePath} {
        proxy_pass         http://${upstream}${upstreams[service].healthPath};
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Proto ${ssl ? 'https' : '$scheme'};
    }`
}

function refusal(pad) {
  return `${pad}default_type application/json;
${pad}return 404 '{"statusCode":404,"message":"Route not handled by gateway"}';`
}

function refusalReturn(pad) {
  return `${pad}return 404 '{"statusCode":404,"message":"Route not handled by gateway"}';`
}

function webProxyBlock(app, ssl) {
  const upstream = webUpstreamName(app.app)
  const forwardedProto = ssl ? 'https' : '$scheme'
  return `${banner('web')}
    # The web image owns the static release and SPA shell.
    location /assets/ {
        proxy_pass         http://${upstream};
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto ${forwardedProto};
        proxy_pass_header  Set-Cookie;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
    }

    # index.html names the current hashed bundles and must not be cached.
    location = /index.html {
        proxy_pass         http://${upstream};
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto ${forwardedProto};
        proxy_pass_header  Set-Cookie;
        add_header Cache-Control "no-store" always;
    }

    # Browser navigations reach the web image; API-style fetches do not get its SPA fallback.
    location / {
        if ($serve_spa_shell = 0) {
${refusalReturn('            ')}
        }
        proxy_pass         http://${upstream};
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto ${forwardedProto};
        proxy_pass_header  Set-Cookie;
    }`
}

function serverBlock(app, deployment, upstreams, ssl) {
  const serverHead = ssl
    ? `server {
    listen 80;
    server_name ${deployment.sslServerName};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${deployment.sslServerName};

    ssl_certificate     /etc/letsencrypt/live/${deployment.sslServerName}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${deployment.sslServerName}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
    : `server {
    listen 80${deployment.serverName === '_' ? ' default_server' : ''};
    server_name ${deployment.serverName};

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;`

  const routed = Object.entries(app.servicePrefixes)
    .sort(([left], [right]) => compare(left, right))
    .filter(([, prefixes]) => prefixes.length > 0)
    .map(([service, prefixes]) => proxyBlock({ service, prefixes }, upstreams, ssl))
    .join('\n\n')

  const health = [...app.healthRoutes]
    .sort((left, right) => compare(left.path, right.path))
    .map((route) => healthBlock(route, upstreams, ssl))
    .join('\n\n')

  const unrouted =
    app.unroutedPrefixes.length === 0
      ? `${banner('unrouted')}
    # No known API prefixes are intentionally unrouted for this app.`
      : `${banner('unrouted')}
    # Refuse known API prefixes before the SPA fallback can serve HTML.
    location ~ ^/(${regexGroup([...app.unroutedPrefixes].sort())})(/|$) {
${refusal('        ')}
    }`

  return `# ===========================================================================
# ${app.app}-web
# ===========================================================================
${serverHead}

${routed}

${health}

${unrouted}

${webProxyBlock(app, ssl)}
}`
}

export function renderConfig(model, { ssl }) {
  validateModel(model)
  const sourceLines = (model.artifacts ?? model.manifests).map((artifact) => {
    const manifest = artifact.manifest ?? artifact
    const fileName = artifact.fileName ?? `${manifest.app}.json`
    const checksum = artifact.checksum ? ` sha256:${artifact.checksum}` : ''
    return `#              gateway/manifests/${fileName}${checksum}`
  })
  const serviceUpstreams = Object.entries(model.upstreams)
    .sort(([left], [right]) => compare(left, right))
    .map(
      ([service, upstream]) => `upstream ${upstreamName(service)} {
    zone ${upstreamName(service)} 64k;
    server ${upstream.host}:${upstream.port} resolve;
}`,
    )
    .join('\n\n')
  const webUpstreams = [...model.manifests]
    .sort((left, right) => compare(left.app, right.app))
    .map(
      ({ app }) => `upstream ${webUpstreamName(app)} {
    zone ${webUpstreamName(app)} 64k;
    server ${webServiceName(app)}:8080 resolve;
}`,
    )
    .join('\n\n')
  const upstreams = [serviceUpstreams, webUpstreams].filter(Boolean).join('\n\n')
  const sslNote = ssl
    ? '# TLS variant. Certificates must exist at the manifest host paths before use.\n'
    : ''

  return `# GENERATED FILE - DO NOT EDIT BY HAND.
#
# Environment: ${model.environment ?? 'unknown'}
# Sources:     gateway/schema/routing-manifest.schema.json
${sourceLines.join('\n')}
#              upstreams/services.json
#              deployment/${model.environment ?? 'unknown'}.lock.json
# Generator:   gateway/generate.mjs
# Regenerate:  node gateway/generate.mjs
# Verify:      node gateway/generate.mjs --check
#
# One origin serves each SPA and its API paths. This preserves same-site
# authentication cookies while keeping service-to-service traffic private.
#
# Docker embedded DNS follows recreated service containers after its validity
# window. Every upstream remains named directly in proxy_pass for URI stability.
#
# Nginx refuses a UTF-8 BOM; this file is emitted as UTF-8 without one.
${sslNote}resolver 127.0.0.11 valid=10s ipv6=off;
server_tokens off;

${upstreams}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# Only browser navigations may use the SPA shell for an unmatched path.
# Fetch/XHR requests receive JSON 404 instead of successful HTML.
map $http_sec_fetch_mode $serve_spa_shell {
    default       1;
    "cors"        0;
    "same-origin" 0;
    "no-cors"     0;
}

${model.manifests.map((app) => serverBlock(app, model.deployments[app.app], model.upstreams, ssl)).join('\n\n')}
`
}

function parseArgs(argv) {
  let check = false
  let environment = 'staging'
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--check') {
      check = true
      continue
    }
    if (argument === '--environment') {
      environment = argv[++index]
      continue
    }
    if (argument.startsWith('--environment=')) {
      environment = argument.slice('--environment='.length)
      continue
    }
    throw new Error(`unknown argument ${argument}`)
  }
  if (!['staging', 'production'].includes(environment)) {
    throw new Error(`invalid environment ${environment}`)
  }
  return { check, environment }
}

export async function run({ check = false, environment = 'staging' } = {}) {
  const model = await loadInputs({ rootDir: path.resolve(here, '..'), environment })
  let stale = 0

  for (const target of TARGETS) {
    const expected = renderConfig(model, { ssl: target.ssl })
    const name = path.basename(target.file)
    if (!check) {
      await writeFile(target.file, expected, 'utf8')
      console.log(`wrote   ${name}`)
      continue
    }

    let actual = null
    try {
      actual = await readFile(target.file, 'utf8')
    } catch {
    }
    if (actual === expected) {
      console.log(`ok      ${name}`)
    } else {
      console.error(`STALE   ${name} - run: node gateway/generate.mjs`)
      stale += 1
    }
  }

  if (check && stale > 0) {
    throw new Error(`${stale} generated gateway file(s) are stale`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run(parseArgs(process.argv.slice(2)))
  } catch (error) {
    console.error(`gateway generation failed: ${error.message}`)
    process.exitCode = 1
  }
}

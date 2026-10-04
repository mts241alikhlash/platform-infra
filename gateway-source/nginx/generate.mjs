#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

const APPS = [
  {
    name: 'academic',
    manifest: '../../academic-web/api-routes.config.ts',
    serverName: '_',
    sslServerName: 'YOUR_DOMAIN',
    root: '/usr/share/nginx/html/academic',
    smoke: 'academic-web: pnpm run smoke:gateway',
  },
  {
    name: 'admission',
    manifest: '../../admission-web/api-routes.config.ts',
    serverName: 'ppdb.localhost',
    sslServerName: 'PPDB_DOMAIN',
    root: '/usr/share/nginx/html/admission',
    smoke: 'admission-web has no smoke suite yet',
  },
  {
    name: 'admin',
    manifest: '../../admin-web/api-routes.config.ts',
    serverName: 'admin.localhost',
    sslServerName: 'ADMIN_DOMAIN',
    root: '/usr/share/nginx/html/admin',
    smoke: 'admin-web has no smoke suite yet',
  },
  {
    name: 'inventory',
    manifest: '../../inventory-web/api-routes.config.ts',
    serverName: 'simas.localhost',
    sslServerName: 'SIMAS_DOMAIN',
    root: '/usr/share/nginx/html/inventory',
    smoke: 'inventory-web has no smoke suite yet',
  },
  {
    name: 'portal',
    manifest: '../../portal-web/api-routes.config.ts',
    serverName: 'portal.localhost',
    sslServerName: 'PORTAL_DOMAIN',
    root: '/usr/share/nginx/html/portal',
    smoke: 'portal-web has no smoke suite yet',
  },
  {
    name: 'assessment',
    manifest: '../../assessment-web/api-routes.config.ts',
    serverName: 'assessment.localhost',
    sslServerName: 'ASSESSMENT_DOMAIN',
    root: '/usr/share/nginx/html/assessment',
    smoke: 'assessment-web has no smoke suite yet',
  },
  {
    name: 'hr',
    manifest: '../../hr-web/api-routes.config.ts',
    serverName: 'hr.localhost',
    sslServerName: 'HR_DOMAIN',
    root: '/usr/share/nginx/html/hr',
    smoke: 'hr-web has no smoke suite yet',
  },
]

const SERVICES = {
  identity: { upstream: 'identity_service', host: 'identity-service:3000' },
  academic: { upstream: 'academic_service', host: 'academic-service:3200' },
  student: { upstream: 'student_service', host: 'student-service:3900' },
  hr: { upstream: 'hr_service', host: 'hr-service:3800' },
  admission: { upstream: 'admission_service', host: 'admission-service:3700' },
  inventory: { upstream: 'inventory_service', host: 'inventory-service:3300' },
  presence: { upstream: 'presence_service', host: 'presence-service:3400' },
  portal: { upstream: 'portal_service', host: 'portal-service:3600' },
  assessment: {
    upstream: 'assessment_service',
    host: 'assessment-service:4000',
  },
}

for (const app of APPS) {
  const loaded = await import(
    pathToFileURL(path.resolve(here, app.manifest)).href
  )
  app.prefixes = loaded.SERVICE_PREFIXES
  app.unrouted = loaded.UNROUTED_PREFIXES
  app.health = loaded.HEALTH_ROUTES

  app.routed = Object.entries(app.prefixes).map(([service, prefixes]) => ({
    service,
    prefixes,
  }))

  for (const { service } of app.routed) {
    if (!SERVICES[service]) {
      console.error(
        `${app.name}: no upstream declared for "${service}". ` +
          'Add it to SERVICES in this file.',
      )
      process.exit(1)
    }
  }
}

const group = (prefixes) => prefixes.map((p) => p.replace(/^\//, '')).join('|')

const banner = (label) => `    # ${'-'.repeat(64 - label.length)} ${label}`

function proxyBlock({ service, prefixes }, ssl) {
  const { upstream } = SERVICES[service]
  return `${banner(service)}
    location ~ ^/(${group(prefixes)})(/|$) {
        proxy_pass         http://${upstream};
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto ${ssl ? 'https' : '$scheme'};
        proxy_pass_header  Set-Cookie;
    }`
}

function healthBlock({ path: routePath, service }) {
  const { upstream } = SERVICES[service]
  return `    location ${routePath} {
        proxy_pass         http://${upstream}/health;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
    }`
}

function serverBlock(app, ssl) {
  const serverHead = ssl
    ? `server {
    listen 80;
    server_name ${app.sslServerName};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${app.sslServerName};

    ssl_certificate     /etc/letsencrypt/live/${app.sslServerName}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${app.sslServerName}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
    : `server {
    listen 80${app.serverName === '_' ? ' default_server' : ''};
    server_name ${app.serverName};

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;`

  const refusalReturn = (pad) =>
    `${pad}return 404 '{"statusCode":404,"message":"Route not handled by gateway"}';`

  const refusal = (pad) =>
    [`${pad}default_type application/json;`, refusalReturn(pad)].join('\n')

  const unrouted =
    app.unrouted.length === 0
      ? `${banner('unrouted')}
    # None: every prefix this app calls is routed above. The block is omitted
    # rather than emitted empty — an nginx location with no alternation is a
    # syntax error.`
      : `${banner('unrouted')}
    # API paths this app calls that no service behind this gateway owns yet.
    # Refused explicitly so they never reach the SPA fallback below, and so
    # dev and production fail the same way.
    location ~ ^/(${group(app.unrouted)})(/|$) {
${refusal('        ')}
    }`

  return `# ===========================================================================
# ${app.name}-web  —  source: ${app.manifest.replace('../../', '')}
# ===========================================================================
${serverHead}

    root ${app.root};
    index index.html;

${app.routed.map((r) => proxyBlock(r, ssl)).join('\n\n')}

${app.health.map(healthBlock).join('\n\n')}

${unrouted}

${banner('static')}
    # Hashed filenames, so these can be cached hard.
    location /assets/ {
        try_files $uri =404;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
    }

    # The one file that must never be cached: it names the hashed bundles, so
    # a stale copy pins the browser to a previous deploy.
    location = /index.html {
        add_header Cache-Control "no-store" always;
    }

    # Real files first (favicon, manifest, images); only a path matching
    # nothing on disk reaches @spa.
    location / {
        try_files $uri $uri/ @spa;
    }

    location @spa {
        # default_type sits here, not inside the if: nginx's rewrite-phase if
        # accepts only return/rewrite/set/break, and default_type inside one is
        # a start-up error. Serving /index.html is unaffected - a static file
        # takes its type from the types map.
        default_type application/json;

        if ($serve_spa_shell = 0) {
${refusalReturn('            ')}
        }
        try_files /index.html =404;
    }
}`
}

function render({ ssl }) {
  const upstreams = Object.values(SERVICES)
    .map(
      (s) =>
        `upstream ${s.upstream} {\n    zone ${s.upstream} 64k;\n    server ${s.host} resolve;\n}`,
    )
    .join('\n\n')

  const sslNote = ssl
    ? '#\n# TLS variant. Swap in as conf.d/default.conf once certificates exist,\n# and uncomment the 443 port + letsencrypt volume in docker-compose.prod.yml.\n'
    : ''

  return `# GENERATED FILE — DO NOT EDIT BY HAND.
#
# Sources:     ${APPS.map((a) => a.manifest.replace('../../', '')).join('\n#              ')}
# Generator:   infra/nginx/generate.mjs
# Regenerate:  node infra/nginx/generate.mjs
# Verify:      node infra/nginx/generate.mjs --check
#
# Edit a manifest (or this generator) and regenerate. A hand edit here is
# reverted the next time anyone runs the generator, and --check fails in the
# meantime.
#
# One origin serves each SPA and the API it calls, and that is load-bearing
# rather than convenient: the refresh cookie identity-service sets is
# HttpOnly, SameSite=strict, path=/auth, so it is only ever sent back to the
# origin that served the page. Splitting a frontend onto another host loses
# the cookie, and with it login itself. That is also why the apps are separate
# server blocks on one nginx rather than separate containers: two containers
# cannot both hold :80.
#
# Must not carry a UTF-8 BOM — nginx does not strip one and refuses to start.
${sslNote}
# Docker's embedded DNS, so a redeployed service is followed to its new
# address.
#
# Without resolve nginx resolves each upstream name once at startup and
# caches it for the life of the worker. A container recreated by
# compose up -d --build <service> gets a new IP, and the gateway keeps
# sending to the old one — which Docker may by then have handed to a
# *different* container, so the request is proxied to the wrong service
# with nothing in any log to say so. Measured on 2026-09-11.
#
# resolve needs the group in shared memory (zone) and is open source
# from nginx 1.27.3; the pinned image is 1.27.5. The upstream is still
# named in proxy_pass, never built from a variable, so URI handling is
# unchanged.
resolver 127.0.0.11 valid=10s ipv6=off;

${upstreams}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# Should a path that matched no route below be answered with the SPA shell?
#
# Only a browser *navigation* should be. Anything an app fetches carries
# Sec-Fetch-Mode: same-origin (axios/fetch/XHR do), and answering those with
# index.html at HTTP 200 is the silent failure this gateway exists to avoid:
# axios resolves, res.data.data is undefined, and nothing throws.
#
# An absent header — older browsers, curl, health probes — falls back to
# serving the app, so this can only make the gateway stricter; it cannot break
# a client that predates Sec-Fetch-*.
map $http_sec_fetch_mode $serve_spa_shell {
    default       1;
    "cors"        0;
    "same-origin" 0;
    "no-cors"     0;
}

${APPS.map((app) => serverBlock(app, ssl)).join('\n\n')}
`
}

const TARGETS = [
  { file: path.join(here, 'nginx.conf'), ssl: false },
  { file: path.join(here, 'nginx.ssl.conf'), ssl: true },
]

const check = process.argv.includes('--check')
let stale = 0

for (const { file, ssl } of TARGETS) {
  const expected = render({ ssl })
  const name = path.basename(file)

  if (!check) {
    await writeFile(file, expected, 'utf8')
    console.log(`wrote   ${name}`)
    continue
  }

  let actual = null
  try {
    actual = await readFile(file, 'utf8')
  } catch {
  }

  if (actual === expected) {
    console.log(`ok      ${name}`)
  } else {
    console.error(`STALE   ${name} — run: node infra/nginx/generate.mjs`)
    stale++
  }
}

if (check && stale > 0) {
  console.error(
    `\n${stale} file(s) out of step with the apps' routing manifests.`,
  )
  process.exit(1)
}

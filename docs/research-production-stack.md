# Production Stack Risk Research

Research date: 2026-09-14

Scope: repository manifests, lockfiles, Docker and nginx configuration, upload
routes, throttling configuration, and current first-party advisories/docs. No
application code changed.

## Stack Inventory

Observed repository pins:

| Component | Manifest or image declaration | Locked or deployed observation |
| --- | --- | --- |
| Node.js | `>=24.20.0 <25` in service manifests; `node:24.20.0-alpine` in service Dockerfiles | 24.20.0 |
| NestJS | `@nestjs/*` 12.x in nine services | 12.0.0 or 12.0.1; `@nestjs/throttler` 6.5.0 |
| Prisma | `^7.9.1` in service manifests | `prisma`, `@prisma/client`, and `@prisma/adapter-pg` 7.10.0 in lockfiles |
| Vite | `^8.2.2` in seven web apps | 8.2.2 |
| pnpm | `pnpm@11.25.0` plus `<12` engine | 11.25.0 in Dockerfiles and package managers |
| nginx | `nginx:1.27-alpine` in production Compose | Floating `1.27` tag; repository notes say intended image is 1.27.5 |
| Multer | Pulled by `@nestjs/platform-express` | 2.2.0 in service lockfiles inspected |

Examples: [academic-service/package.json](../academic-service/package.json#L8-L12),
[academic-service/pnpm-lock.yaml](../academic-service/pnpm-lock.yaml#L35-L64),
[academic-service/Dockerfile](../academic-service/Dockerfile#L1-L3),
[docker-compose.prod.yml](../docker-compose.prod.yml#L5-L12),
[UPGRADE-NOTES.md](../UPGRADE-NOTES.md#L7-L18).

## Priority Findings

### P0: Multer 2.2.0 has current unauthenticated DoS advisories

Affected surface: all routes using Nest `FileInterceptor` with the locked
Multer 2.2.0 path.

The official Multer advisories report:

- `GHSA-535w-7cp7-47q4` / `CVE-2026-82333`: versions below 2.3.0 allow a
  crafted multipart field name with a huge array index to force large sparse
  array work. One request can consume CPU synchronously. Patched: 2.3.0.
- `GHSA-wc9g-mqfw-jrwm` / `CVE-2026-77078`: versions below 2.3.0 can be
  crashed by two crafted text field names, with an uncaught `RangeError`.
  Patched: 2.3.0.
- `GHSA-qfvm-cv95-jqjf` / `CVE-2026-77037`: exactly 2.2.0 leaks file
  descriptors and disk blocks on aborted uploads when disk storage is used.
  Patched: 2.3.0.
- `GHSA-qvfw-j98x-7q72` / `CVE-2026-77063`: below 2.3.0 can bypass
  `limits.fileSize` with an asynchronous `fileFilter`. Patched: 2.3.0.

Repository evidence shows Multer 2.2.0 in service lockfiles, including
[academic-service/pnpm-lock.yaml](../academic-service/pnpm-lock.yaml#L3639)
and [student-service/pnpm-lock.yaml](../student-service/pnpm-lock.yaml#L3597).
The official advisories are [array-index DoS](https://github.com/expressjs/multer/security/advisories/GHSA-535w-7cp7-47q4),
[crafted-field DoS](https://github.com/expressjs/multer/security/advisories/GHSA-wc9g-mqfw-jrwm),
[aborted-upload descriptor leak](https://github.com/expressjs/multer/security/advisories/GHSA-qfvm-cv95-jqjf),
and [async-filter size-limit bypass](https://github.com/expressjs/multer/security/advisories/GHSA-qvfw-j98x-7q72).

Action: move the resolved Multer version to 2.3.0 or later, then verify every
service lockfile. Do not rely on application authorization to mitigate these
issues because the advisory attack paths are network-level and unauthenticated
at the multipart parser.

### P0: File upload routes have no parser limits

Every inspected `FileInterceptor('file')` call passes no Multer options. Nest
documents that `FileInterceptor` accepts the same options as Multer. Multer
documents that omitting storage keeps files in memory, and that memory storage
can exhaust application memory. Multer also documents default `Infinity` for
`fileSize`, `files`, `fields`, `parts`, `fieldNestingDepth`, and
`fieldArrayIndexLimit`.

Confirmed routes:

- Student bulk import: [student-import-export.controller.ts](../student-service/src/student/presentation/http/student-import-export.controller.ts#L87-L116)
- Identity profile photo: [profile.controller.ts](../identity-service/src/profile/presentation/http/profile.controller.ts#L69-L94)
- Portal file upload: [file.controller.ts](../portal-service/src/platform/file/presentation/file.controller.ts#L50-L80)
- HR bulk import: [employee-import-export.controller.ts](../hr-service/src/employee/presentation/http/employee-import-export.controller.ts#L91-L112)
- Admission document and payment uploads: [admission-applicant.controller.ts](../admission-service/src/admission/applicant/presentation/http/admission-applicant.controller.ts#L102-L137)

The identity photo description says 2 MB, but the interceptor has no Multer
`limits.fileSize`; the `ParseFilePipe` shown there only requires a file. The
gateway also defaults `client_max_body_size` to 1 MB, creating a separate
behavior mismatch for that documented 2 MB upload.

Sources: [Nest file upload docs](https://docs.nestjs.com/techniques/file-upload),
[Multer options and defaults](https://github.com/expressjs/multer/blob/main/README.md#limits),
[Multer memory-storage warning](https://github.com/expressjs/multer/blob/main/README.md#memorystorage),
[nginx `client_max_body_size`](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size).

Action: set route-specific, finite `fileSize`, `files`, `fields`, `parts`,
`fieldNestingDepth`, and `fieldArrayIndexLimit`; use synchronous file filtering
or post-upload size validation; align nginx body limits with each endpoint.

### P1: Node 24.20.0 is behind current Node 24 LTS

The repository pins Node 24.20.0 in every service manifest and Docker image.
Node 24.21.0 was released on 2026-09-08 and includes updates to OpenSSL 3.5.8,
Undici 7.29.1, Corepack 0.36.0, root certificates, buffer validation, and
multiple HTTP/2, DNS, zlib, and crypto fixes.

The Node project says production applications should use Active LTS or
Maintenance LTS releases. Node 24 remains LTS, so the major line is suitable,
but this patch-level pin misses fixes present in 24.21.0. This is an update gap,
not proof that every listed fix is exploitable by this application.

Sources: [Node 24.20.0 release](https://nodejs.org/en/blog/release/v24.20.0),
[Node 24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0),
[Node release policy](https://nodejs.org/en/about/previous-releases),
[repository Node pins](../UPGRADE-NOTES.md#L9-L12).

Action: update `.node-version`, all service Dockerfiles, engines, and lockfile
tool metadata together. Rebuild images and run service validation after the
runtime change.

### P1: nginx 1.27 is stale, floating, and inside current advisory ranges

Production Compose declares `nginx:1.27-alpine`, not a digest or a patch tag.
The repository comments identify 1.27.5 as the intended image, but the Compose
file does not enforce that exact image.

The official nginx security list currently marks these ranges as vulnerable:

- `CVE-2026-42533`, buffer overflow when using `map` and regex: vulnerable
  through 1.31.2, fixed in 1.31.3 and 1.30.4.
- `CVE-2026-60005`, memory disclosure with `ngx_http_slice_module`:
  vulnerable through 1.31.2, fixed in 1.31.3 and 1.30.4.
- `CVE-2026-56434`, use-after-free with `ngx_http_ssi_module`:
  vulnerable through 1.31.2, fixed in 1.31.3 and 1.30.4.

The configured nginx file contains both `map` and regex locations, so the first
advisory needs immediate deployment-specific verification. The slice and SSI
conditions were not observed in the repository config. The official download
page lists 1.30.4 as stable and 1.31.5 as mainline, not 1.27.

Sources: [nginx security advisories](https://nginx.org/en/security_advisories.html),
[nginx downloads](https://nginx.org/en/download.html),
[production Compose](../docker-compose.prod.yml#L5-L12),
[nginx `map` and regex config](../gateway/nginx.conf),
[nginx upstream locations](../gateway/nginx.conf).

Action: choose a supported nginx branch, pin an exact patched image or digest,
run `nginx -t`, and validate the generated config before rollout. Do not treat
the floating `1.27-alpine` tag as a security pin.

### P1: Throttling is per-process memory, not shared production state

All nine services register `@nestjs/throttler` 6.5.0 with its built-in storage.
The common default is 500 requests per 60 seconds. Identity and portal add an
`auth` set at 20 requests per 60 seconds; portal adds a `portal-public` set at
2000 requests per 60 seconds. The default guard tracks `req.ip`.

The official Throttler documentation states that built-in storage is an
in-memory cache and supports alternate storage providers. Therefore, if any
service is scaled to multiple processes or containers, each instance keeps a
separate counter and the effective aggregate limit is higher than configured.
The same issue applies after a process restart. The repository currently has no
custom throttler storage registration.

The repository sets `TRUST_PROXY=1` and nginx forwards
`X-Forwarded-For`. That is correct only while exactly one trusted proxy sits in
front and service ports cannot be reached directly. A direct or additional
untrusted path can affect IP-based tracking, so network isolation must be
verified as part of deployment.

Sources: [Throttler configuration and in-memory storage](https://github.com/nestjs/throttler/blob/master/README.md#storages),
[Throttler proxy guidance](https://github.com/nestjs/throttler/blob/master/README.md#proxies),
[identity throttling](../identity-service/src/app.module.ts#L36-L50),
[portal throttling](../portal-service/src/app.module.ts#L34-L62),
[student throttling](../student-service/src/app.module.ts#L40-L50),
[proxy trust](../student-service/src/main.ts#L24-L34),
[nginx forwarded headers](../gateway/nginx.conf),
[production service exposure](../docker-compose.prod.yml#L41-L50).

Action: use shared storage for horizontally scaled services, keep the tracker
based on a verified client identity, and define tighter route-specific limits
for authentication, public submission, and upload endpoints.

## Lower-Risk Observations

### NestJS 12

The service lockfiles resolve Nest core and platform-express to 12.0.1 and
throttler to 6.5.0. The official Nest 12 package metadata requires Node 20 or
later and is ESM-oriented. The repository services already use explicit `.js`
imports and configure Jest with `--experimental-vm-modules`, matching that
runtime direction.

The current Nest security advisories checked here affect older or unused
surfaces: Fastify middleware bypasses, TCP transport JSON handling, SSE output
in older core versions, and the optional devtools integration. The repository
uses Express, does not declare `@nestjs/microservices` or
`@nestjs/devtools-integration`, and the affected core advisory is for
`@nestjs/core <=11.1.17`.

Sources: [Nest 12 package metadata](https://github.com/nestjs/nest/blob/master/package.json),
[Nest security advisories](https://github.com/nestjs/nest/security/advisories),
[repository Nest lock entries](../academic-service/pnpm-lock.yaml#L35-L64).

Status: no directly applicable NestJS advisory was found in the checked
official list. Continue monitoring because Nest 12 is a newly adopted major.

### Prisma 7.10

All service lockfiles inspected resolve Prisma 7.10.0. Prisma ORM v7 lists
Node 24 as supported and requires an explicit generated-client output path.
The repository builds the client before the production build and has a separate
migrator image command for `prisma migrate deploy`.

The official Prisma security advisory page currently exposes one old advisory
for `@prisma/sdk <2.20.0`; it is not the Prisma 7 client or CLI path observed in
these lockfiles. No directly applicable Prisma 7.10 advisory was found in the
checked official advisory list.

Operational risk remains around migration discipline: production must run only
reviewed, committed migrations, and the generated client must match the schema
used to build the image.

Sources: [Prisma v7 system requirements](https://www.prisma.io/docs/orm/reference/system-requirements),
[Prisma v7 client generation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client),
[Prisma official advisories](https://github.com/prisma/orm/security/advisories),
[Docker client generation and migrator](../academic-service/Dockerfile#L10-L28),
[Prisma lock entry](../academic-service/pnpm-lock.yaml#L59-L64).

### Vite 8.2.2

Vite is a build-time dependency here. Production Compose serves built SPA files
from nginx; it does not run `vite preview` as the production server.

The checked official Vite advisories affecting Vite 8 stop at 8.0.15 or lower,
8.0.4 or lower, and earlier branches. Vite 8.2.2 is outside those affected
ranges. The current Vite release page shows 8.3.0, so 8.2.2 is not latest, but
that alone is not a security finding.

Vite dev configuration leaves the default host in place and does not set
`server.host`, `server.allowedHosts=true`, or `server.cors=true`. This avoids
the documented broad-network and DNS-rebinding exposure by default. Do not add
`--host 0.0.0.0`, wildcard allowed hosts, or wildcard CORS without an explicit
trusted-network decision.

Sources: [Vite security advisories](https://github.com/vitejs/vite/security/advisories),
[Vite server options](https://vite.dev/config/server-options),
[Vite CLI warning about `vite preview`](https://vite.dev/guide/cli#vite-preview),
[Vite release list](https://github.com/vitejs/vite/releases),
[representative Vite config](../academic-web/vite.config.ts#L94-L104).

Status: no directly applicable Vite 8.2.2 advisory found in the checked
official list. Dev-server exposure remains an operational risk if scripts or
proxy infrastructure change.

### pnpm 11.25.0

The checked pnpm advisories affect pnpm 11 versions below 11.11.0 or below
11.5.3, depending on the advisory. The repository uses 11.25.0, which is above
all checked patched thresholds. The repository also uses frozen lockfile
installs and explicit `allowBuilds` entries.

This is a positive control, not a reason to trust arbitrary repository manifests:
pnpm documents that `pnpm-workspace.yaml` is repository-controlled and that
install settings can affect build execution and network behavior. Keep pnpm
updated and review lockfile, workspace settings, overrides, and build approvals
as code.

Sources: [pnpm security advisories](https://github.com/pnpm/pnpm/security/advisories),
[pnpm install integrity and frozen-lockfile behavior](https://pnpm.io/cli/install),
[pnpm workspace settings](https://pnpm.io/settings),
[repository pnpm pin](../UPGRADE-NOTES.md#L11-L12),
[repository build approvals](../academic-service/pnpm-workspace.yaml#L10-L21).

Status: no checked pnpm advisory applies to 11.25.0.

### nginx request handling defaults

The generated nginx config does not set `client_max_body_size`,
`client_body_timeout`, `proxy_connect_timeout`, or `proxy_read_timeout`.
Official nginx defaults are 1 MB for client bodies and 60 seconds for reading
client headers and body between reads. Proxy response buffering is enabled by
default and can spill to temporary files. This creates capacity and reliability
risk for slow or concurrent uploads, and the 1 MB body default conflicts with
the 2 MB profile-photo contract.

Sources: [nginx core directives](https://nginx.org/en/docs/http/ngx_http_core_module.html),
[nginx proxy buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering),
[generated nginx config](../gateway/nginx.conf).

Action: define body and timeout budgets per upload class at the gateway and
application layers, then test slow-client, aborted-upload, oversized-upload,
and upstream-timeout behavior.

## Recommended Order

1. Upgrade and pin Multer to 2.3.0 or later across all service lockfiles.
2. Add finite Multer limits to every upload interceptor, including multipart
   field and nesting limits, not only a post-parse file-type check.
3. Move Node and service images from 24.20.0 to current patched Node 24 LTS,
   updating every Dockerfile and runtime pin together.
4. Replace floating nginx 1.27 with a supported patched exact tag or digest;
   verify the `map` and regex advisory against the selected image.
5. Set nginx request-body and timeout budgets that match route contracts.
6. Add shared throttler storage before running more than one process per
   service, then review route-specific limits for auth, public submissions, and
   uploads.
7. Keep Vite, pnpm, NestJS, and Prisma on update monitoring; no directly
   applicable advisory was found for the checked Vite 8.2.2, pnpm 11.25.0,
   NestJS 12 Express, or Prisma 7.10 paths.

## Source Note

Sources are first-party project files, official project documentation, official
release notes, or official maintainer security advisory pages. GitHub HTML
pages can fail to render advisory details when unauthenticated; individual
advisory URLs were fetched where details were needed. Prisma documentation also
redirects its default pages toward Prisma ORM 8, so the v7 URLs are cited where
available.

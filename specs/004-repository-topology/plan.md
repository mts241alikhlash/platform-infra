# Implementation Plan: Repository Topology and Independent Releases

**Branch**: `004-repository-topology` (nominal; this workspace has no Git metadata) | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-repository-topology/spec.md`

**Execution boundary**: This plan prepares ten repository directories and their
contracts from the current filesystem snapshot. It did not run `git init`, add
remotes, create commits, push, or delete the source snapshot during the
preparation phase. The owner has since authorized local initialization and
snapshot commits; remotes, push, and deployment still require their external
inputs.

## Summary

Prepare ten independent repository roots for seven web applications, one
services monorepo, one shared frontend packages repository, and one platform
infrastructure repository. Keep runtime microservices independent inside
`241-services`, publish shared web packages and generated API clients to GitHub
Packages, and make Nginx consume versioned routing artifacts instead of sibling
web source.

The migration uses the smallest toolchain that meets the selected boundaries:
pnpm workspaces and filters, Changesets for independent releases,
`openapi-typescript` plus `openapi-fetch` for typed API clients, GitHub Packages
for private npm artifacts, GHCR for immutable images, and Nginx as the existing
edge/API Gateway. Nx and Turborepo are deliberately not added.

The source snapshot stays intact while prepared copies are validated under
`prepared-repos/`. The final cutover produces one clean snapshot per target
repository, then stops before external remote, registry, image, and deployment
inputs are supplied.

## Technical Context

**Language/Version**: Node.js `>=24.20.0 <25`, TypeScript `~5.9.3`, Vue `3.5`,
NestJS `12.0.1`, Vite `8.2.2`

**Primary Dependencies**: pnpm `11.25.0`, Prisma `7.9.1`, PostgreSQL,
GitHub Actions, GitHub Packages, GHCR, Changesets, `openapi-typescript`,
`openapi-fetch`, Nginx `1.27-alpine`, Docker Compose

**Storage**: Nine existing PostgreSQL databases remain service-owned. No new
application data store. GitHub Packages and GHCR hold release artifacts.

**Testing**: Existing per-project `format:check`, lint, typecheck, strict lint,
unit tests, and build; package export fixtures; OpenAPI snapshot and generated
client checks; routing-manifest validation; `nginx -t`; Docker Compose config
validation; disposable-container smoke tests.

**Target Platform**: Private GitHub repositories and GitHub Actions; Linux
container runtime with Docker Compose or equivalent; browser clients served by
Nginx over HTTPS.

**Project Type**: Repository and release-boundary migration for web apps,
microservices, publishable packages, API contracts, and platform infrastructure.

**Performance Goals**: A change to one web app or service must not rebuild
unrelated runtime artifacts. Gateway generation must remain deterministic and
complete within the existing CI timeout budget.

**Constraints**: No Git history import; no `git init` before readiness approval;
no credential files in source; no web source checkout needed by another web
repository or by infra; no copied source for published shared packages; no
service source imports across service boundaries; no business logic in the
gateway; same-origin SPA/API behavior must remain intact.

**Scale/Scope**: Seven web repositories, nine service projects in one services
repository, two shared frontend packages, nine generated API client packages,
one infrastructure repository, seven web images, nine service images, nine
service databases, and one public gateway.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
| --- | --- | --- |
| I. Layered Dependency Flow | PASS WITH ACTION | Existing service layering remains unchanged. Generated clients and gateway code stay at outer boundaries; no new business logic enters services. |
| II. Service Boundaries and One Source of Truth | PASS WITH ACTION | Services remain HTTP-separated. Published API clients replace source copying. Shared frontend packages gain one owner. |
| III. Scoped and Authorized Data Access | PASS | No query or authorization rule changes. Existing service-owned databases and guards remain in place. |
| IV. Explicit Contracts at Every Boundary | PASS WITH ACTION | Shared package exports, OpenAPI documents, generated clients, routing manifests, and deployment locks become explicit contracts. |
| V. Green Quality Gates | PASS WITH ACTION | Each target repository gets validation. Service and package release workflows select affected projects. |
| VI. Data Ownership and Transaction Boundaries | PASS | No database ownership change. Nine service databases and migration streams remain separate. |
| VII. Schema Ownership and Migration Safety | PASS WITH ACTION | Services monorepo does not merge databases. Each service retains one schema and one migration owner. |
| VIII. Cross-Service Failure Is Explicit | PASS WITH ACTION | Generated clients do not replace adapter timeout, retry, fail-closed, idempotency, or local read-model rules. |
| Repository initialization gate | PASS WITH ACTION | Preparation stops before `git init`, remotes, commits, and pushes until the owner approves the readiness report. |

No gate violation requires a workaround. The migration creates more repository
boundaries but does not weaken service, database, API, or security boundaries.

## Architecture Decision

### Repository layout

```text
prepared-repos/
├── 241-academic-web/
├── 241-admin-web/
├── 241-admission-web/
├── 241-assessment-web/
├── 241-hr-web/
├── 241-inventory-web/
├── 241-portal-web/
├── 241-services/
│   ├── services/
│   │   ├── identity-service/
│   │   ├── academic-service/
│   │   ├── admission-service/
│   │   ├── inventory-service/
│   │   ├── portal-service/
│   │   ├── presence-service/
│   │   ├── hr-service/
│   │   ├── student-service/
│   │   └── assessment-service/
│   ├── packages/
│   │   ├── api-identity/
│   │   ├── api-academic/
│   │   ├── api-admission/
│   │   ├── api-inventory/
│   │   ├── api-portal/
│   │   ├── api-presence/
│   │   ├── api-hr/
│   │   ├── api-student/
│   │   └── api-assessment/
│   ├── contracts/
│   │   └── <service>/openapi.json
│   ├── pnpm-workspace.yaml
│   ├── pnpm-lock.yaml
│   └── .changeset/
├── 241-web-packages/
│   ├── packages/
│   │   ├── ui/
│   │   ├── web-shared/
│   │   └── (no reference-data package in admission-web baseline)
│   ├── pnpm-workspace.yaml
│   ├── pnpm-lock.yaml
│   └── .changeset/
└── 241-platform-infra/
    ├── gateway/
    ├── deployment/
    ├── manifests/
    ├── compose/
    └── .github/workflows/
```

`prepared-repos/` is a staging directory owned by the current workspace, not a
target repository. It is disposable and must not be confused with a Git remote.

### Boundary flow

```text
241-web-packages
  -> @241/ui, @241/web-shared
       -> seven web repositories

241-services
  -> nine service images
  -> @241/api-* clients
       -> web repositories and service adapters

web repositories
  -> web image
  -> versioned routing manifest

241-platform-infra
  -> deployment lock
  -> Nginx API Gateway
  -> runtime composition
```

Service-to-service traffic remains private HTTP. Browser traffic enters through
Nginx on the web app's public origin. Nginx serves or proxies the pinned web
artifact and declared API prefixes for that same host.

## Implementation Phases

### Phase 0: Snapshot and ownership inventory

1. Freeze the current source snapshot. Record checksums, file counts, ignored
   secret candidates, package versions, and existing validation baselines.
2. Create a machine-readable ownership manifest for every current root folder and
   root operational file.
3. Mark each current path as move, extract, reconcile, replace, retire, or
   archive. Stop if any path has zero or multiple owners.
4. Record the current absence of Git metadata and preserve the no-history-import
   decision.
5. Verify that no `.env`, key, certificate, token, or generated local artifact is
   copied into a prepared repository.

**Exit**: ownership manifest has one owner for every source and operational path;
snapshot checksum report exists; source snapshot is unchanged.

### Phase 1: Prepare `241-services`

1. Move the nine service directories below `services/` without changing service
   source behavior, ports, environment names, Prisma schemas, migrations, or
   Docker build outputs.
2. Create the root workspace with `services/*` and `packages/*` globs.
3. Merge per-service package policies into a root policy without widening
   security overrides silently. Document any override that must remain scoped.
4. Create root scripts for affected validation, service selection, generation,
   and release preparation. Keep each service's existing scripts usable from its
   package directory.
5. Configure independent Changesets releases. Services remain private workspace
   projects; service versions and tags are independent even though the repository
   has one lockfile.
6. Add affected service CI. A changed service validates itself; a changed API
   client package validates its provider and affected local consumers.
7. Build one disposable service image through `pnpm deploy` or the final
   production packaging command. Confirm the image contains only the target
   service runtime and required dependencies.

**Exit**: all nine services typecheck, test, build, and package from the
services monorepo; one service can produce an image without rebuilding unrelated
service images; no service imports another service's source.

### Phase 2: Add API contracts and generated clients

1. Make each service's OpenAPI output deterministic and track the contract under
   `contracts/<service>/openapi.json`.
2. Set Swagger document version from the service contract release metadata rather
   than leaving every document at static `1.0`.
3. Add `@241/api-<service>` packages generated with `openapi-typescript` and a
   thin `openapi-fetch` client factory.
4. Keep generated output reproducible and fail CI when the emitted document or
   generated client is stale.
5. Add contract compatibility checks. Additive endpoints and optional fields are
   compatible; removed, renamed, or semantically incompatible fields require a
   major release signal. CI enforces a major Changeset for breaking provider and
   generated-client contract changes.
6. Replace service consumer request/response definitions at the outer adapter
   boundary only. Keep local narrow read models, timeouts, retries, failure
   handling, and mapping logic in each consumer.
7. Publish a dry-run package to the GitHub Packages-compatible fixture or local
   package tarball before using real registry credentials.

**Exit**: nine discoverable contracts and nine generated clients exist; one
   provider change can make a stale consumer red during validation; no consumer
   imports provider source or generated types into domain code.

### Phase 3: Prepare `241-web-packages`

1. Reconcile the seven copied `packages/shared` trees into one canonical package.
2. Reconcile the mostly identical `packages/ui` trees. Keep app-only components
   such as `FloatingField`, `FloatingLabelField`, and `SafeHtml` out of the shared
   package unless their ownership is explicitly approved.
3. Reconcile `reference-data` only for the features genuinely shared by its
   consumers.
4. Add package manifests, explicit exports, peer dependency policy, build or
   Just-in-Time strategy, tests, pack allowlists, and independent Changesets.
5. Publish package candidates to a local tarball fixture first, then to GitHub
   Packages after registry access is configured.
6. Verify a clean external consumer can install each package without the source
   repository and without consumer aliases such as `@/ui` resolving to copied
   source.

**Exit**: shared package sources have one owner; package exports work from a clean
consumer; one consumer can upgrade while another remains on its previous version.

### Phase 4: Extract each web repository

For each of the seven web apps:

1. Copy only that app's source, tests, app-specific `platform` slice, build
   configuration, route manifest source, Dockerfile, documentation, and release
   workflow into its prepared repository.
2. Remove copied source trees owned by `241-web-packages`.
3. Replace local aliases with package exports while preserving import ergonomics
   where it does not conceal a cross-repository source dependency.
4. Add the exact shared package and `@241/api-*` dependencies used by that app.
5. Keep the app's service route set narrow. Do not add a route or dependency for a
   service the app does not use.
6. Add a release workflow that builds one web image and emits one routing manifest
   artifact. The image must be immutable and independent of sibling web source.
7. Run the app's full validation from a clean prepared repository.

**Exit**: each web repo builds from its own checkout plus registry dependencies;
seven web artifacts can be released independently; app-specific platform code is
not accidentally published.

### Phase 5: Prepare `241-platform-infra` and API Gateway

1. Move gateway generator, Nginx templates, deployment definitions, service
   upstream registry, and platform-owned operational documentation into the infra
   repository.
2. Define and validate routing-manifest schema version 1.
3. Replace direct imports such as `../../academic-web/api-routes.config.ts` with
   pinned JSON artifacts and checksums.
4. Define a deployment lock containing every selected web image digest, routing
   manifest version/checksum, service image digest, gateway image digest, host,
   upstream, and health path.
5. Generate HTTP and TLS Nginx configurations from the lock and manifests.
6. Validate safe path grammar, duplicate prefixes, routed/unrouted overlap,
   unknown services, duplicate hosts, missing artifacts, and checksum mismatch.
7. Replace web `dist` bind mounts and service source builds in production Compose
   with pinned images on one external private network.
8. Keep service-to-service traffic private and preserve same-origin SPA/API paths,
   relative browser API URLs, refresh-cookie behavior, and explicit JSON 404s.
9. Run `nginx -t` against both HTTP and TLS configurations and execute gateway
   smoke tests for every app host, declared route, health route, unrouted route,
   deep link, asset cache, and auth path.

**Exit**: infra generates a reproducible gateway without web source checkout;
Compose deploys pinned artifacts; one web or service artifact can be replaced or
rolled back without rebuilding unrelated artifacts.

### Phase 6: Repository CI, release, and registry wiring

1. Add repository-local CI workflows for all ten target repositories.
2. Give validation only the permissions it needs: `contents: read`, package read
   or write where required, and release write permissions only in release jobs.
3. Configure GitHub Packages scoped registry access using `GITHUB_TOKEN` and
   repository package permissions. Never commit a token in `.npmrc`.
4. Configure GHCR image publication with immutable version tags and digest-based
   deployment references.
5. Configure Changesets release PRs and independent package/service versioning.
   Require major Changesets when the service contract compatibility guard detects
   a breaking OpenAPI change.
6. Configure consumer update automation only after packages and API clients have
   a tested first release. Do not auto-merge dependency updates.
7. Retire the root changed-folder workflow, root release script, and combined
   Compose assumptions only after repository-local workflows pass.

**Exit**: affected changes validate in the correct repository; releases produce
versioned packages/images/manifests; no mutable `latest` reference appears in a
production lock.

### Phase 7: Preparation review and Git cutover gate

1. Run the ownership check over all prepared repository trees.
2. Run all clean-checkout quickstart scenarios.
3. Compare source snapshot checksums against intended move/extract dispositions.
4. Scan for secrets, sibling-source imports, copied package trees, mutable image
   tags, unpinned artifacts, missing contracts, and contradictory topology docs.
5. Produce a readiness report with pass/fail evidence and unresolved blockers.
6. Stop. Do not run `git init`, create remotes, commit, or push in this feature
   until the owner explicitly approves the readiness report.

**Exit**: all success criteria in `spec.md` have evidence; only then can the
owner perform or authorize Git initialization from the clean snapshot.

## Source Layout After Cutover

### `241-services`

```text
services/<service>/
├── src/
├── prisma/
├── Dockerfile
├── package.json
├── pnpm-workspace.yaml    # removed after root workspace migration
└── .env.example

packages/api-<service>/
├── src/generated.ts
├── src/client.ts
├── package.json
└── README.md

contracts/<service>/openapi.json
```

The per-service `pnpm-workspace.yaml` files are not retained as nested workspace
roots. Their `overrides` and `allowBuilds` entries are reconciled into the root
workspace policy. Each service keeps its own `package.json`, Dockerfile, Prisma
schema, migrations, `.env.example`, and runtime scripts.

### Web repository

```text
241-<name>-web/
├── src/
├── public/
├── packages/platform/       # app-specific only
├── api-routes.config.ts     # local Vite and smoke-test source
├── routing-manifest.schema.json
├── Dockerfile
├── package.json
├── pnpm-lock.yaml
├── .npmrc                   # registry mapping only, no token
└── .github/workflows/
```

The app's release workflow derives the routing artifact from its local typed
manifest. It does not publish the full Vue route registry.

### `241-web-packages`

```text
packages/<package-name>/
├── src/
├── tests/
├── package.json
├── README.md
└── CHANGELOG.md
```

Packages expose only stable public exports. Consumer-specific features remain in
the consumer repository.

### `241-platform-infra`

```text
gateway/
├── generate.mjs
├── schema/routing-manifest.schema.json
├── manifests/<app>/<version>.json
├── nginx.conf
└── nginx.ssl.conf

deployment/
├── production.lock.json
├── staging.lock.json
└── validate-lock.mjs

compose/
├── docker-compose.production.yml
└── docker-compose.staging.yml
```

Generated Nginx files remain generated and are checked for staleness. Deployment
locks are reviewed source, not generated output.

## Verification Plan

### Static checks

- Ownership manifest has no unassigned or multiply assigned path.
- Prepared web repositories contain no sibling web source path.
- Prepared web repositories contain no copied source for package-owned code.
- Services contain no cross-service source imports.
- Package names, exports, peer dependencies, and registry mapping are valid.
- OpenAPI and generated client output are deterministic and not stale.
- Breaking OpenAPI changes require major Changesets for the provider and its
  generated client; compatible additions remain eligible for minor/patch review.
- Routing manifests pass schema, grammar, overlap, ownership, and checksum checks.
- Production lock contains only immutable image references.
- No source file contains registry tokens, private keys, certificates, or `.env`
  values.

### Project checks

- Each web repository runs its existing `pnpm validate` pipeline.
- Each service package runs `prisma:generate` followed by its existing validation
  pipeline from the services workspace.
- Each shared package runs typecheck, tests, pack inspection, and clean-consumer
  installation.
- Each generated API client runs typecheck, tests, and consumer fixture checks.

### Runtime checks

- `docker compose config` succeeds with image-only deployment definitions.
- `nginx -t` succeeds for generated HTTP and TLS configurations.
- Every configured host serves its own web artifact.
- Every declared API and health prefix reaches its declared service.
- Every unrouted or unknown API fetch returns JSON 404, never SPA HTML.
- Hashed assets are immutable and `index.html` is not cached.
- Login, refresh, logout, and OAuth callback work through each app origin.
- Recreating one service is followed by Nginx DNS resolution after the validity
  window.
- Replacing or rolling back one web/service digest leaves unrelated artifacts
  unchanged.

### Cutover checks

- All ten prepared trees are independently readable and buildable.
- Every source and operational path has one owner.
- The old root topology claims are removed or rewritten consistently.
- No old Git history is present because no history import is allowed.
- Readiness report is explicitly approved before any Git initialization action.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Ten repositories instead of one | Owner requires isolated web development and release boundaries, while shared packages and infra need explicit owners | One repository already supports independent deploys but does not provide the requested repository-level isolation |
| Services monorepo plus nine deployment units | Services share operational conventions and contract knowledge but must remain independently deployable | Nine repositories multiply governance and contract coordination without improving runtime isolation |
| `241-web-packages` repository | Web apps currently contain copied shared code that must gain one owner and controlled adoption | Copying keeps drift; embedding packages in one web repo gives that app ownership of platform code it does not own |
| `241-platform-infra` repository | Gateway and deployment must consume artifacts without checking out web source | Keeping infra with one app makes other app routes and artifact pins cross-owner changes |
| Generated API client packages | HTTP contracts currently compile independently and can drift silently | Copying DTOs or importing service source violates service boundaries and still misses runtime contract changes |

The complexity is repository-level and directly tied to approved isolation goals.
No new runtime service or gateway application is added.

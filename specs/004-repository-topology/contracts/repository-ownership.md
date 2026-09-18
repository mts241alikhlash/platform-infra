# Contract: Repository Ownership

## Canonical repositories

| Repository | Owned content | Not owned |
| --- | --- | --- |
| `241-academic-web` | Academic app source, tests, local platform slice, app config, Dockerfile, release workflow | Other web source, service source, gateway config |
| `241-admin-web` | Admin app source, tests, local platform slice, app config, Dockerfile, release workflow | Other web source, service source, gateway config |
| `241-admission-web` | Admission app source, tests, local platform slice, app config, Dockerfile, release workflow | Other web source, service source, gateway config |
| `241-assessment-web` | Assessment app source, tests, local platform slice, app config, Dockerfile, release workflow | Other web source, service source, gateway config |
| `241-hr-web` | HR app source, tests, local platform slice, app config, Dockerfile, release workflow | Other web source, service source, gateway config |
| `241-inventory-web` | Inventory app source, tests, local platform slice, app config, Dockerfile, release workflow | Other web source, service source, gateway config |
| `241-portal-web` | Portal app source, tests, local platform slice, app config, Dockerfile, release workflow | Other web source, service source, gateway config |
| `241-services` | Nine service packages, service docs, service Dockerfiles, OpenAPI documents, generated API client packages, services CI/release workflow | Web source, public gateway, web package source |
| `241-web-packages` | `@241/ui`, `@241/web-shared`, package tests, package release workflow | App-specific platform code, local reference-data code, service source, deployment lock |
| `241-platform-infra` | Nginx API Gateway, routing schema, deployment lock, Compose/deployment definitions, environment wiring, platform-wide architecture docs | Business logic, app feature source, service domain source |

## Current path disposition

| Current path | Disposition | Target |
| --- | --- | --- |
| `academic-web/**` through `portal-web/**` | Move one directory per repository | Matching `241-*-web` repository |
| `identity-service/**` through `student-service/**` | Move below `services/` | `241-services` |
| `*/packages/ui/src/**` | Reconcile variants, extract once | `241-web-packages` |
| `*/packages/shared/src/**` | Extract canonical copy once | `241-web-packages` |
| `*/packages/reference-data/src/**` | Keep local unless separate package decision is made | Matching web repository |
| `*/packages/platform/**` | Keep app-specific copy | Matching web repository |
| `infra/**` | Move unchanged first, then artifact migration | `241-platform-infra` |
| `docker-compose*.yml` | Replace source builds and dist mounts with image references | `241-platform-infra` |
| `.github/workflows/validate.yml` | Retire root matrix; split into repository workflows | `241-platform-infra` records migration |
| `.github/scripts/changed-folders.mjs` | Retire after repository-specific affected CI exists | `241-platform-infra` records migration |
| `scripts/release.mjs` | Retire after Changesets workflows pass | `241-platform-infra` records migration |
| `docs/OVERVIEW.md`, `DESIGN.md`, `VERSIONING.md` | Rewrite for ten-repository topology | `241-platform-infra` |
| `specs/004-repository-topology/**` | Preserve migration record and readiness evidence | `241-platform-infra/docs/architecture/` |
| `.gitignore`, `.gitattributes` | Regenerate per target repository | Each target repository |
| `.specify/`, `.claude/`, `CLAUDE.md`, `skills-lock.json` | Preparation metadata; copy only where a repository workflow needs it | `241-platform-infra` owns the migration record |

## Boundary invariants

1. No web repository imports source from another web repository.
2. No service imports source from another service.
3. Web repositories consume `@241/*` packages by version.
4. Services and web repositories consume `@241/api-*` clients by version.
5. `241-platform-infra` consumes routing-manifest artifacts, never web source.
6. Service-to-service calls use HTTP over the private network, never the public
   gateway.
7. A database and its migrations have exactly one owning service.

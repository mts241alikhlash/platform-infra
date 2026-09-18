# Data Model: Repository Topology and Independent Releases

This feature changes source and release boundaries. It does not add application
database tables. The entities below are planning and deployment records.

## Repository

Represents one source, review, access, CI, and release boundary.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | One of the ten canonical repository names |
| `kind` | enum | `web`, `services`, `web-packages`, or `platform-infra` |
| `owner` | string | Exactly one responsible team or owner |
| `visibility` | enum | `private` for all target repositories |
| `sourceDisposition` | enum | `move`, `extract`, `replace`, `retire`, or `archive` per current path |

**Rules**:

- Every current source, operational, and release file has exactly one target
  owner or an explicit retirement disposition.
- A web repository contains one web application.
- The services repository contains nine service packages, not one backend runtime.
- The package and infrastructure repositories do not own application business
  data.

## Project

Represents a buildable package inside a repository.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | Unique within its package registry or workspace |
| `repository` | Repository | Owns source and release metadata |
| `version` | semantic version | Independent unless explicitly fixed with another package |
| `private` | boolean | Runtime apps and services stay private; published clients/packages do not |
| `dependencies` | list | Must cross boundaries through published packages or HTTP contracts |

Projects in scope:

- Seven private web application projects.
- Nine private service projects.
- Three publishable frontend packages.
- Nine publishable API client packages.
- One publishable routing-manifest-schema package inside `241-platform-infra`.

## Deployment Unit

Represents one runtime artifact that can be promoted or rolled back independently.

| Field | Type | Rules |
| --- | --- | --- |
| `project` | Project | One web app or one service |
| `image` | OCI image reference | Must resolve to an immutable digest in production |
| `version` | semantic version | Must match release metadata |
| `healthPath` | path | Must be owned by the project |
| `database` | string or null | One service-owned database or null for web apps |

Relationships:

- One web project has one deployment unit.
- One service project has one deployment unit.
- `241-services` owns nine service deployment units.
- A shared package and API client are release artifacts, not runtime deployment
  units.

## Shared Package

Represents reusable frontend code published by `241-web-packages`.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | scoped package name | `@241/ui` or `@241/web-shared` |
| `version` | semantic version | Independently released |
| `exports` | package export map | Public surface only; no consumer alias dependency |
| `peerDependencies` | package map | Framework singletons such as Vue stay peer dependencies |
| `consumers` | repository list | Web repositories that explicitly adopt it |

**Rules**:

- Consumers use a published version, not copied source.
- A breaking public export requires a major version.
- App-specific `platform` code is not a Shared Package in this migration.

## API Contract

Represents one service's published HTTP request, response, error, and compatibility
surface.

| Field | Type | Rules |
| --- | --- | --- |
| `service` | service name | Exactly one provider service |
| `openapiDocument` | JSON artifact | Generated from provider decorators and tracked in the services repo |
| `clientPackage` | scoped package name | `@241/api-<service>` |
| `clientVersion` | semantic version | Independent from unrelated services |
| `compatibility` | enum | `patch`, `minor`, or `major` change classification |
| `consumers` | repository list | Web apps and services using the client |

**Rules**:

- Additive endpoints and optional fields are compatible.
- Removed, renamed, or incompatible fields require a major client version.
- Consumers map provider responses to local read models at the adapter boundary.
- No consumer imports provider service source.

## Routing Manifest

Represents the gateway-visible routes of one web release.

| Field | Type | Rules |
| --- | --- | --- |
| `schemaVersion` | positive integer | Version of the manifest contract |
| `app` | string | Canonical app key, such as `academic` |
| `webVersion` | semantic version | Must match the web release that produced the artifact |
| `servicePrefixes` | map | Each prefix maps to one declared service |
| `unroutedPrefixes` | list | Explicitly refused app API prefixes |
| `healthRoutes` | list | Gateway health paths mapped to service health endpoints |

**Rules**:

- Prefixes contain path segments only, not regular-expression syntax.
- A service named by the manifest must exist in the infra upstream registry.
- A prefix cannot appear in both routed and unrouted lists.
- The manifest is published as an immutable release artifact.

## Deployment Lock

Represents one reproducible environment deployment.

| Field | Type | Rules |
| --- | --- | --- |
| `schemaVersion` | positive integer | Version of the lock format |
| `environment` | string | `staging` or `production` |
| `gatewayImage` | digest reference | Immutable Nginx image |
| `apps` | map | One entry per deployed web app |
| `services` | map | One entry per deployed service |
| `manifestChecksums` | map | SHA-256 checksum for every routing manifest |

**Rules**:

- Every image is pinned by digest.
- Every app image has a matching manifest version and checksum.
- Every route service has an upstream and health path.
- Deployment changes are reviewed in `241-platform-infra`.
- Rollback means selecting a prior lock or prior artifact digest, not rebuilding.

## Dependency relationship

```text
241-web-packages
  -> published frontend packages
       -> seven web repositories

241-services
  -> service images
  -> OpenAPI documents
  -> published API clients
       -> web repositories and service adapters

web repositories
  -> web images
  -> routing-manifest release artifacts

241-platform-infra
  -> deployment lock
  -> Nginx gateway configuration
  -> web and service runtime composition
```

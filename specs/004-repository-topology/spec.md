# Feature Specification: Repository Topology and Independent Releases

**Feature Branch**: `004-repository-topology`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Prepare the 241 platform so each web app has a separate repository for isolated development, deployment, and semantic versioning, while all microservices live in one independently versioned services repository."

## Context

The current workspace is a filesystem snapshot containing seven Vue web apps,
nine NestJS services, shared frontend code, and gateway/deployment files. It has
no Git metadata. The existing documents disagree about whether these folders are
separate repositories or one repository, so the first deliverable is a single,
explicit target topology rather than an immediate repository initialization.

The owner chose this target:

- each web app has its own repository and release lifecycle;
- all nine services live in one services repository, but remain separate
  microservices at runtime;
- shared web packages are published and consumed by version, never copied into
  each web repository;
- service API contracts produce versioned generated clients;
- one infrastructure repository owns the API Gateway and deployment wiring;
- the current Nginx edge remains the API Gateway; no new NestJS BFF is added;
- GitHub Packages is the private package registry;
- the current workspace is treated as a clean snapshot with no history import;
- Git initialization and remote creation happen only after preparation passes its
  acceptance checks.

### Target repositories

| Repository | Owns | Release boundary |
| --- | --- | --- |
| `241-academic-web` | Academic web app | One web app |
| `241-admin-web` | Admin web app | One web app |
| `241-admission-web` | Admission web app | One web app |
| `241-assessment-web` | Assessment web app | One web app |
| `241-hr-web` | HR web app | One web app |
| `241-inventory-web` | Inventory web app | One web app |
| `241-portal-web` | Portal web app | One web app |
| `241-services` | Nine service codebases and service-owned API contracts | One service or generated client at a time |
| `241-web-packages` | Shared frontend packages | One package at a time |
| `241-platform-infra` | API Gateway, deployment definitions, routing manifests, and environment wiring | One infrastructure release |

The target is ten repositories. A repository boundary does not remove a
deployment boundary: `241-services` still produces nine service images, nine
database migration streams, and nine service versions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A web team works and releases one app in isolation (Priority: P1)

A web developer works on one product without checking out or changing the
other seven web applications. The team can release, roll back, and deploy its app
using its own semantic version while consuming explicit versions of shared
packages and API clients.

**Why this priority**: Isolated web development and deployment are the primary
reason for the selected repository topology.

**Independent Test**: Start from a clean checkout of one web repository, install
its declared dependencies, build its release artifact, and verify that no source
file from another web repository is required. Release a new version and confirm
that the other seven web releases and artifacts are unchanged.

**Acceptance Scenarios**:

1. **Given** a clean checkout of one web repository, **When** the team runs its
   documented development and validation commands, **Then** the app does not
   require a sibling web source tree.
2. **Given** a web repository depends on a shared package or service API client,
   **When** the dependency is resolved, **Then** it uses an explicit published
   version from the private registry.
3. **Given** a web change is released, **When** its deployment is promoted,
   **Then** only that web application's runtime artifact is replaced.
4. **Given** a previous web release exists, **When** its version is selected for
   rollback, **Then** the previous immutable artifact can be restored without
   rebuilding another web application.

---

### User Story 2 - A services team manages microservices together but releases them independently (Priority: P1)

A backend developer can understand and change all service boundaries in one
repository. Runtime services remain independently deployable, independently
versioned, and independently migratable. A service that no web app calls can
still run for internal consumers or future consumers without becoming a web
dependency everywhere.

**Why this priority**: The services share operational conventions and contract
knowledge, but their runtime and data ownership must remain microservice-shaped.

**Independent Test**: Change one service in `241-services`, run the affected
service checks, build its image, and verify that an unrelated service image,
database migration stream, and release version are not changed.

**Acceptance Scenarios**:

1. **Given** a change limited to one service, **When** the services repository CI
   runs, **Then** it validates the changed service and any explicitly affected
   contract package without requiring a release of all nine services.
2. **Given** two services have different release needs, **When** each is released,
   **Then** each receives its own semantic version and changelog entry.
3. **Given** a service is not used by a particular web app, **When** that web app
   is built and deployed, **Then** it does not gain a dependency or route for the
   unused service.
4. **Given** one service is redeployed, **When** the deployment completes, **Then**
   other service processes remain available and their versions are unchanged.

---

### User Story 3 - Shared frontend code has one owner and controlled adoption (Priority: P1)

A maintainer fixes shared UI or frontend utility code once. Each web team chooses
when to adopt the new package version, and a package release does not silently
change every web application.

**Why this priority**: The current workspace contains byte-identical copies of
shared packages, and those copies already drift. Versioned packages replace
manual same-session copying with an explicit dependency contract.

**Independent Test**: Publish a compatible patch of one shared package, update
one web repository to that version, and verify that another web repository still
uses its previous version until it opts in.

**Acceptance Scenarios**:

1. **Given** shared code used by multiple web apps, **When** a maintainer fixes
   it, **Then** the fix is released from one package owner rather than copied
   into each app.
2. **Given** one web app has not adopted a package release, **When** another app
   upgrades, **Then** the first app's installed package version and behavior stay
   unchanged.
3. **Given** a shared package change is breaking, **When** it is released, **Then**
   its major version identifies the breaking adoption boundary.
4. **Given** app-specific `platform` code differs between web apps, **When** the
   repositories are prepared, **Then** that code remains local to its app unless
   a later decision creates a stable shared package.

---

### User Story 4 - API contracts are explicit across repository boundaries (Priority: P1)

A web or service consumer can depend on a published API contract version instead
of reading provider source or guessing response fields. A provider can add
compatible capabilities without breaking existing consumers, and a breaking
change has a visible migration path.

**Why this priority**: The services communicate over HTTP, and a typecheck inside
one repository cannot detect a renamed field in another repository.

**Independent Test**: Generate a client from one service's published OpenAPI
document, consume it from a web repository, add an optional provider field, and
verify the existing consumer remains valid. Then model a breaking response change
and verify that it requires a new major contract/client version.

**Acceptance Scenarios**:

1. **Given** a service publishes an HTTP contract, **When** a consumer installs
   its generated client, **Then** the client version identifies the provider
   contract version it supports.
2. **Given** an additive endpoint or optional response field, **When** the
   provider releases it, **Then** existing consumers remain valid and the change
   can use a minor version.
3. **Given** a removed, renamed, or semantically incompatible endpoint or field,
   **When** the provider releases it, **Then** the breaking change uses a major
   version and preserves a migration path for existing consumers.
4. **Given** a service-to-service adapter consumes a generated contract, **When**
   the response crosses the adapter boundary, **Then** the service still maps it
   to its own narrow read model rather than leaking provider types into domain
   code.

---

### User Story 5 - One gateway deploys independently released artifacts (Priority: P1)

A platform operator deploys web and service artifacts from pinned releases through
one public entry point. The gateway does not need a checkout of every web source
repository, and a route change cannot silently disagree with the web release that
declares it.

**Why this priority**: The current gateway generator imports routing manifests from
sibling web folders. That source-level coupling would break when web repositories
separate.

**Independent Test**: Deploy the infrastructure repository with pinned web image
versions, service image versions, and routing manifests. Verify each hostname
serves its own web app and API paths route only to declared services. Update one
web image without building the other web images.

**Acceptance Scenarios**:

1. **Given** a web release includes its routing manifest, **When** the gateway
   configuration is generated, **Then** generation consumes the versioned
   manifest artifact rather than importing web source files.
2. **Given** an app declares an API prefix for a service, **When** the gateway is
   deployed, **Then** that prefix reaches the declared service through the same
   public origin as the app.
3. **Given** an app does not declare a service route, **When** a request targets
   that service through the app origin, **Then** the gateway refuses it rather
   than forwarding it accidentally.
4. **Given** one web image or one service image is replaced, **When** the gateway
   reloads or routes traffic, **Then** unrelated artifacts remain on their pinned
   versions.
5. **Given** the identity refresh cookie is same-site and origin-scoped, **When**
   a user signs in through any web hostname, **Then** that hostname continues to
   serve both the SPA and its API paths.

---

### User Story 6 - Repository initialization starts from an approved snapshot (Priority: P2)

A maintainer can inspect the complete repository map, ownership rules, release
contracts, and migration instructions before creating Git repositories or adding
remotes. The initial repositories do not inherit accidental history from the
current filesystem snapshot.

**Why this priority**: The current workspace has no Git metadata, so initialization
is an irreversible boundary decision and must not happen before preparation is
complete.

**Independent Test**: Review the preparation checklist against every current
folder and file, confirm each item has one target owner, and verify the cutover
procedure explicitly stops before `git init` until the checklist is accepted.

**Acceptance Scenarios**:

1. **Given** the preparation checklist is incomplete, **When** a maintainer runs
   the documented preparation flow, **Then** repository initialization is not
   attempted.
2. **Given** every file has an owner and every cross-repository contract has a
   release rule, **When** the maintainer approves the cutover, **Then** each target
   repository can be initialized from the clean snapshot.
3. **Given** the clean-snapshot policy is selected, **When** the target repositories
   are initialized, **Then** old Git history is not imported.

### Edge Cases

- A web app uses only identity and one domain service; its release must not pull
  unrelated service clients or gateway routes.
- Several web apps consume one service API; a breaking contract must preserve an
  old compatible version until all consumers migrate.
- A shared package has a feature used by only one web app; the package remains
  shared only if its ownership and release surface are still clear; otherwise the
  feature stays app-local.
- A web app needs a package version newer than another app can adopt; each app
  pins its compatible version rather than forcing a synchronized release.
- A web release publishes an invalid or incomplete routing manifest; the gateway
  preparation must fail before deployment rather than generate a partial config.
- A routing manifest names a service with no declared gateway upstream; validation
  must fail with the missing service name.
- A service image is healthy while its API client package is stale; consumer CI
  must detect the contract/package mismatch before promotion.
- A web image is rolled back while its routing manifest is unchanged; the gateway
  must continue routing the same API prefixes to the selected web release.
- A service not used by any current web app is still needed by another service;
  web dependency filtering must not remove the service from the services runtime.
- A shared package registry or image registry is unavailable; release workflows
  must fail without publishing a partially described release.
- The current workspace contains root-level files with no target owner; readiness
  must remain false until each such file is assigned to `241-platform-infra`,
  `241-services`, `241-web-packages`, or a specific web repository.

## Requirements *(mandatory)*

### Functional Requirements

#### Repository boundaries

- **FR-001**: The migration MUST define exactly ten target repositories with the
  names and ownership in the target repository table.
- **FR-002**: Each web repository MUST contain exactly one web application and its
  app-specific source, tests, configuration, documentation, version, changelog,
  and release workflow.
- **FR-003**: A web repository MUST NOT require source checkout from another web
  repository to develop, validate, build, release, or deploy its application.
- **FR-004**: `241-services` MUST contain all nine services while preserving each
  service's runtime boundary, configuration boundary, database ownership, and
  migration ownership.
- **FR-005**: A service MUST NOT import source code from another service. HTTP
  contracts and published clients are the only cross-service source boundary.
- **FR-006**: `241-web-packages` MUST own the publishable shared frontend packages
  `@241/ui` and `@241/web-shared`, using the latest `admission-web` package
  trees as their canonical baseline. `reference-data` is not a publishable
  package in this migration.
- **FR-007**: Web repositories MUST consume shared packages by published semantic
  version and MUST NOT retain copied source trees for packages owned by
  `241-web-packages`.
- **FR-008**: App-specific `platform` code MUST remain in the relevant web
  repository until a separate decision establishes a stable package contract.

#### Versioning and contracts

- **FR-009**: Each web application MUST have an independent semantic version,
  changelog, immutable release artifact, and rollback target.
- **FR-010**: Each service MUST have an independent semantic version, changelog,
  immutable runtime image, database migration stream, and rollback target even
  though services share `241-services`.
- **FR-011**: `241-web-packages` MUST support independent semantic releases for
  each publishable package. A package release MUST NOT force an application
  release until that application adopts the package.
- **FR-012**: Each service MUST publish an OpenAPI contract and a generated client
  package with a version that identifies the compatible HTTP contract.
- **FR-013**: Generated API clients MUST be used at repository boundaries only.
  Service adapters MUST map provider payloads to local narrow read models before
  domain or application code consumes them.
- **FR-014**: API contract versioning MUST classify additive endpoints and
  optional fields as compatible changes, and removed, renamed, or incompatible
  behavior as breaking changes requiring a major version.
- **FR-015**: Existing internal routes MUST NOT be bulk-renamed to add a major URL
  prefix solely for this migration. A major URL version MUST be introduced only
  when an actual breaking compatibility boundary requires it.
- **FR-015a**: Pre-production project and package baselines MUST remain at
  `0.1.0`; the first stable production release MUST use `1.0.0`, after which
  all increments follow the declared SemVer compatibility rules.

#### API Gateway and deployment

- **FR-016**: `241-platform-infra` MUST own the public API Gateway, deployment
  definitions, environment wiring, service upstreams, web upstreams, and
  routing-manifest validation.
- **FR-017**: The current Nginx edge MUST remain the API Gateway for this feature.
  The migration MUST NOT add a NestJS BFF, response aggregator, or business logic
  layer to the gateway.
- **FR-018**: Each web repository MUST publish an immutable runtime artifact that
  can be deployed independently behind the API Gateway without a bind-mounted
  source `dist` directory from a combined workspace.
- **FR-019**: Each web release MUST publish a versioned routing manifest containing
  the API prefixes, health routes, and gateway metadata required for that app.
- **FR-020**: Gateway generation MUST consume pinned routing-manifest releases and
  MUST NOT import `api-routes.config.ts` or any other source file from a sibling
  web repository.
- **FR-021**: The API Gateway MUST preserve one public origin per web app for its
  SPA and API paths so same-site authentication behavior remains valid.
- **FR-022**: The gateway MUST refuse a route that is declared by an app but has no
  declared service upstream, and MUST refuse an app API prefix that no service
  owns.
- **FR-023**: Deployment definitions MUST pin web and service artifacts by
  immutable release identity. Deploying one artifact MUST NOT require rebuilding
  unrelated artifacts.
- **FR-024**: Service-to-service traffic MUST remain on the private service
  network and MUST NOT be routed through the public API Gateway.

#### CI, ownership, and initialization

- **FR-025**: Each target repository MUST have validation that runs only its own
  relevant projects and explicitly affected published dependencies.
- **FR-026**: `241-services` CI MUST support affected-service validation and
  independent release selection without treating the nine services as one
  deployable version.
- **FR-027**: Every current source, documentation, CI, gateway, compose, and
  release file MUST be assigned to exactly one target repository before readiness
  is declared.
- **FR-028**: The topology documents MUST use one consistent definition of
  repository, deployment unit, service, web app, package, and API contract.
- **FR-029**: The preparation MUST begin from the current filesystem snapshot and
  MUST NOT import prior Git history.
- **FR-030**: `git init`, remote creation, initial commits, and pushes MUST remain
  blocked until the preparation checklist is complete and explicitly approved.
- **FR-031**: Private source repositories, package registry access, image registry
  access, and deployment credentials MUST be managed by the selected GitHub
  Organization and MUST NOT be committed to source.

### Key Entities

- **Repository**: An isolated source, review, access-control, CI, and release
  boundary for one web app, the services collection, shared packages, or platform
  infrastructure.
- **Deployment Unit**: A runtime artifact that can be promoted or rolled back
  independently. The services repository contains nine service deployment units;
  each web repository contains one web deployment unit.
- **Shared Package**: A reusable frontend library owned by `241-web-packages` and
  consumed by published semantic version.
- **API Contract**: The published request, response, error, and compatibility
  surface of one service, represented by its OpenAPI document and generated client
  package.
- **Routing Manifest**: A versioned declaration of one web app's host, API
  prefixes, health routes, and gateway metadata.
- **Release Artifact**: An immutable web image, service image, shared package, API
  client package, or gateway configuration release identified by version.
- **Consumer**: A web app or service that uses a shared package, API contract, or
  gateway route owned elsewhere.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every current folder and root-level operational file is assigned to
  exactly one of the ten target repositories, with zero unowned items and zero
  contradictory topology statements.
- **SC-002**: A clean checkout of each of the seven web repositories can be
  developed, validated, built, and packaged without checking out another web
  repository's source.
- **SC-003**: A release changing one web app produces one changed web runtime
  artifact; the other six web runtime artifacts remain byte-for-byte unchanged.
- **SC-004**: A release changing one service produces one changed service runtime
  artifact and, when applicable, its API client package; the other eight service
  runtime artifacts keep their versions and image identities.
- **SC-005**: A shared package patch can be adopted by one web repository through
  one dependency update while at least one other web repository remains on its
  prior package version.
- **SC-006**: Each service contract has one discoverable OpenAPI document and one
  versioned generated client package, and a breaking contract change cannot be
  released without a major compatibility signal.
- **SC-007**: The API Gateway can be generated and validated from `241-platform-infra`
  using pinned routing manifests and artifact identities without a source checkout
  of the seven web repositories.
- **SC-008**: The gateway routes every declared app API prefix to its declared
  service, refuses every undeclared app prefix, and preserves the same-origin SPA
  plus API behavior for all seven web hostnames.
- **SC-009**: A previous web or service release can be selected as a rollback target
  without rebuilding an unrelated web app or service.
- **SC-010**: Git initialization is attempted only after all preparation checks are
  complete and explicitly approved, and the initialized repositories contain no
  imported historical Git commits.

## Assumptions

- The repositories are private and belong to one GitHub Organization.
- GitHub Packages is available as the private npm registry, and the image registry
  is available to the deployment environment.
- GitHub Actions or an equivalent CI system can run per-repository validation and
  publish immutable artifacts.
- The repository names in the target table are accepted as canonical names and
  use `-web` for web apps and `-service` for service names inside the services
  repository.
- The services monorepo uses one root dependency policy and lockfile, while each
  service retains its own Dockerfile, environment contract, Prisma schema, and
  migration history.
- The web package repository uses independent package releases. `platform` is not
  published as one package in the first migration because its contents are
  intentionally app-specific.
- OpenAPI generated clients are owned and published from `241-services`; consumers
  do not import service source code.
- Existing runtime service boundaries, database ownership, authentication
  behavior, and business rules remain unchanged by this repository migration.
- Existing API paths stay compatible during migration. Major URL versioning is
  added only for a real breaking contract, not as a naming exercise.
- The current workspace is a clean source snapshot for migration purposes. No
  historical commits, branches, tags, or remotes need to be preserved.

## Out of Scope

- Rewriting service business logic or changing bounded-context ownership.
- Splitting or merging databases.
- Adding a NestJS BFF, API aggregation layer, service mesh, or event broker.
- Publishing app-specific `platform` code before a separate stable-contract
  decision.
- Migrating every existing endpoint to `/v1`.
- Creating Git remotes, credentials, or production infrastructure before the
  preparation checklist is approved.

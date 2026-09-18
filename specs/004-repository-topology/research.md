# Research: Repository Topology and Independent Releases

**Date**: 2026-09-15
**Feature**: [spec.md](./spec.md)

## Decision 1: Ten repositories

**Decision**: Use seven web repositories, one services monorepo, one shared web
packages repository, and one platform infrastructure repository.

**Rationale**:

- Web teams need isolated source, review, deployment, and release lifecycles.
- The nine services share operational conventions and contract knowledge, while
  their runtime, database, and migration boundaries remain separate.
- Shared frontend code needs one owner and published versions. Copying it into
  seven web repositories has already produced drift.
- Gateway and deployment files need one owner because they describe the whole
  runtime topology.
- Repository topology is an organizational boundary. Runtime microservice
  boundaries and independent deployment do not require one repository per
  service.

**Alternatives considered**:

- One repository for all projects: technically viable and supported by the
  current root CI, but does not meet the owner's isolated web development goal.
- Seven web repositories plus one services repository with copied shared code:
  rejected because it preserves the current drift mechanism.
- Sixteen repositories: rejected because it duplicates service governance and
  makes shared API and operational changes harder to review.

**Sources**:

- Nx, "Monorepo vs Polyrepo":
  https://nx.dev/docs/kb/monorepo-vs-polyrepo
- Nx, independent project releases:
  https://nx.dev/docs/guides/nx-release/release-projects-independently

## Decision 2: Services monorepo, independent deployment units

**Decision**: Put all nine services under one pnpm workspace, but keep each
  service as an independent package, Docker image, database, migration stream,
  health check, version, and deployment unit.

**Rationale**:

- A single services repository removes duplicated service-level governance files
  and makes cross-service contract changes visible in one pull request.
- Package boundaries and import restrictions preserve the rule that a service
  cannot import another service's source.
- pnpm supports workspace package selection and the `workspace:` protocol.
- `pnpm deploy` can create a portable deployment directory for one workspace
  package, so one lockfile does not require one runtime image.

**Alternatives considered**:

- Nine service repositories: stronger repository isolation, but unnecessary for
  the stated team workflow and expensive for shared contracts and governance.
- One deployable backend: rejected. It would remove independent service failure,
  migration, and rollback boundaries.

**Sources**:

- pnpm workspaces and workspace protocol:
  https://pnpm.io/workspaces
- pnpm deploy, version 11 documentation:
  https://pnpm.io/11.x/cli/deploy
- pnpm Docker guidance:
  https://pnpm.io/docker

## Decision 3: GitHub Packages for shared packages

**Decision**: Publish `@241/ui` and `@241/web-shared` from `241-web-packages`
to GitHub Packages. Use the latest `admission-web` package trees as the
canonical baseline. Web apps
consume exact or bounded semantic versions and never retain copied source for
these packages.

**Rationale**:

- A published package gives each web team controlled adoption rather than an
  automatic synchronized change.
- `admission-web` contains the latest adjusted `packages/shared` and
  `packages/ui` trees. Its `packages/platform` remains app-specific, and it has
  no `packages/reference-data` package. A package registry gives only the
  stable shared trees one owner.
- GitHub Packages is already compatible with the selected GitHub organization,
  private package requirement, and GitHub Actions.
- Package names remain scoped and lowercase, as required by the registry.

**Alternatives considered**:

- Keep copying files: rejected because drift is already measured.
- Git submodules: rejected because submodule pinning and local development add
  source-control coupling without package semantics.
- A private npm registry other than GitHub Packages: viable, but adds a second
  platform to the selected GitHub workflow.

**Sources**:

- GitHub Packages npm registry:
  https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry
- Turborepo internal packages:
  https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/core-concepts/internal-packages.mdx

## Decision 4: Keep app-specific platform code local

**Decision**: Publish only stable shared frontend packages. Keep each app's
`packages/platform` code inside its web repository for the first migration.

**Rationale**:

- The current `platform` trees differ in size and content because each app keeps
  only the features it reaches.
- Publishing the entire platform would force unrelated consumers to depend on
  unused features and would create a large, unstable package surface.
- Shared code can be extracted later when a stable interface and common release
  cadence exist.

**Alternatives considered**:

- Publish the entire platform: rejected as a premature common package.
- Keep all package trees copied: rejected for `ui` and `shared`; accepted for
  intentionally app-specific platform code and any reference-data code still
  used locally by other apps.

## Decision 5: Changesets for independent package and service releases

**Decision**: Use Changesets in `241-services` and `241-web-packages`, with
independent versions. Use the same release mechanism in each single-web
repository to version its private application package and create the image
release. Configure private packages to be versioned and tagged without being
published as npm packages.

**Rationale**:

- Changesets supports pnpm workspaces and independent release cycles.
- `privatePackages.version` and `privatePackages.tag` allow private service and
  application packages to carry semantic versions and tags while only actual
  library packages publish to GitHub Packages.
- A single mechanism is easier to operate than mixing a custom script, a
  monorepo release tool, and a separate web release tool.
- Image publication remains a separate step keyed by the version tag.

**Alternatives considered**:

- Existing `scripts/release.mjs`: useful as a temporary reference, but it assumes
  one root Git history and cannot coordinate published package dependencies.
- Fixed versions for all services: rejected because service deployment units must
  release independently.

**Sources**:

- Changesets monorepo support and configuration:
  https://github.com/changesets/changesets
- Changesets private package configuration:
  https://github.com/changesets/changesets/blob/main/site/guide/configuring.md

## Decision 6: Generated API client per service

**Decision**: Generate one versioned client package per service from its emitted
OpenAPI document. Use `openapi-typescript` for generated types and
`openapi-fetch` for the typed transport. Publish clients from `241-services` as
`@241/api-<service>` packages.

**Rationale**:

- Current service-to-service and browser clients are handwritten, so a renamed
  response field can compile in both repositories and fail only at runtime.
- `openapi-typescript` creates runtime-free TypeScript types directly from local
  JSON or YAML. `openapi-fetch` binds those types to request paths, parameters,
  bodies, and responses.
- The generated package becomes the explicit boundary. Consumers still map
  provider payloads to local read models at their adapters.
- No Java, native compiler, or separate API server is required for generation.

**Alternatives considered**:

- Copy service DTOs into web repositories: rejected because it recreates drift.
- Import service source types: forbidden by the service boundary rule.
- Full OpenAPI Generator: viable, but heavier than the current TypeScript-only
  stack for this platform.

**Sources**:

- openapi-typescript overview:
  https://github.com/openapi-ts/openapi-typescript
- openapi-typescript generation:
  https://github.com/openapi-ts/openapi-typescript/blob/main/docs/introduction.md
- openapi-fetch typed client:
  https://github.com/openapi-ts/openapi-typescript/blob/main/docs/openapi-fetch/index.md

## Decision 7: Nginx remains the public API Gateway

**Decision**: Keep the current Nginx edge as the public API Gateway. Move its
configuration and deployment definitions to `241-platform-infra`. Replace direct
imports of sibling web source with validated, pinned routing-manifest artifacts.

**Rationale**:

- Nginx already routes service prefixes, health paths, unrouted paths, static
  files, and SPA fallbacks.
- The current service-to-browser path is same-origin per web hostname. Keeping
  SPA and API paths behind one hostname preserves the host-only refresh cookie and
  avoids adding a CORS dependency to every browser request.
- A new NestJS BFF would add application logic, another deployment unit, and a
  new failure surface without a requirement for response aggregation.
- Artifact-based routing lets infra deploy without checking out seven web source
  repositories.

**Alternatives considered**:

- NestJS API Gateway/BFF: rejected because no aggregation or gateway business
  logic is required.
- Public API hostname plus separate web hosts: rejected for the current
  host-only, same-site authentication behavior.
- Keep source imports in the gateway: rejected because it breaks the repository
  boundary and makes deployment non-reproducible.

**Sources**:

- Nginx `location` documentation:
  https://nginx.org/en/docs/http/ngx_http_core_module.html#location
- Nginx `proxy_pass` documentation:
  https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
- Docker Compose service reference:
  https://docs.docker.com/reference/compose-file/services/
- Docker user-defined networks:
  https://docs.docker.com/engine/network/

## Decision 8: Immutable image and manifest deployment

**Decision**: Web and service repositories publish container images to GHCR. The
infra repository pins image digests and routing-manifest checksums in a
deployment lock. Production does not build from source or mount a local `dist`
directory.

**Rationale**:

- A digest identifies exactly what is running and makes rollback deterministic.
- The current production Compose file builds services from sibling folders and
  mounts seven web `dist` folders, which is incompatible with separate web
  repositories.
- Stable Docker service names and one external network preserve Nginx DNS routing
  when a service is recreated.
- The existing `resolve` plus `zone` behavior remains useful for container IP
  replacement.

**Alternatives considered**:

- Build on the deployment host: rejected because source checkout and toolchain
  state would become part of production.
- Mutable `latest` tags: rejected because rollback identity is lost.
- One web image containing every SPA: rejected because it defeats independent web
  deployment.

## Current workspace facts used by this research

- Seven web apps and nine services exist in the snapshot.
- No Git metadata exists at the root, any project folder, or its parent folders.
- Each current project has its own package manifest, lockfile, and workspace file.
- The root CI uses a 16-folder matrix, while the documents still contain older
  separate-repository language.
- `infra/nginx/generate.mjs` imports seven sibling `api-routes.config.ts` files.
- Production Compose mounts seven local web `dist` directories and builds nine
  services from local source.
- Every service emits OpenAPI, but `openapi.json` is ignored and generated client
  packages do not exist.
- `packages/shared` is byte-identical in all seven apps. `packages/ui` is
  byte-identical in five, with app-specific drift in two. `packages/platform` is
  intentionally app-specific.
- The current services use Node 24.20.0, pnpm 11.25.0, NestJS 12, Prisma 7,
  TypeScript 5.9, and PostgreSQL.

## Resolved plan risks

- `pnpm deploy` exists in the pinned pnpm 11.25.0 installation. The plan includes
  a disposable-image check because workspace deploy behavior must be proven with
  the final package graph before deleting per-project lockfiles.
- GitHub Packages requires scoped lowercase package names and registry access. No
  token is stored in source; Actions uses `GITHUB_TOKEN` with package permissions
  after package-repository access is granted.
- Same-origin authentication does not require one web repository. It requires
  each web hostname to serve its SPA and its API routes through the same edge
  origin.
- Service-to-service calls stay on the private Docker network and never pass
  through the public gateway.

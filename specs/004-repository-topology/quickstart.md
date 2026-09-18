# Quickstart: Prepared Repository Topology

This guide validates the migration without Git, GitHub credentials, remotes, or
production deployment. Commands run from the workspace root unless stated.

## Current snapshot

The current source folders remain unchanged. Prepared repository roots are created
under `prepared-repos/`.

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
├── 241-web-packages/
└── 241-platform-infra/
```

No `.env` file, credential, private key, certificate, `node_modules`, `dist`, or
local generated output may enter a prepared root.

## Web repository check

```bash
cd prepared-repos/241-academic-web
corepack pnpm install --frozen-lockfile
corepack pnpm run validate
```

Repeat for each `241-*-web` repository. A clean web checkout must not need a
sibling web directory. Until package extraction is complete, the prepared
snapshot may fail this check and must be marked `BLOCKED`, not treated as green.

## Services repository check

```bash
cd prepared-repos/241-services
corepack pnpm install --frozen-lockfile
corepack pnpm --filter academic-service run validate
corepack pnpm --filter academic-service run openapi:emit
```

Run the same commands for each service. `openapi.json` must be copied into
`contracts/<service>/openapi.json` after generation. No service may import
`../<other-service>/src` or any provider service source path.

## Shared package check

```bash
cd prepared-repos/241-web-packages
corepack pnpm install --frozen-lockfile
corepack pnpm run check
corepack pnpm pack --pack-destination .artifacts
```

Install each tarball into a disposable consumer. Verify package exports resolve
without the package repository being present.

## Routing manifest check

```bash
cd prepared-repos/241-platform-infra
node gateway/generate.mjs --check
```

The generator must read JSON artifacts under `gateway/manifests/`, validate them
against the local schema and deployment lock, then validate generated Nginx
configuration. It must not import `api-routes.config.ts` from a web repository.

## Deployment check

```bash
cd prepared-repos/241-platform-infra
docker compose -f compose/docker-compose.staging.yml config
```

Production definitions must reference image digests. They must not use `build:`
for application images or bind-mount web `dist` directories.

## Package registry check

Local preparation uses package tarballs. Registry verification happens only after
GitHub Packages access is configured by the owner:

```text
@241:registry=https://npm.pkg.github.com
```

Do not put an auth token in repository files. GitHub Actions uses its granted
`GITHUB_TOKEN` permissions.

## Acceptance scenarios

1. Change only one prepared web app. Its validation and image build do not read
   another web source tree.
2. Change only one service. Its validation and image packaging do not alter an
   unrelated service's package, migration stream, or version.
3. Upgrade one shared package in one disposable web consumer. Another consumer
   keeps its prior tarball/version.
4. Add an optional OpenAPI field. Existing generated client consumers remain
   type-valid.
5. Remove or rename an OpenAPI field. Client compatibility validation requires a
   major release signal.
6. Replace one web or service digest in a staging deployment lock. Other digest
   values remain unchanged.
7. Remove a required manifest or change its checksum. Gateway preparation fails
   before configuration generation.

## Explicit stop

The preparation workflow originally stopped before `git init`, remote creation,
push, package publication with real credentials, and production deployment. The
owner has now authorized local snapshot initialization: all ten target roots have
a clean `main` commit. Remote creation and push remain pending until the exact
GitHub URLs and credentials are available; package publication and production
deployment remain blocked by registry access and reviewed image digests.

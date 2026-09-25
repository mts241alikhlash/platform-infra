# Repository Topology Readiness Report

**Date:** 2026-09-16

## Decision

The approved target remains ten repositories:

- seven independent web repositories, one application per repository;
- one `241-services` monorepo containing nine independently deployable
  services, nine generated API clients, and nine tracked OpenAPI contracts;
- one `241-web-packages` repository for `@241/ui` and `@241/web-shared`;
- one `241-platform-infra` repository for the gateway and deployment wiring.

The repository boundary is separate from the runtime boundary. The nine
services keep independent versions, images, migrations, databases, and release
selection inside the services monorepo.

## Verified evidence

- Prepared topology contains 10 target roots, 7 web applications, 9 services,
  9 API client packages, 2 shared frontend packages, and 9 contract baselines.
- `241-services` tracks all nine `contracts/<service>/openapi.json` files and
  all nine `packages/api-*/src/generated.ts` files.
- The nine-service serial validation gate passed 480 test suites and 3,143
  tests, plus format, lint, typecheck, strict lint, build, OpenAPI, and API
  client checks for every service. Serial Prisma generation prevents shared
  pnpm-store client output from colliding between sibling services.
- Six web repositories (`academic`, `admin`, `assessment`, `hr`, `inventory`,
  and `portal`) passed their full frozen-install validation. Their test totals
  are 110 files and 826 tests; all seven routing manifest checks passed.
- The Inventory service validation specifically recorded 71 passing suites and
  407 passing tests, followed by a successful Nest build and OpenAPI emission.
- Gateway self-check and generated Nginx checks passed. Both Compose files parse
  with 17 services and contain no application `build:`, `/dist` mount, or bridge
  network pattern.
- Staging deployment-lock validation passed; production validation rejects the
  deliberate image-digest placeholders. Both staging and production Compose
  files parse successfully.
- The nine OpenAPI baselines and nine generated clients are included in the
  initial `241-services` snapshot commit.
- The service contract-version check now confirms all nine service package
  versions and all nine API client versions are valid SemVer, and every tracked
  OpenAPI `info.version` matches its provider service version.
- All nine web/package validation workflows now require a Changeset for
  release-relevant pull-request changes while ignoring documentation and
  CI-only changes.
- Service pull-request validation additionally classifies breaking OpenAPI
  changes and requires `major` Changesets for both the provider service and its
  generated API client; compatible additions remain eligible for normal review.
- All 20 repository workflow YAML files parse successfully, and all nine
  Changeset guards pass their self-checks. Admission's existing GitHub Packages
  authentication and permission ordering was also verified.

## Development and production version policy

The prepared repositories intentionally remain on `0.1.0` for development and
pre-production validation. No `1.0.0` bump is made in this snapshot. The first
production release may move each stable public project or contract to `1.0.0`
independently; subsequent patch, minor, and major releases follow the
compatibility rules in the contract documents.

The services validation workflow provides non-secret test-only environment
defaults so boot and route tests are reproducible in CI. These values are not
production credentials or deployment configuration.

## Open gates

### T029 — production image identity

The Compose structure is image-only, but production references still use
`@sha256:REPLACE_BEFORE_DEPLOYMENT`. The production lock validator rejects this
until reviewed GHCR release digests are supplied. A local or fabricated digest
would not be a deployable release identity.

### T031 — clean-checkout and runtime smoke

Admission web cannot perform a frozen install because its manifest adds
`@241/ui@0.1.0` and `@241/web-shared@0.1.0` while its lockfile lacks them and
still records `@changesets/cli` 2.x. Its workflows already configure
`packages: read` and `GITHUB_TOKEN` before installation, but the private
registry still needs published package artifacts and an owner-authorized
consumer repository before the lockfile can be regenerated honestly.
Runtime smoke also requires real images, the private network, service
databases, and TLS certificates.

### T030 — category migration scope

The category-layering checklist is complete, but the original service snapshot
had no Git history. The current services monorepo has a clean snapshot commit,
not a pre-migration parent commit, so a historical `git diff --stat` cannot
prove the category-only scope.

### T032 — GitHub remotes and push

All ten target roots have a local `main` commit and no configured remote. Exact
GitHub repository URLs and authenticated push access are still required.

## Cutover status

No remote has been added and no push has been attempted. Production deployment
and package publication remain intentionally blocked until their external
release inputs are reviewed.

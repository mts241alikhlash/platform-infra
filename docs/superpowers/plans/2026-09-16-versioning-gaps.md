# Versioning Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the development versioning workflow internally consistent and prevent release-relevant changes from merging without a Changeset, while leaving production-only registry and image promotion values for the real release environment.

**Architecture:** Keep `0.1.0` as the pre-production baseline. Each web repository and each service/API-client package remains independently versioned; Changesets drives version/tag generation, and `241-platform-infra` consumes immutable image digests. Add only local validation and CI guards that enforce the existing contracts.

**Tech Stack:** Node.js 24, pnpm 11, Changesets, GitHub Actions, NestJS Swagger/OpenAPI, Docker image digests.

**Spec:** `specs/004-repository-topology/spec.md` and `specs/004-repository-topology/contracts/release-and-ci.md`.

## Global Constraints

- Development artifacts remain on `0.1.0` until the first stable production release.
- `1.0.0` is reserved for the first production release whose public API contract is declared stable.
- Services remain nine sibling projects inside `241-services`; they are not split into nine Git repositories.
- Public API clients and shared packages use independent semantic versions and are published only to the configured private registry.
- Production Compose and deployment locks must use real image digests; placeholders must not be replaced with fabricated values.
- No consumer dependency is changed to a local `file:` path to hide missing GitHub Packages artifacts.

---

### Task 1: Enforce service/OpenAPI version identity

**Files:**
- Create: `prepared-repos/241-services/scripts/check-contract-versions.mjs`
- Modify: `prepared-repos/241-services/scripts/emit-openapi.mjs`
- Modify: `prepared-repos/241-services/package.json`
- Modify: `prepared-repos/241-services/.github/workflows/validate.yml`
- Modify: `prepared-repos/241-services/services/inventory-service/src/openapi/swagger-config.ts`

**Interfaces:**
- `check-contract-versions.mjs` reads each `services/*/package.json` and its tracked `contracts/<service>/openapi.json` and exits non-zero when either version is invalid SemVer or the contract `info.version` differs from the service package version.
- `emit-openapi.mjs --check` rejects a generated document whose `info.version` differs from the service package version before comparing it with the tracked contract.

- [X] **Step 1: Add the failing contract-version check.**
- [X] **Step 2: Run `node scripts/check-contract-versions.mjs` and confirm it reports `inventory-service` (`1.0` versus `0.1.0`).**
- [X] **Step 3: Change Inventory Swagger configuration to use `process.env.OPENAPI_VERSION ?? '0.1.0'`.**
- [X] **Step 4: Add the generated-document assertion and the `version:check` package script.**
- [X] **Step 5: Run `pnpm run version:check`, `pnpm run openapi:check`, and the service API/build gate.**
- [X] **Step 6: Commit the service-repository change.**

### Task 2: Require Changesets for release-relevant pull requests

**Files:**
- Create: `.github/scripts/require-changeset.mjs` in `241-services`, `241-web-packages`, and all seven web repositories.
- Modify: `.github/workflows/validate.yml` in `241-services`, `241-web-packages`, and all seven web repositories.

**Interfaces:**
- The script accepts `<base-sha> <scope>` where scope is `services`, `packages`, or `app`.
- It ignores documentation, specs, Changeset README, and CI-only changes; it exits non-zero when release-relevant files changed without a non-README `.changeset/*.md` file in the pull request diff.
- The workflow runs the guard only for pull requests, so a Changesets-generated release commit is not treated as a new product change.

- [X] **Step 1: Add self-check expectations for release and non-release file sets.**
- [X] **Step 2: Run each new script with `--self-check` and confirm the pre-implementation command fails because the script is absent.**
- [X] **Step 3: Implement the smallest standard-library-only guard and run all self-checks.**
- [X] **Step 4: Add the pull-request guard step to all nine validation workflows.**
- [X] **Step 5: Run YAML/format checks and validate that the existing service/web gates remain unchanged.**
- [X] **Step 6: Commit each repository's CI change.**

### Task 3: Verify private package consumer authentication

**Files:**
- Inspect: `prepared-repos/241-admission-web/.github/workflows/validate.yml`
- Inspect: `prepared-repos/241-admission-web/.github/workflows/release.yml`

**Interfaces:**
- Admission CI grants `packages: read` and configures the GitHub Packages token before the first frozen install.
- Admission release jobs retain `packages: write` where publishing occurs and configure the same token before dependency resolution.
- The current workflows already satisfy this contract, so no workflow edit is required; publication and lock regeneration remain external prerequisites.

- [X] **Step 1: Inspect that the auth step precedes every `pnpm install` and that the required package permission exists.**
- [X] **Step 2: Verify the current workflows; no missing authentication ordering remains.**
- [X] **Step 3: Confirm no permission/token edit is necessary because the existing workflows already provide it.**
- [X] **Step 4: Re-run the workflow inspection and local manifest/lock consistency check.**
- [X] **Step 5: Record GitHub Packages publication/authentication as the remaining external prerequisite.**

### Task 4: Update versioning policy and readiness evidence

**Files:**
- Modify: `specs/004-repository-topology/contracts/release-and-ci.md`
- Modify: `specs/004-repository-topology/readiness-report.md`
- Modify: `specs/004-repository-topology/tasks.md`

- [X] **Step 1: Document the `0.1.0` development baseline and `1.0.0` stable-production boundary.**
- [X] **Step 2: Record the local fixes and the remaining external blockers: remotes, package publication, real image digests, and runtime smoke tests.**
- [X] **Step 3: Run the final ten-repository cleanliness, contract, CI-script, and build verification gates.**
- [X] **Step 4: Update the workspace-owned documentation; repository-local implementation commits are complete.**

### Task 5: Make service validation deterministic

**Files:**
- Modify: `prepared-repos/241-services/.github/workflows/validate.yml`

- [X] Serialize Prisma generation and service gates so sibling services cannot
  overwrite the shared generated Prisma client output.
- [X] Add non-secret test-only environment defaults required by service boot and
  route tests.
- [X] Run all nine service validation loops successfully.

### Task 6: Enforce breaking contract release signals

**Files:**
- Create: `prepared-repos/241-services/scripts/check-contract-compatibility.mjs`
- Modify: `prepared-repos/241-services/.github/workflows/validate.yml`

- [X] Detect removed paths/operations, removed parameters or response fields,
  required request additions, and incompatible schema changes.
- [X] Require `major` Changesets for both the provider service and generated API
  client when a breaking OpenAPI change is detected.
- [X] Run the compatibility self-check and current-base validation successfully.

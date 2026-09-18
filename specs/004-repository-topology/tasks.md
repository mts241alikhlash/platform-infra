# Tasks: Repository Topology and Independent Releases

Tasks describe preparation work executable without Git. `[P]` means no shared
write target and may run in parallel. All tasks below must be checked only after
their verification command or evidence exists.

## Phase 0: Preparation documents

- [X] T001 Create `research.md`, `data-model.md`, and all repository boundary contracts.
- [X] T002 Create `quickstart.md` with clean-checkout and deployment acceptance scenarios.
- [X] T003 Create `plan.md` with constitution re-check, architecture, phases, and verification.
- [X] T004 [P] Resolve repository ownership for every current app, service, package, gateway, deployment, and root operational path.
- [X] T005 [P] Record the no-history and no-Git-initialization gate.

## Phase 1: Filesystem snapshot

- [X] T006 Create `prepared-repos/` staging root without creating Git metadata.
- [X] T007 Copy seven web app snapshots into canonical `241-*-web` roots, excluding local secrets and generated dependencies.
- [X] T008 Copy nine service snapshots into `241-services/services/<service>` roots, excluding local secrets and generated dependencies.
- [X] T009 Create `241-services`, `241-web-packages`, and `241-platform-infra` root metadata.
- [X] T010 Create a machine-readable ownership manifest and snapshot summary.
- [X] T011 Verify prepared roots contain no `.env`, private key, certificate, `node_modules`, or ignored build output.

## Phase 2: Boundary metadata

- [X] T012 Create service workspace metadata with `services/*` and `packages/*` globs.
- [X] T013 Create package workspace metadata for `@241/ui` and `@241/web-shared`, using `admission-web` as baseline.
- [X] T014 Create API client package manifests and contract directory placeholders for nine services.
- [X] T015 Create routing-manifest schema, manifest directory, upstream registry, and deployment-lock templates.
- [X] T016 Create image-only Compose template for infra staging validation.
- [X] T017 Create per-repository README files that point to ownership, quickstart, and stop gates.

## Phase 3: Validation

- [X] T018 Validate prepared directory count and canonical repository names.
- [X] T019 Validate nine service names, nine API client names, seven web names, and two active shared package names.
- [X] T020 Validate ownership manifest has no duplicate target owner for top-level source roots.
- [X] T021 Validate routing manifest schema and deployment lock templates with native Node JSON parsing.
- [X] T022 Validate no Git metadata was created anywhere under `prepared-repos/` during the preparation phase before cutover.
- [X] T023 Run gateway source check and report current source-import blocker if migration generator is not yet artifact-driven.
- [X] T024 Record remaining implementation blockers instead of claiming application migration is complete.

## Phase 4: Deferred until cutover approval

- [X] T025 Extract canonical shared package source from `admission-web` into `241-web-packages`; keep `reference-data` app-local because it is absent from the baseline.
- [X] T026 Replace `241-admission-web` aliases and copied package source with `@241/ui` and `@241/web-shared` package dependencies; registry adoption remains pending publication.
- [X] T027 Generate and commit nine OpenAPI baselines and API client outputs.
- [X] T028 Replace gateway source imports with released routing artifacts.
- [ ] T029 Replace production Compose source builds and web `dist` mounts with immutable image references.
- [X] T030 Add repository-local CI and Changesets release workflows.
- [ ] T031 Run all clean-checkout builds and runtime smoke tests.
- [ ] T032 Configure the exact GitHub remotes and push the already-approved local `main` snapshots; local initialization and snapshot commits are complete, but URLs and authenticated access remain external inputs.
- [X] T033 Align provider OpenAPI metadata with service package versions and add a contract-version validation gate.
- [X] T034 Require a Changeset for release-relevant pull-request changes in every application/package repository.
- [X] T035 Document the `0.1.0` development baseline and `1.0.0` stable-production boundary, including external release blockers.
- [X] T036 Make service validation deterministic by serializing Prisma generation per service and supplying non-secret CI test configuration; verify all nine services, six installable web apps, shared packages, gateway, and Compose checks.
- [X] T037 Enforce a major Changeset for breaking OpenAPI changes on both the provider service and generated API client, with a standard-library compatibility self-check.

---

description: "Task list for Public Sign-Up Dialog with Google Sign-Up"
---

# Tasks: Public Sign-Up Dialog with Google Sign-Up

**Input**: Design documents from `/specs/002-public-signup-google/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: The constitution (Principle V) requires a `*.spec.ts` for every new
use case, and the workspace test-first rule applies. Test tasks are included for
new/changed backend use cases and adapter logic, and for the SPA's callback and
dialog logic. They are grouped into a **foundation-blocking "TDD" set per story**
where the code is new; the repository refactor is explicitly refactor-only with
no added specs.

**Organization**: Tasks are grouped by user story. Story phases are ordered US3
→ US1 → US2 for *implementation* because the front-end wave lock and the wave
resolution share the same service change, but MVP and priority order is US1.
The dependency graph below states this precisely.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3
- Every task names its exact file path

## Path Conventions

Three repositories, all siblings under the workspace root:

- `identity-service/` — NestJS 12, Jest
- `admission-service/` — NestJS 12, Jest
- `admission-web/` — Vue 3 + Vite, Vitest

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the three repositories build and are on a clean branch before
any change. No new project, no new dependency.

- [X] T001 Confirm `pnpm prisma:generate` succeeds in `identity-service/` and `admission-service/`, and `pnpm validate` is green in all three repositories on the current `main`, so the baseline is known-good
- [X] T002 [P] Create the feature branch `002-public-signup-google` in `identity-service/`, `admission-service/`, and `admission-web/`
- [X] T003 [P] Create `specs/002-public-signup-google/tasks.md` sanity check: confirm `quickstart.md` scenarios S1–S10 are the acceptance script and note them for the Polish phase

**Checkpoint**: Baseline green; three branches cut.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pieces every story leans on — the repository split that makes
room for new methods, and the shared sign-up-intent plumbing. Nothing here is
user-visible.

**CRITICAL**: No user story work may begin until this phase is complete.

### 2a. admission-service — split the over-budget repository (refactor-only)

`prisma-admission-applicant.repository.ts` is 290 lines, over the Principle V
200-line repository budget, and every story adds methods to it. Split first, as
its own commit, changing structure and nothing else (Principle V: a refactor
commit changes structure only).

- [X] T004 [P] Extract the read methods (`findAll`, `findById`, `findByUserId`, `findByRegistrationNumber`, `findOpenWave`, `findActiveWaves`, `findActiveDocumentTypes`, `findPublishedAnnouncementsForUser`, `findMyApplication`, `findMyDetail`, `findDetailById`, `findRequiredActiveDocumentTypes`) into `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.reader.ts` as a plain class taking `PrismaService` + `IReferenceLookupPort`
- [X] T005 [P] Extract the write methods (`update`, `remove`, `updateMyApplication`, `submitApplication`, `createNotification`) into `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.writer.ts` as a plain class taking `PrismaService`
- [X] T006 Extract the DRAFT-creation sequence shared by `registerApplicant` (and, from T026, `ensureApplication`) into `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.draft.ts`: given a Prisma transaction client, a wave, a userId and the seeded fields, increment `lastRegistrationSeq`, build the registration number, create the application + `UNPAID` payment + welcome notification
- [X] T007 Reduce `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.repository.ts` to a flat contract → call map delegating to the three sibling files, and confirm it is under 200 lines; add `findActiveWave` and `ensureApplication` signatures to `admission-service/src/admission/applicant/domain/repositories/admission-applicant-repository.ts` **without implementations yet** is NOT done here — only the split
- [X] T008 Run `pnpm validate` in `admission-service/` — expect green with **no behavior change** and **no new test files** (Principle V: never add a spec during a refactor)

### 2b. identity-service — sign-up intent plumbing

- [X] T009 [P] Extend `identity-service/src/auth/oauth/oauth-redirect.ts`: encode/decode `{ origin, intent }` as URL-safe base64, treat a bare origin as `{ origin, intent: 'signin' }`, and extend `buildCallbackUrl` to take the outcome (`signup-created` / `signup-existing` / `signup-disabled` / null) and append `oauthOutcome`; for `signup-disabled` target `<origin>/?signup=1`
- [X] T010 [P] Add `GOOGLE_SIGNUP_ENABLED: z.coerce.boolean().default(false)` to `identity-service/src/core/config/env.validation.ts` and document it in `identity-service/.env.example` beside the existing `GOOGLE_*` entries
- [X] T011 Extend `identity-service/src/auth/guards/google-auth.guard.ts` to read `intent` from the query, default it to `signin`, validate it against the allowed set, and pass it into the encoded `state` via the new helper (depends T009)
- [X] T012 Extend `identity-service/src/auth/application/use-cases/oauth-login/oauth-login.input.ts` with `intent: 'signin' | 'signup'`
- [X] T013 Add `roleCode?: string` to `CreateOAuthUserRepositoryInput` and a `findRoleByCode` dependency note in `identity-service/src/auth/domain/repositories/auth.repository.ts`; add `oauthOutcome?: 'signup-created' | 'signup-existing' | 'signup-disabled'` to the use case return contract
- [X] T014 Extend `identity-service/src/auth/infrastructure/persistence/prisma/prisma-auth.repository.ts`: `createUserFromOAuth` writes the `UserRole` row inside the same `prisma.user.create` when `roleCode` is present, resolving the role by `code` and failing the create if unknown
- [X] T015 Register the role lookup wiring in `identity-service/src/auth/auth.module.ts` if the repository needs a new provision, and confirm the module still boots

**Checkpoint**: Repository split is green-only; identity-service can carry an
intent and can create a user with a role. No user-visible behavior changed yet.

---

## Phase 3: User Story 3 — Applicant sees the chosen wave in the form (Priority: P3)

**Goal**: The application form shows the applicant's wave and its academic year as
a locked, uneditable field.

**Independent Test**: Sign in as an applicant whose account exists without an
application, open the form, and confirm the active wave is attached and shown
locked with its academic year; call `/admissions/my-application/ensure` twice and
confirm exactly one application exists.

**Note on ordering**: US3 is implemented before US1 because it owns the
server-side wave resolution and the `ensure` endpoint that US1's password path
and US2's Google path both call. Its *priority* remains P3.

### Tests for User Story 3

- [X] T016 [P] [US3] Extend `admission-service/src/admission/applicant/application/use-cases/admission-applicant.use-cases.spec.ts`: `RegisterApplicantUseCase` with `waveId` absent uses `findActiveWave`; with both absent throws `BadRequestException`
- [X] T017 [P] [US3] Create `admission-service/src/admission/applicant/application/use-cases/ensure-my-application/ensure-my-application.use-case.spec.ts`: existing application returned unchanged; no application + active wave creates one; no application + no wave throws `ConflictException`; the existence read is asserted to run before creation (idempotency-before-uniqueness)

### Implementation for User Story 3

- [X] T018 [US3] Add `findActiveWave(): Promise<AdmissionWaveEntity | null>` and `ensureApplication(input): Promise<ApplicationWithParentsAndUser>` to `admission-service/src/admission/applicant/domain/repositories/admission-applicant-repository.ts`, with their input types declared in that same file (Principle IV)
- [X] T019 [US3] Implement `findActiveWave` (earliest-open active wave, `isActive = true AND deletedAt IS NULL AND startDate <= today <= endDate`, `orderBy startDate asc, take 1`) in `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.reader.ts`
- [X] T020 [US3] Implement `ensureApplication` in `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.writer.ts` using the T006 DRAFT helper; existence read first, then wave resolution, then create (depends T006)
- [X] T021 [US3] Change `admission-service/src/admission/applicant/application/use-cases/register-applicant/register-applicant.input.ts` so `waveId?: string`, and update `register-applicant.use-case.ts` to call `findOpenWave(waveId)` when present and `findActiveWave()` when absent, throwing `BadRequestException('registration is not open')` when neither resolves
- [X] T022 [US3] Create `admission-service/src/admission/applicant/application/use-cases/ensure-my-application/ensure-my-application.use-case.ts` and its `ensure-my-application.input.ts` (`{ userId: string }`)
- [X] T023 [US3] Add `POST admissions/my-application/ensure` to `admission-service/src/admission/applicant/presentation/http/admission-applicant.controller.ts` (JwtAuthGuard, no body) returning the created/`200`-existing application
- [X] T024 [US3] Add the academic-year name to the application's wave in `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.repository.ts` `findMyDetail` using `resolveAcademicYearNames` (contract `ensure-application.md`, R6)
- [X] T025 [US3] Add `ensureMyApplication()` to `admission-web/src/features/admission/api/admissionApi.ts` and `ensureMyApplication()` to `admission-web/src/features/admission/services/publicAdmissionService.ts` + `composables/usePublicAdmission.ts`
- [X] T026 [US3] Extend `admission-web/src/features/admission/types/index.ts` so `AdmissionWaveSummary` carries the resolved `academicYear` name, and render the locked "Gelombang Pendaftaran" field (wave name + academic year, disabled, not in any step payload) in `admission-web/src/features/admission/views/ApplicationFormView.vue`
- [X] T027 [US3] Add a locked-field assertion to `admission-web/src/features/admission/composables/useApplicationFormState.spec.ts` (or a new `ApplicationFormView.spec.ts`) proving the wave is displayed and never submitted
- [X] T028 [US3] Run `pnpm validate` in `admission-service/` and `admission-web/`

**Checkpoint**: An applicant with no application gets one on the active wave by
calling ensure, and the form shows the locked wave + year. Independently
testable, no dialog required yet.

---

## Phase 4: User Story 1 — Parent signs up from the landing page (Priority: P1) MVP

**Goal**: A dialog on the landing page collects name, email, password,
confirmation, resolves the wave automatically, and drops the visitor into the
form.

**Independent Test**: Open the landing page, activate any register control, submit
a fresh email, and confirm an account and a DRAFT application on the active wave
exist and the visitor lands in the form — with no wave or phone asked at any
point.

### Tests for User Story 1

- [X] T029 [P] [US1] Create `admission-web/src/features/admission/components/SignUpDialog.spec.ts`: renders only the four fields (no phone, no wave); password toggle exposes `aria-pressed`; a 409 shows an email-field conflict; a "registration is not open" 400 keeps submit available; success emits close and routes to the form
- [X] T030 [P] [US1] Extend `admission-web/src/app/providers/router/router.spec.ts`: `/register` resolves to the redirect into `/?signup=1`, not to a form component

### Implementation for User Story 1

- [X] T031 [P] [US1] Create `admission-web/src/features/admission/composables/useSignUpDialog.ts` holding the shared open/close state for the landing page
- [X] T032 [US1] Create `admission-web/src/features/admission/components/SignUpDialog.vue` using `@/ui/dialog` (reka-ui): four fields, vee-validate + zod, password visibility toggles with `aria-pressed`, per-field errors, `max-h`/scroll with no horizontal overflow at 320px, controls ≥44px, focus returns to the opener (contract `signup-dialog-ui.md`)
- [X] T033 [US1] In `RegisterView.vue`/dialog submit, call `publicAdmissionService.register({ fullName, email, password, passwordConfirm })` with **no `waveId`**, close the dialog, and `router.push({ name: 'applicant-form' })` on success (depends T032)
- [X] T034 [US1] Remove `waveId` from `RegisterPayload` in `admission-web/src/features/admission/types/index.ts` and from `publicAdmissionService.register` / `usePublicAdmission` usage; leave the admin `RegisterPayload` consumer (`adminRegisterApplicant`) explicitly passing a wave id via its own type or an intersection so admin registration is unaffected
- [X] T035 [US1] Create `admission-service/src/admission/applicant/presentation/http/dto/request/public-register-applicant.dto.ts` (no `waveId`) and switch `admission-service/src/admission/applicant/presentation/http/admission-public.controller.ts` `POST admissions/register` to it; keep `admission-admin-registration.controller.ts` on the `waveId`-required DTO (contract `register-auto-wave.md`)
- [X] T036 [P] [US1] Replace the `/register` nav links with dialog-opening buttons in `admission-web/src/features/admission/components/landing/LandingNavbar.vue`, `LandingHero.vue`, `LandingWaveSection.vue` (drop the `?wave=` deep link), and `LandingCta.vue`
- [X] T037 [US1] Mount `SignUpDialog` on `admission-web/src/features/admission/views/LandingView.vue` and open it from `?signup=1` on mount, clearing the query (depends T031, T032)
- [X] T038 [US1] Change `admission-web/src/features/admission/routes.ts` so `/register` redirects to `/{ name: 'landing', query: { signup: '1' } }`; update the `admission-web/src/features/admission/views/ApplicantDashboardView.vue` empty-state action so it no longer links to the removed form (FR-002, FR-020, SC-006)
- [X] T039 [US1] Add an outage-failure path to the dialog: a `503` shows the shared outage message rather than a validation error (edge case); wire the `notifyIfOutage` path already used by `publicAdmissionService`
- [X] T040 [US1] Run `pnpm validate` in `admission-service/` and `admission-web/`

**Checkpoint**: MVP complete — a parent signs up entirely in a dialog, wave
automatic, lands in the form. Testable against quickstart S1–S3, S9, S10.

---

## Phase 5: User Story 2 — Parent signs up with Google (Priority: P2)

**Goal**: A "Daftar dengan Google" control in the dialog creates a new APPLICANT
account with an application when the deployment allows it, signs in when the
email exists, and refuses cleanly when disabled or when identity is unreachable.

**Independent Test**: With `GOOGLE_SIGNUP_ENABLED=true`, sign up with a fresh
Google email and confirm a new APPLICANT account + DRAFT application and the form
opens; repeat with an existing email and confirm no duplicate; set the flag false
and confirm no account is created and the visitor is told the account is not
registered.

### Tests for User Story 2

- [X] T041 [P] [US2] Create `identity-service/src/auth/application/use-cases/oauth-login/oauth-login.use-case.spec.ts`: `signin` + unknown email creates roleless (unchanged); `signup` + unknown email + flag on creates with `APPLICANT`, outcome `signup-created`; `signup` + flag off creates nothing, outcome `signup-disabled`; existing account in either intent signs in, outcome `signup-existing`
- [X] T042 [P] [US2] Extend `identity-service/src/auth/oauth/oauth-redirect.spec.ts`: intent round-trips through `state`; a bare origin decodes as `signin`; `buildCallbackUrl` appends `oauthOutcome` and, for `signup-disabled`, targets `/?signup=1`
- [X] T043 [P] [US2] Create `admission-web/packages/platform/src/features/auth/views/OAuthCallbackView.spec.ts` (or extend the existing suite): `signup-created`/`signup-existing` call ensure then route to the form; `signup-disabled` shows the not-registered state; absence keeps the feature-001 path

### Implementation for User Story 2

- [X] T044 [US2] Implement the intent branch in `identity-service/src/auth/application/use-cases/oauth-login/oauth-login.use-case.ts` per the R4 table: on `signup` with an unknown verified email and `GOOGLE_SIGNUP_ENABLED` false, return without creating and with `oauthOutcome: 'signup-disabled'`; when true, create with `roleCode: 'APPLICANT'` and outcome `signup-created`; when the account matched, outcome `signup-existing` (depends T012, T013, T014)
- [X] T045 [US2] Update `identity-service/src/auth/presentation/http/auth.controller.ts` `googleAuthCallback` to decode the intent from `state`, pass it to the use case, and branch the redirect: skip the refresh cookie and redirect to `/?signup=1` on `signup-disabled`, otherwise append `oauthOutcome` via the extended `buildCallbackUrl` (depends T009, T015, T044)
- [X] T046 [US2] Add an `intent` argument to `googleStartUrl` in `admission-web/packages/platform/src/features/auth/api/authApi.ts` (default `signin`, so `LoginForm.vue` is untouched) and append `?intent=signup`
- [X] T047 [US2] Add the "Daftar dengan Google" control to `admission-web/src/features/admission/components/SignUpDialog.vue` below the password form, reusing the Google SVG/outline-button pattern from `LoginForm.vue`, calling `googleStartUrl(window.location.origin, 'signup')`
- [X] T048 [US2] Extend `admission-web/packages/platform/src/features/auth/views/OAuthCallbackView.vue`: read `oauthOutcome`, call `usePublicAdmission().ensureMyApplication()` for `signup-created`/`signup-existing`, route to the form on success, and add a `signup-disabled` state that lands on the landing dialog message; leave the no-outcome path exactly as feature `001` left it (depends T025, T044, T045)
- [X] T049 [US2] Surface an identity-service outage during Google sign-up as an outage message, not an invalid-signup error, in `SignUpDialog.vue` / `OAuthCallbackView.vue` using the existing outage helper (FR-016)
- [X] T050 [US2] Run `pnpm validate` in all three repositories

**Checkpoint**: All three stories work independently; quickstart S4–S8 pass,
including S8 proving feature-001 sign-in is unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, contract documentation, and the deliberate follow-ups.

- [X] T051 [P] Walk `specs/002-public-signup-google/quickstart.md` scenarios S1–S10 in a running environment and record the outcome per scenario
- [X] T052 [P] Update `identity-service/docs/OVERVIEW.md` (and mirror the shared contract note) to document `GOOGLE_SIGNUP_ENABLED`, the `state` `{origin,intent}` shape, and the new `oauthOutcome` values, keeping the cross-service contract append-only (Principle IV)
- [X] T053 [P] Update `admission-service/docs/OVERVIEW.md` and `admission-web/docs/OVERVIEW.md` with the automatic wave, the ensure endpoint, and the dialog replacing the page
- [X] T054 [P] Confirm no comment was added to business code (Principle V) and no rule was suppressed; run `pnpm lint:strict` in all three repositories
- [X] T055 Record the follow-up raised in research R5: consolidate the three duplicated active-wave filters (`findOpenWave`, `findActiveWaves`, `findActiveWave`) and delete the dead `findActiveWave` on `admission-service/src/admission/wave/domain/repositories/admission-wave-repository.ts` — as a separate refactor commit, not in this feature
- [X] T056 Verify the identity-service repository-is-290-lines class is genuinely under budget and that the split changed no test coverage (Principle V), by diffing the test file list before and after T004–T007
- [X] T057 Final `pnpm validate` in `identity-service/`, `admission-service/`, and `admission-web/`

### Follow-up found after T057 (2026-09-15): no sign-up route from `/login`

Signing out lands on `/login`, which offered only "Masuk" and "Masuk dengan
Google". With the standalone form gone, a visitor there had no way to register.
FR-021 was added to cover it.

- [X] T058 [US1] Create `admission-web/packages/platform/src/features/auth/components/LoginForm.spec.ts`: no link when `signUpUrl` is `null`; link renders with the configured URL and label when set
- [X] T059 [US1] Add `signUpUrl: string | null` and `signUpLabel: string` to `authConfig` in `admission-web/packages/platform/src/features/auth/config.ts` (defaults `null` / `Belum punya akun?`) and render the opt-in `Belum punya akun? Daftar` line in `LoginForm.vue`
- [X] T060 [US1] Set `signUpUrl: '/register'` in `admission-web/src/app/main.ts` so the link opens the sign-up dialog via the existing redirect; confirm the six sibling apps keep the `null` default and are not edited
- [X] T061 [US1] Update `admission-web/docs/OVERVIEW.md` with the login-page entry point, the two config fields, and why the default is opt-in; run `pnpm validate`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every story.**
  - T004–T007 sequential within the split; T008 gates the rest of admission-service.
  - T009–T015 sequential-ish: T009 before T011; T013 before T014; T014 before T015.
- **US3 (Phase 3)**: depends on Foundational. Owns wave resolution + `ensure`.
- **US1 (Phase 4)**: depends on US3 for `findActiveWave`, the no-`waveId` DTO and
  the ensure client. Consumes US3's server change.
- **US2 (Phase 5)**: depends on Foundational (identity intent/role) and on US3's
  ensure endpoint (T025). Does not depend on US1's dialog internals except that
  T047 adds a control to the dialog US1 created.
- **Polish (Phase 6)**: depends on all three stories.

### User Story Dependencies

- **US3**: independently testable — ensure + locked form, no dialog needed.
- **US1**: independently testable once US3's server change is in — the dialog is
  self-contained.
- **US2**: independently testable once US3's ensure endpoint and the
  identity-service foundation exist. It shares `SignUpDialog.vue` with US1, so on
  a single branch US1 precedes T047; on parallel branches, T047 is the one
  merge-touch point.

### Within Each Story

- Tests first and failing (T016/T017 before T018–T022; T029/T030 before
  T031–T039; T041–T043 before T044–T049).
- Port/input types before implementations.
- Repository before use case before controller before web client.

### Parallel Opportunities

- Phase 2a (admission split) and Phase 2b (identity intent plumbing) touch
  different repositories and are fully parallel.
- Within US3: T016 and T017 are parallel; T024 and T025 are parallel.
- Within US1: T029, T030, T031, T036 are parallel.
- Within US2: T041, T042, T043 are parallel; T046 is parallel to T044/T045.
- Across stories: three developers could take one repository each (identity →
  US2 backend, admission → US3 backend, web → US1 dialog).

### Dependency Graph (compact)

```text
Setup T001-T003
  └─ Foundational
       ├─ 2a admission split T004-T008 ─────────────┐
       └─ 2b identity intent T009-T015 ──┐          │
                                          │          │
US3 T016-T028 (needs T008) ───────────────┘──────────┤
  ├─ US1 T029-T040 (needs US3 T018,T019,T035,T025)   │
  └─ US2 T041-T050 (needs US3 T025 + 2b) ────────────┘
       └─ Polish T051-T057
```

---

## Parallel Example: User Story 1

```bash
# Tests first, in parallel:
Task: "SignUpDialog.spec.ts — four fields, aria-pressed toggle, 409, not-open, success"
Task: "router.spec.ts — /register redirects into ?signup=1"

# Then independent web files in parallel:
Task: "composables/useSignUpDialog.ts"
Task: "landing Navbar/Hero/WaveSection/Cta link -> dialog button"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2 (the split and the identity intent plumbing are cheap and
   unblock everything).
2. Phase 3 (US3) — the server-side wave resolution and ensure endpoint, because
   US1's password path depends on them.
3. Phase 4 (US1) — the dialog.
4. **STOP and VALIDATE** against S1–S3, S9, S10. This is the shippable MVP for a
   deployment with no Google sign-up.

### Incremental Delivery

1. US3 → the form stops lying about the wave; ensure repairs interrupted
   sign-ups. Deployable alone.
2. US1 → the dialog. Deployable; quickstart S1–S3, S9, S10.
3. US2 → Google sign-up, opt-in. Deployable with the flag left off; S4–S8.
4. Polish → docs, the follow-up ledger, and the final gate.

### Notes

- Commit per repository, per story where practical; the Phase 2a split is its own
  commit with `git add -- <path>` and a `git diff --cached --stat` read first.
- Never add or delete a spec during the refactor (T008/T056).
- Update `docs/OVERVIEW.md` in a repository whenever this feature changes what
  that repository does, in the same PR (workspace rule).

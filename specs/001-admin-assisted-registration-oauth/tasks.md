---

description: "Task list for admin-assisted registration, Google sign-in, and auth form polish"
---

# Tasks: Admin-Assisted Registration, Google Sign-In, and Auth Form Polish

**Input**: Design documents from `/specs/001-admin-assisted-registration-oauth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. The constitution (Principle V) requires a spec for every new
use case; this feature adds no new use case but four new entry points, so the
existing `*.spec.ts` files are extended to pin them. Test *runs* happen once, in
the Polish phase, at the user's request — not per task.

**Organization**: Tasks are grouped by user story. US1 is the MVP (new backend
surface). US2, US3 and US4 are independent of each other and of US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4, mapping to the spec's user stories
- Every task names an exact file path

**Path roots** (this platform is multi-repository):

- `admission-service/` — `D:\Project\241 Apps\admission-service`
- `identity-service/` — `D:\Project\241 Apps\identity-service`
- `admission-web/` — `D:\Project\241 Apps\admission-web`
- Sibling web apps — `D:\Project\241 Apps\<app>-web`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The one grant and the one inventory that US1 leans on.

- [x] T001 Add the `admissions.create` entry to the permission catalogue in `identity-service/src/access-control/permission/constants/permission-codes.constants.ts`, shaped `{ module: 'admissions', action: 'create', code: 'admissions.create', description: 'Create admissions on behalf' }`, placed with the existing `admissions.*` entries
- [x] T002 Re-run the IAM seed (`identity-service/prisma/seeds/modules/iam.seed.ts` entry point) so `ADMIN` receives `admissions.create` through the existing non-exempt loop
- [x] T003 [P] Confirm the sibling web apps that carry `packages/platform/src/features/auth/` — `academic-web`, `admin-web`, `portal-web`, `assessment-web`, `hr-web`, `inventory-web` — and record which files are present in each, for the T034 mirror step

**Checkpoint**: The permission exists in the database; the mirror inventory is known.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The three id-keyed reads that the on-behalf writes resolve through.
None exists today (verified — see research.md R2). US1 cannot be built without them.

**⚠️ CRITICAL**: US1 is blocked until this phase completes. US2, US3 and US4 do not depend on it.

- [x] T004 [P] Add `findDetailById(applicationId: string): Promise<ApplicationWithParentsAndUser | null>` to `admission-service/src/admission/applicant/domain/repositories/admission-applicant-repository.ts`, then implement it in `admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.repository.ts` reusing the existing `applicationDetailInclude` and `deletedAt: null` filter that `findMyDetail` uses
- [x] T005 [P] Add `findByApplicationId(applicationId: string): Promise<AdmissionDocumentApplicationRef | null>` to `admission-service/src/admission/document/domain/repositories/admission-document-repository.ts`, then implement it in `admission-service/src/admission/document/infrastructure/persistence/prisma/prisma-admission-document.repository.ts`, filtering `deletedAt: null`
- [x] T006 [P] Add `findByApplicationId(applicationId: string): Promise<AdmissionPaymentApplicationRef | null>` to `admission-service/src/admission/payment/domain/repositories/admission-payment-repository.ts`, then implement it in `admission-service/src/admission/payment/infrastructure/persistence/prisma/prisma-admission-payment.repository.ts`, filtering `deletedAt: null`

**Checkpoint**: Each port has a by-application-id read; the Prisma classes implement it within the existing 200-line budget where possible.

---

## Phase 3: User Story 1 — Administrator registers and fills a form for an applicant (Priority: P1) 🎯 MVP

**Goal**: An admin creates an applicant account from `/admin/applicants` and fills the seven-step form, documents and payment on the applicant's behalf, then submits.

**Independent Test**: Sign in as an admin, register a new applicant, walk all seven steps, submit, then sign in as the applicant and confirm the same completed application is visible. Details in `quickstart.md` → Story 1.

### Tests for User Story 1 ⚠️ (extend existing specs; do not delete coverage)

- [x] T007 [P] [US1] Extend `admission-service/src/admission/applicant/application/use-cases/admission-applicant.use-cases.spec.ts` with `executeForApplication` cases: not-found by id, non-editable status is refused, and the submit gate reports missing items — mirroring the existing `execute(userId)` cases
- [x] T008 [P] [US1] Extend `admission-service/src/admission/document/application/use-cases/admission-document.use-cases.spec.ts` with `executeForApplication` cases: not-found, non-editable, and a valid upload resolves the application by id
- [x] T009 [P] [US1] Extend `admission-service/src/admission/payment/application/use-cases/payment-layering.seam.spec.ts` (or the payment use-case spec present) with `executeForApplication` cases: not-found, non-editable, and already-`VERIFIED` is refused

### Implementation for User Story 1 — backend

- [x] T010 [US1] Refactor `admission-service/src/admission/applicant/application/use-cases/update-my-application/update-my-application.use-case.ts`: extract the editability check and update call into a private method, and add `executeForApplication(applicationId: string, input: UpdateMyApplicationInput)` that resolves through `findMyDetail`-equivalent by id (T004) then calls the shared body. `execute(userId, input)` behaviour unchanged
- [x] T011 [US1] Refactor `admission-service/src/admission/applicant/application/use-cases/submit-application/submit-application.use-case.ts`: extract the completeness check, transition assert, wave check and notification into a private body, and add `executeForApplication(applicationId: string)` that resolves via T004. `execute(userId)` behaviour unchanged
- [x] T012 [US1] Refactor `admission-service/src/admission/document/application/use-cases/upload-admission-document/upload-admission-document.use-case.ts`: add `executeForApplication({ applicationId, documentTypeCode, file, uploadedByAdminId })` resolving via T005; the saved file's `uploadedBy` is the acting admin's id, not the applicant's
- [x] T013 [US1] Refactor `admission-service/src/admission/payment/application/use-cases/upload-payment-proof/upload-payment-proof.use-case.ts`: add `executeForApplication({ applicationId, bankName, senderAccountName, transferDate, file, uploadedByAdminId })` resolving via T006; `uploadedBy` is the acting admin's id
- [x] T014 [US1] Create `admission-service/src/admission/application/presentation/http/admission-admin-registration.controller.ts`: `@Controller('admissions')`, `@UseGuards(JwtAuthGuard)`, and five routes each with `@RequirePermissions('admissions.create')` — `POST applications` (delegates to `RegisterApplicantUseCase`), `PATCH applications/:id/form` (`executeForApplication`), `PUT applications/:id/documents/:typeCode` (multipart), `PUT applications/:id/payment` (multipart), `POST applications/:id/submit`. Reuse the existing DTOs. Contract: `contracts/admin-registration.md`. Keep the file under 150 lines
- [x] T015 [US1] Register `AdmissionAdminRegistrationController` in the `controllers` array of `admission-service/src/admission/application/application.module.ts`; do not touch `admission-admin.controller.ts`

### Implementation for User Story 1 — frontend

- [x] T016 [US1] Add the on-behalf API methods to `admission-web/src/features/admission/api/admissionApi.ts`: `adminRegisterApplicant`, `adminGetApplication(id)`, `adminUpdateApplication(id, payload)`, `adminUploadDocument(id, typeCode, file)`, `adminUploadPaymentProof(id, payload, file)`, `adminSubmitApplication(id)`
- [x] T017 [US1] Create `admission-web/src/features/admission/composables/useAdminRegistration.ts`: state for the created application id, `registerApplicant`, `updateStep`, `uploadDocument`, `uploadPaymentProof`, `submit`, and a one-shot credentials holder that clears the password when the completion panel closes (FR-008)
- [x] T018 [US1] Create `admission-web/src/features/admission/components/RegisterApplicantDialog.vue`: account fields (name, email, phone, wave, password, confirmation) on the shared floating-label field with schema validation; on success emits the new application id and closes; surfaces the email conflict on the email field (FR-001, FR-006)
- [x] T019 [US1] Create `admission-web/src/features/admission/components/AdminApplicationFormDialog.vue`: the seven-step host that renders the existing `PersonalDataStep`, `ParentsStep`, `AddressStep`, `SchoolStep`, `DocumentsStep`, `PaymentStep`, `ReviewStep` with `useApplicationFormState`, `useApplicationUploads` wired to the T017 admin callbacks, a completion panel showing registration number + email + password once with a copy affordance (FR-006, FR-007)
- [x] T020 [US1] Add the "Daftarkan Pendaftar" action and the two dialogs to `admission-web/src/features/admission/views/ApplicationListView.vue` (header action next to the title; reload the list after a successful submit)

**Checkpoint**: US1 fully functional and independently testable per `quickstart.md` → Story 1.

---

## Phase 4: User Story 2 — Applicant signs in with Google (Priority: P2)

**Goal**: A "Masuk dengan Google" control starts the identity-service flow with this app as the return target; the callback restores the session and routes onward, and an unknown email reaches a clear message.

**Independent Test**: Register an applicant with a Google email, sign in through Google, confirm the same application; repeat with an unknown email and confirm the not-registered message. Details in `quickstart.md` → Story 2. Backend contract: `contracts/oauth-return-target.md`.

- [x] T021 [US2] Add `GOOGLE_OAUTH_REDIRECT_ALLOWLIST` to `identity-service/src/core/config/env.validation.ts`, validated with the same comma-separated-URL idiom as `FRONTEND_URL` (lines 59-82), defaulting to `http://localhost:5173,http://localhost:5175`
- [x] T022 [US2] Update `identity-service/src/auth/presentation/http/auth.controller.ts`: `GET /auth/google` reads an optional `redirect`, reduces it to an origin, accepts it only when allowlisted (else falls back to `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL`'s origin), and carries it through the OAuth `state` via `getAuthenticateOptions`; `GET /auth/google/callback` reads and re-validates the origin from `req.query.state` and redirects to `<origin>/oauth/callback?profileIncomplete=…`. No token in the URL; the refresh cookie path is unchanged
- [x] T023 [P] [US2] Extend `identity-service/src/auth/presentation/http/auth.controller.spec.ts` with: allowlisted redirect is carried, unlisted redirect falls back, absent redirect falls back, and the callback appends only `profileIncomplete`
- [x] T024 [US2] Correct `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL` from `5173` to `http://localhost:5175/oauth/callback` and add the allowlist variable in `identity-service/.env` and `identity-service/.env.example`; keep placeholder secrets as placeholders (FR-024)
- [x] T025 [US2] Add a `googleStartUrl(origin: string)` helper to `admission-web/packages/platform/src/features/auth/api/authApi.ts` that returns the identity-service `/auth/google?redirect=<origin>` URL from configuration, not a literal
- [x] T026 [US2] Add the "Masuk dengan Google" control below the password form in `admission-web/packages/platform/src/features/auth/components/LoginForm.vue`, using a visual separator and a full-page navigation (FR-012, FR-013)
- [x] T027 [US2] Create `admission-web/packages/platform/src/features/auth/views/OAuthCallbackView.vue` and register `/oauth/callback` (`meta: { guestOnly: false }`, no auth requirement) in `admission-web/packages/platform/src/features/auth/routes.ts`. The view runs `authService.restoreSession()` on mount, then routes by role: `APPLICANT` → `/registration`, admin → `/admin`, no role → the not-registered state with a `/register` link (FR-014, FR-016, FR-017)
- [x] T028 [US2] In `OAuthCallbackView.vue`, render the outage state for an unreachable identity service (reuse `notifyIfOutage` / `getIndonesianErrorMessage`) and return the user to `/login`, never a blank page (FR-018)

**Checkpoint**: US1 and US2 both work independently; US2's unknown-email outcome is self-contained in the callback view.

---

## Phase 5: User Story 3 — Blank applicant screens explain themselves (Priority: P3)

**Goal**: `/registration` and `/registration/form` render an explanatory empty state with a working next action for any account that owns no application.

**Independent Test**: As an admin, open both routes and confirm an explanation plus a working link, with no white page. Details in `quickstart.md` → Story 3.

- [x] T029 [US3] Add a `v-else` branch after `v-else-if="application"` in `admission-web/src/features/admission/views/ApplicantDashboardView.vue`: an explanatory empty state whose action is role-aware — admin roles link to `/admin/applicants`, any other account links to `/register` (FR-009, FR-011)
- [x] T030 [US3] Add a `v-else` branch after `v-else-if="application"` in `admission-web/src/features/admission/views/ApplicationFormView.vue`: the same explanation, linking to `/registration` (or `/register` when the account is not an applicant). Render no applicant-only write control (FR-010, FR-011)

**Checkpoint**: Both screens render non-empty for every signed-in account.

---

## Phase 6: User Story 4 — Login and registration match the rest of the application (Priority: P4)

**Goal**: `/register` uses the shared floating-label field and schema validation; both auth screens offer accessible password visibility controls; registration success shows the registration number instead of a toast.

**Independent Test**: Open `/login` and `/register`; confirm shared fields, per-field errors, working toggles, and a success state with the registration number. Details in `quickstart.md` → Story 4.

- [x] T031 [US4] Migrate `admission-web/src/features/admission/views/RegisterView.vue` from `Label` + manual `validate()` to `FloatingField` with a zod schema (vee-validate), removing the field-error toasts; keep the wave select on `FloatingLabelField` with `floating` (FR-019, FR-021)
- [x] T032 [P] [US4] Add `aria-label`/`aria-pressed` (or an accessible name reflecting state) to the password visibility toggle in `admission-web/packages/platform/src/features/auth/components/LoginForm.vue` and turn it into a real `<button type="button">` with a visible focus ring (FR-020)
- [x] T033 [US4] Add a password visibility toggle to the password fields in `RegisterView.vue` that preserves value and cursor position, and replace the success toast with a dedicated success state showing the registration number and a sign-in link (FR-020, FR-022)

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: The one mandatory mirror, then the end-of-work gates.

- [x] T034 Mirror the auth files changed in US2/US4 (`api/authApi.ts`, `components/LoginForm.vue`, `routes.ts`, `views/OAuthCallbackView.vue`, and any touched `packages/ui/**`) from `admission-web` to each sibling app confirmed in T003. Verify presence per app first; do not add a control to an app that cannot serve the route (FR-023)
- [x] T035 [P] Update `admission-web/docs/OVERVIEW.md` (and the sibling copies if it is mirrored) to record the new on-behalf flow, the OAuth callback route, and the empty states
- [x] T036 Run the configured verification, once, in the three repositories: `pnpm test`, then `pnpm run validate` (`format:check` → `lint` → `typecheck` → `lint:strict` → `test` → `build`) in `admission-service`, `identity-service`, `admission-web`, and each sibling app touched by T034. Fix every failure; do not run these per task

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T002 needs T001; T003 is independent
- **Foundational (Phase 2)**: T004–T006 are independent of Setup and of each other; they block US1 only
- **US1 (Phase 3)**: needs Phase 2. Tests T007–T009 precede T010–T013; T014–T015 follow the entry points; T016–T020 follow T014
- **US2 (Phase 4)**: needs nothing from Phase 2 or US1; T021 before T022; T024 anytime; T025 before T026; T027 before T028
- **US3 (Phase 5)**: needs nothing; independent
- **US4 (Phase 6)**: needs nothing; T031 before T033
- **Polish (Phase 7)**: T034 needs US2 and US4; T036 needs everything

### User Story Dependencies

- **US1 (P1)**: independent; the MVP
- **US2 (P2)**: independent. Its unknown-email outcome is handled inside `OAuthCallbackView`, so it does not wait on US3
- **US3 (P3)**: independent. When an admin opens `/registration`, the empty state is the visible counterpart to US1's work, but neither blocks the other
- **US4 (P4)**: independent

### Within Each User Story

- Tests before implementation; the spec files must show the new cases failing first
- Port method (T004–T006) before the use case that resolves through it (T010–T013)
- Use case entry points before the controller (T014), controller before its module registration (T015)
- API methods (T016) before the composable (T017) before the dialogs (T018–T019) before the list action (T020)

### Parallel Opportunities

- T003, T004, T005, T006 — different files, no shared state
- T007, T008, T009 — three different spec files
- T010–T013 — four different use-case files
- T018 and T019 are separate components, but T019 needs T017, so keep them sequential if one author
- T029 and T030 — two different views
- T032 is independent of T031/T033 only if the toggle stays in `LoginForm.vue`
- US1 (backend + frontend), US2, US3, US4 can be staffed in parallel after Setup

---

## Parallel Example: User Story 1

```bash
# Foundational reads, in parallel:
Task: "Add findDetailById to the applicant port and Prisma repository"
Task: "Add findByApplicationId to the document port and Prisma repository"
Task: "Add findByApplicationId to the payment port and Prisma repository"

# The three spec extensions, in parallel:
Task: "Extend admission-applicant.use-cases.spec.ts with executeForApplication cases"
Task: "Extend admission-document.use-cases.spec.ts with executeForApplication cases"
Task: "Extend the payment use-case spec with executeForApplication cases"

# The four use-case entry points, in parallel:
Task: "Add executeForApplication to UpdateMyApplicationUseCase"
Task: "Add executeForApplication to SubmitApplicationUseCase"
Task: "Add executeForApplication to UploadAdmissionDocumentUseCase"
Task: "Add executeForApplication to UploadPaymentProofUseCase"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001–T002)
2. Phase 2 (T004–T006)
3. Phase 3 (T007–T020)
4. **STOP and VALIDATE** per `quickstart.md` → Story 1
5. Deploy/demo: this is the story that unblocks the parents who cannot self-serve

### Incremental Delivery

1. Setup + Foundational → the id-keyed reads exist
2. US1 → validate → MVP
3. US2 → validate → Google sign-in served from one allowlist across apps
4. US3 → validate → no white pages
5. US4 → validate → `/register` matches the rest of the app
6. Phase 7 → mirror once, then the full `validate` gate

### Notes

- [P] = different files, no dependency on an incomplete task
- Commit per task or per logical group, with `git add -- <path>` and a `git diff --cached --stat` read first (Principle V)
- A DRAFT application abandoned mid-flow is an acceptable, visible, repairable state — do not add a cleanup job
- The known `/settings` 404 is out of scope; do not record it as a new finding

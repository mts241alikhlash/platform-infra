# Phase 0 Research: Admin-Assisted Registration, Google Sign-In, Auth Form Polish

**Feature**: `001-admin-assisted-registration-oauth`

Each item below was an open question in the Technical Context. Each is resolved
by reading the repository, not by assumption, and the evidence is named with
file and line. Where v1 of this document asserted something the code does not
support, the correction is called out.

## R1. Which applicant write paths are keyed to the caller, and how do they break for an admin?

**Decision**: Add on-behalf endpoints under a sibling admin controller that
accept an `applicationId` in the path, and give each affected write use case a
second entry point keyed by application id rather than by caller user id.

**Evidence**: every applicant write resolves its target through the caller's
identity.

| Use case | Resolves via | Line |
| --- | --- | --- |
| `UpdateMyApplicationUseCase.execute(userId, input)` | `findMyApplication(userId)` | `update-my-application.use-case.ts:20-25` |
| `SubmitApplicationUseCase.execute(userId)` | `findMyDetail(userId)` | `submit-application.use-case.ts:50-55` |
| `UploadAdmissionDocumentUseCase.execute({ userId, … })` | `findApplicationForUpload(userId)` | `upload-admission-document.use-case.ts:39-44` |
| `UploadPaymentProofUseCase.execute({ userId, … })` | `findApplicationWithPayment(userId)` | `upload-payment-proof.use-case.ts:25-30` |

The three repository methods behind the last three filter by user id:
`prisma-admission-applicant.repository.ts:215-229` (`findMyApplication`,
`findMyDetail`, both `where: { userId, deletedAt: null }`),
`admission-document-repository.ts:37-39`,
`admission-payment-repository.ts:28-30`. An admin owns no application row, so
these cannot be reused as-is.

**An important nuance the v1 document missed.** `updateMyApplication` and
`submitApplication` are already keyed by **application id**, not user id — the
use case resolves the caller's application first and then passes
`application.id` down. Only the *lookup* is caller-keyed. Likewise
`UploadAdmissionDocumentUseCase` saves by `application.id`
(`upload-admission-document.use-case.ts:65-76`) and `savePaymentProof` writes by
`paymentId` (`upload-payment-proof.use-case.ts:44-57`). So the on-behalf path
does **not** need new write queries at all; it needs three new read lookups by
application id. That is a smaller change than v1 implied.

**Alternatives considered**:
- *A second set of duplicated use cases.* Rejected: it copies the editability
  rule, the status transition check, the required-field list, and the serializer
  into a second place. Principle VIII is explicit that copied business rules
  drift silently.
- *Have the admin sign in as the applicant.* Rejected: it needs the applicant's
  password and erases who acted.

**Shape**: each affected use case keeps its current public method and gains a
sibling entry point that takes a resolved application. The shared body becomes a
private method. `UpdateMyApplicationUseCase`'s body already runs off
`application.id` and `application.status`, so the extraction is mechanical. The
existing specs already pin the current entry point
(`admission-applicant.use-cases.spec.ts:95-128`), so the refactor is checked.

## R2. Which id-keyed reads exist, and which must be added?

**Decision**: The admin **form read** is reused unchanged. Three **lookups for
uploads and the account form** are added.

**Evidence — what exists**:
- `GetApplicationByIdUseCase.execute(id)` resolves through
  `findAdminDetailById(id)` and returns the serialized detail, `duplicateNikCount`
  and `documentTypes` (`get-application-by-id.use-case.ts:11-33`). Exposed as
  `GET /admissions/applications/:id` under `admissions.read`
  (`admission-admin.controller.ts:74-81`). This is exactly the shape the
  seven-step form needs, so the admin form dialog reads through it and no new
  read path is built.

**Evidence — what does not exist** (verified by reading each port in full):
- `IAdmissionApplicantRepository` (`admission-applicant-repository.ts:84-128`)
  has `findMyDetail(userId)` but **no `findDetailById(id)`**. The private
  `findDetail` body at `prisma-admission-applicant.repository.ts:223-229` is the
  include the on-behalf submit needs; by-id it must be added.
- `IAdmissionDocumentRepository.findApplicationForUpload(userId)` exists; no
  by-application-id sibling (`admission-document-repository.ts:36-39`).
- `IAdmissionPaymentRepository.findApplicationWithPayment(userId)` exists; no
  by-application-id sibling (`admission-payment-repository.ts:27-30`).

**Also verified**: `AdmissionApplicationParentInput` and
`CreateAdmissionNotificationInput` are declared in the applicant port file
(`admission-applicant-repository.ts:18-29, 77-82`) but only the latter is a
method input. The parent shape is consumed as `updateMyApplication({ parents })`
and as a field of `UpdateMyApplicationInput`; it carries the resolved
`ParentRelation` and `IncomeRange` enums
(`shared/domain/enums/parent-relation.enum.js`, `income-range.enum.js`,
confirmed against `update-my-application.dto.ts:4-7,22-74`).

## R3. Does the permission need to exist before the endpoint ships?

**Decision**: Add `admissions.create` to the permission catalogue; the existing
seed loop grants it to `ADMIN`. No role-name check anywhere.

**Evidence**: `SYSTEM_PERMISSIONS` in
`identity-service/src/access-control/permission/constants/permission-codes.constants.ts`
is the catalogue. Its `admissions` module holds exactly four entries —
`admissions.decide`, `admissions.enroll`, `admissions.read`,
`admissions.verify` (lines 192-215) — shaped
`{ module: 'admissions', action, code, description }`. The new entry follows that
shape.

`prisma/seeds/modules/iam.seed.ts`: every catalogue entry is granted to
`SUPER_ADMIN` (lines 116-120); every entry whose code does not start with
`portal-` or `payroll-` is granted to `ADMIN` (lines 4-8, 122-127).
`admissions.create` starts with neither prefix, so it is granted on the next
`seed:iam` run with no seed edit.

`SUPER_ADMIN` bypasses the permission check as break-glass in
`PermissionGuard.canActivate` (`permission.guard.ts:39-41`); the guard is
installed globally in `app.module.ts:56-58` alongside `JwtAuthGuard`. No second
bypass is introduced.

**Confirmed for the caller side**: permissions reach a service in the JWT and
are read off `request.user.permissions`; the admin controller's sibling already
uses `@RequirePermissions('admissions.verify')` without a role check
(`admission-admin.controller.ts:84, 104`).

## R4. How does Google sign-in tell the identity service where to return?

**Decision**: Add `GOOGLE_OAUTH_REDIRECT_ALLOWLIST` (comma-separated origins) to
the identity-service env schema. Start is
`GET /auth/google?redirect=<origin>`; the controller validates the origin
against the allowlist **before** the passport guard runs and carries the chosen
target through the OAuth `state` via `AuthGuard.getAuthenticateOptions`. The
callback reads the target back off `req.query.state`, appends the origin-matched
path `/oauth/callback`, and appends `profileIncomplete`.

**Evidence — the current code**: the callback reads exactly one fixed target and
appends one query flag (`auth.controller.ts:145-155`).
`GOOGLE_OAUTH_SUCCESS_REDIRECT_URL` is validated as a single URL
(`env.validation.ts:55-57`). Seven apps need seven targets; a hard-coded URL
cannot serve them.

**Evidence — the mechanism is available**: the controller's existing
`googleAuth(): void {}` is already the *handler* behind `@UseGuards(AuthGuard('google'))`
(`auth.controller.ts:106-114`), so adding `getAuthenticateOptions` to a
controller that extends `AuthGuard('google')`, or overriding it on the existing
guard, is native to `@nestjs/passport`. The installed typings confirm it:
`node_modules/@nestjs/passport/dist/auth.guard.d.ts:9` declares
`getAuthenticateOptions(context: ExecutionContext)`.

**Evidence — the pattern to reuse**: `FRONTEND_URL` is already validated as a
comma-separated URL list (`env.validation.ts:59-82`) and `.split(',')` into the
CORS allowlist (`main.ts`). One validation idiom, not two.

**Alternatives considered**:
- *Pass the return URL unfiltered.* Rejected: open redirect. An attacker could
  authenticate against Google and bounce the user to an attacker-controlled
  origin.
- *Match by host only.* Rejected: the existing validator already works on full
  origins; origin equality is stricter and simpler.
- *One env var per app.* Rejected: seven variables and the callback still has to
  choose between them — the same allowlist with more names.
- *Cookie-carried return target.* Rejected: no cookie-parser is registered on
  the identity-service app (`packages/*` aside, `cookie-parser` is a dependency
  of other services), and a `sameSite: 'strict'` cookie set before the Google
  round trip is not reliably returned on the cross-site callback. `state` is the
  standard mechanism and survives the round trip by construction.

**Security note**: the allowlist value is an **origin**. The callback redirects to
that origin plus the fixed `/oauth/callback` path, and the only query parameter
added is `profileIncomplete`. The redirect target therefore cannot smuggle extra
parameters. An absent or unlisted `redirect` falls back to
`GOOGLE_OAUTH_SUCCESS_REDIRECT_URL`.

## R5. How does the browser session survive the OAuth round trip?

**Decision**: No token crosses the URL. The identity service sets the existing
HttpOnly refresh cookie during the callback
(`auth.controller.ts:139-143, 290-300`), and the callback route runs the existing
`authService.restoreSession()`, which mints an access token from that cookie
(`authService.ts:42-57`).

**Evidence**: `restoreSession()` calls `POST /auth/refresh` with credentials
(`packages/shared/src/utils/api.ts:54-78` — note the function is exported as
`restoreSession` at line 201 and re-exported through `authService`); the app runs
it at boot. The callback route runs the same call again after the provider
round trip returns a *new* cookie, which the boot-time call could not have seen.

**Constraint**: the cookie is `sameSite: 'strict'`, `path: '/auth'`
(`auth.controller.ts:293-298`), and the front end and identity service share an
origin through the dev proxy and the production gateway. A cross-origin
deployment would require `sameSite: 'none'` and is out of scope.

**Dev-port defect found**: `.env` sets
`GOOGLE_OAUTH_SUCCESS_REDIRECT_URL=http://localhost:5173/oauth/callback`, but
admission-web serves on **5175**. The default must be corrected to 5175, or the
allowlist must include it, or the fallback lands on the wrong app.

## R6. What happens for a Google account with no applicant?

**Decision**: The service behavior is unchanged: `resolveUser` matches an
existing account by email and links the identity, or creates a user with no
roles (`oauth-login.use-case.ts:66-108`, `prisma-auth.repository.ts:224-242`).
The front end detects the roleless result and stops.

**Evidence**: the created user has no `APPLICANT` role, so `resolveHomeRoute`
(`router/index.ts:14-16`) sends it to `/registration`, where the new empty state
(FR-009) explains that the account is not registered. The session is real and
valid; only the destination changes.

**Alternatives considered**:
- *Change the service to refuse an unknown email.* Rejected as the primary
  mechanism: it is a behavior change to a published flow other consumers use, and
  the constitution treats a cross-service contract change as a coordinated pair
  (Principle IV: append-only cross-service contracts; Development Workflow: PR
  pairs). The front end reaches the correct user-visible outcome without it.
- *A pre-flight endpoint.* Rejected: the user's Google identity is only known
  after the callback.

## R7. Does the admin flow reuse the seven step components?

**Decision**: Yes. The step components under `src/features/admission/components/`
take their state as `v-model` plus an `editable` prop
(`ApplicationFormView.vue:197-254`), so a second host renders the same
components against a different application id.

**Evidence**: none of the step components reads the signed-in user; only the
composables that persist them do. `useApplicationFormState` is pure state
(hydrate + build payload, `useApplicationFormState.ts:87-215`) and has its own
spec. `useApplicationUploads` is parameterised by the upload callbacks
(`useApplicationUploads.ts:11-26`), so the admin host injects admin-keyed
callbacks and the same file works. Reuse therefore preserves one visual
definition of the form; only the persistence target differs.

## R8. What must be mirrored, and why?

**Decision**: `LoginForm.vue`, `authApi.ts`, `routes.ts` and the new
`OAuthCallbackView.vue` (all under `packages/platform`), plus any `packages/ui`
file touched, are mirrored to the seven sibling web apps: `academic-web`,
`admin-web`, `portal-web`, `assessment-web`, `hr-web`, `inventory-web`.

**Evidence**: `admission-web/docs/OVERVIEW.md` records that `packages/*` are
copied in per app with no sync tooling, and that a fix to a file that exists in
two repositories changes in both. The constitution's Development Workflow
requires the change be made "in all of them, in the same session".

**Scope guard**: the task list mirrors only files that actually differ on disk
after this feature; the mirror step verifies presence per app first, because a
sibling that has not yet adopted a file must not receive a dead control.

## R9. Does the admission-web feature already cover the account-without-application case?

**Decision**: No, and the fix is now proven. `ApplicantDashboardView.vue` renders
`v-if="loading"` (lines 64-69) and `v-else-if="application"` (lines 71-298) with
**no `v-else`**; `ApplicationFormView.vue` does the same (lines 134-139, 141-274).
A 404 from `GET /admissions/my-application` leaves both branches false and the
template renders nothing.

**Evidence**: the route guard's `allowedRoles: ['APPLICANT']` is bypassed for
`SUPER_ADMIN` (`router/index.ts:98`), and `resolveHomeRoute` sends an admin to
`/admin`, not here — but the routes remain directly reachable by URL, and any
authenticated non-applicant account sees white. The data path is
`GetMyApplicationUseCase.execute(userId)` → `findMyDetail(userId)` →
`NotFoundException` when the row is absent (`get-my-application.use-case.ts:11-16`,
`prisma-admission-applicant.repository.ts:223-229`).

**Outcome specified**: an empty state with a next action. The action is
role-aware: an `ADMIN`/`SUPER_ADMIN` account is pointed at `/admin/applicants`
(where Story 1 now lives); any other account is pointed at `/register` (or the
registration link), and no applicant-only write control is rendered.

## Resolved unknowns

| Question | Resolution |
| --- | --- |
| Admin write path | Sibling controller; each write use case gains an id-keyed entry point sharing one private body |
| Which writes need a new query | None — only three new **read** lookups by application id |
| Form read for admin | Reuse `GetApplicationByIdUseCase` (`GET /admissions/applications/:id`) unchanged |
| Permission | New `admissions.create`; granted to `ADMIN` by the existing seed loop |
| OAuth return target | New `GOOGLE_OAUTH_REDIRECT_ALLOWLIST`; passport `state`, origin equality, path fixed to `/oauth/callback` |
| Session handoff | HttpOnly refresh cookie; callback route runs `restoreSession()` |
| Unknown Google email | Roleless user lands on the new empty state; no silent success |
| Form reuse | Second host for the existing `v-model` step components |
| Mirroring | Auth files under `packages/platform` (and any touched `packages/ui` file) to all seven siblings |
| Dev redirect port | Correct `5173` → `5175` in `.env` and `.env.example` |

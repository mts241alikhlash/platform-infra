# Research: Public Sign-Up Dialog with Google Sign-Up

**Feature**: `002-public-signup-google` | **Date**: 2026-09-14

No `NEEDS CLARIFICATION` markers remained in the spec. This document records the
design decisions the plan depends on, each with the alternatives that were
rejected.

---

## R1 — Carrying sign-up intent through the Google round trip

**Decision**: The OAuth `state` parameter becomes a URL-safe base64 encoding of
`{ origin, intent }`, where `intent` is `signin` or `signup`. A legacy state
value that is a bare origin decodes as `{ origin, intent: 'signin' }`. On the
return leg the callback appends a new `oauthOutcome` query parameter to the
existing redirect target alongside `profileIncomplete`.

Outcome values: `signup-created`, `signup-existing`, `signup-disabled`, or
absent for an ordinary sign-in.

**Rationale**: `state` is the only value Google echoes back untouched and it is
already the carrier for the return target, already validated against the origin
allowlist. Adding one field to a structure already crossing the boundary is
smaller than a parallel mechanism. Defaulting a bare origin to `signin` keeps
every existing caller working without a coordinated release.

**Alternatives considered**:
- *A second query parameter on `/auth/google`.* The callback is invoked by
  Google with only `state` and `code`; a query parameter on the start URL is not
  echoed. It would have to be persisted server-side, which means session state
  for an unauthenticated flow.
- *Two different callback URLs.* Requires a second Google OAuth client
  registration and a second allowlist entry per environment.
- *Front-end-only distinction.* The account is created server-side in
  identity-service, so the server must know whether to create or refuse; the
  front end cannot make that call after the fact.

---

## R2 — Where a Google sign-up account is created

**Decision**: `OAuthLoginUseCase` creates the account in identity-service, and
when the intent is `signup` it assigns the `APPLICANT` role in the same Prisma
create. The DRAFT application is then created by admission-web calling a new
idempotent `POST /admissions/my-application/ensure` on admission-service.

**Rationale**: identity-service owns `users`, `roles` and `user_roles`; nothing
else may write them. admission-service already owns application creation and
already calls identity through `IAccountProvisioningPort` — the direction of the
dependency is admission → identity, and it must stay that way (Principle II).
Splitting the two writes is a saga whose second step is idempotent and whose
half-finished state is visible in the form, which is what Principle VIII asks
for.

**Alternatives considered**:
- *identity-service calls admission-service to create the application.* Reverses
  the dependency direction the platform enforces and gives identity a business
  dependency on admissions.
- *admission-service creates the identity account over a new endpoint.* The
  account is already created by the time the browser returns; a second create
  would race or duplicate. `IAccountProvisioningPort.provision` is built for
  admin-assisted registration where admission-service drives, not for a Google
  round trip where identity-service drives.
- *One distributed transaction.* Forbidden by Principle VI and VIII.

---

## R3 — Role assignment inside the OAuth create

**Decision**: `CreateOAuthUserRepositoryInput` gains an optional `roleCode`.
`createUserFromOAuth` creates the `userRole` row inside the same
`prisma.user.create` call, mirroring `provisionAccount`. When `roleCode` is
absent the create is exactly as it is today.

**Rationale**: An account with no role is the state feature `001` already
produces and the state the callback treats as "not registered". Creating the
account and granting its role in one write means there is never a window where a
sign-up account exists but cannot act, and it avoids a second round trip through
`AssignAccountRoleUseCase`.

**Alternatives considered**:
- *Call `AssignAccountRoleUseCase` after the create.* Two writes that must both
  succeed, with a failure mode that leaves a roleless account.
- *Leave roleless and let the front end retry.* Moves an authorization outcome
  into the client, which is where feature `001`'s gap came from.

---

## R4 — Deployment opt-in and the sign-in path

**Decision**: A new boolean env var `GOOGLE_SIGNUP_ENABLED` (default `false`) in
identity-service's zod schema. The logic in `resolveUser` becomes:

| Intent | Email found (linked or by email) | Email unknown |
| --- | --- | --- |
| `signin` | sign in to the existing account | **unchanged** — create a roleless account (feature `001` behavior) |
| `signup` | sign in to the existing account, outcome `signup-existing` | flag **on** → create with `APPLICANT`, outcome `signup-created`; flag **off** → create nothing, outcome `signup-disabled` |

**Rationale**: FR-019 requires sign-in behavior to be untouched across every
application, so the `signin` row keeps the existing branch exactly. FR-012
requires the unknown-email case under `signup` to create nothing when disabled.
Keeping the existing sign-in create-roleless behavior is deliberate: changing it
is a different feature, and the callback already renders it as "not registered".

**Alternatives considered**:
- *Gate all unknown-email creation behind the flag.* Changes feature `001`'s
  sign-in behavior and violates FR-019.
- *Have the flag hide the button in the SPA.* FR-010 makes the Google control
  unconditional in the dialog. The flag is a server-side safety property, so it
  is enforced where the account is created. This also avoids adding a public
  config endpoint on identity-service for one boolean.

---

## R5 — Automatic wave selection

**Decision**: A new `findActiveWave()` on `IAdmissionApplicantRepository`,
implemented with the same filter the existing readers use (`isActive: true`,
`deletedAt: null`, `startDate <= today <= endDate`) and `orderBy startDate asc,
take 1` — the earliest-open active wave. `RegisterApplicantUseCase` calls it when
`waveId` is absent. A new public-register DTO drops `waveId` entirely; the admin
DTO keeps it required.

**Rationale**: The spec's assumption is that the school runs one active wave and
the earliest-open one is an acceptable tie-breaker. Resolving on the server is
what makes FR-007 hold no matter what the client sends, and FR-008's "no active
wave" refusal is a server decision. `findActiveWave()` already exists as dead
code on the wave repository (same filter); this puts the query on the applicant
repository that owns registration, next to `findOpenWave`.

**Alternatives considered**:
- *Client sends the active wave id it read from `GET /admissions/waves/active`.*
  Keeps the wave a client input, which is exactly what FR-007 removes; a stale
  or hand-crafted id would win.
- *Reorder the existing active-wave query instead of a new method.*
  `findActiveWaves()` reads all of them for the landing page and is public; a
  registration-critical single-row read deserves its own contract.
- *Consolidate the three duplicated active-wave filters now.* Tempting under
  Principle VIII/V, but it is a refactor touching unrelated readers and
  Principle V asks for one change per commit. Noted as follow-up, not done here.

**Follow-up (T055), deliberately not done in this feature.** Three queries now
carry the same active-wave filter: `findOpenWave` (by id),
`findActiveWaves` (all, for the landing page) and the new `findActiveWave`
(earliest open, for registration). They should collapse onto one predicate so a
change to "what counts as open" cannot land in two of three places.

Confirmed during this feature: `findActiveWave` on
`src/admission/wave/domain/repositories/admission-wave-repository.ts:49` and its
implementation at `.../prisma/prisma-admission-wave.repository.ts:103` have **no
caller anywhere in `src/` or `test/`**. The only `findActiveWave` references
elsewhere belong to the applicant repository added here. It is dead code and
should be deleted in the same consolidation. Left alone because deleting it is a
change to the `wave` module this feature does not otherwise touch, and the
follow-up is one refactor commit, not a rider on this one.

---

## R6 — Locked wave field in the application form

**Decision**: The form reads the wave from the application detail it already
fetches (`GET /admissions/my-application`) and renders it as a disabled,
read-only field naming the wave and its academic year. admission-service's
`findMyDetail` gains the academic-year name for the application's wave, resolved
through the existing `IReferenceLookupPort.listAcademicYears` and
`resolveAcademicYearNames` helper, exactly as `findActiveWaves` already does.

**Rationale**: FR-009 needs both the wave and its academic year. The wave row
carries only `academicYearId` — academic years live in academic-service and are
resolved over HTTP, which is the pattern already in the repository. The form
already receives `application.wave`; no new endpoint is needed.

**Alternatives considered**:
- *A separate `GET /admissions/my-application/wave`.* A second round trip for
  data already in the response.
- *Show only `wave.name`.* Fails FR-009's "names the wave and its academic
  year".

---

## R7 — Entry points and the retained `/register` route

**Decision**: Every landing-page control that links to `/register` becomes a
button that opens `SignUpDialog`. The `/register` route is **retained** and its
component becomes a redirect to the landing page with `?signup=1`; `LandingView`
opens the dialog when that query is present and clears it. The Google callback
also deep-links to `/?signup=1` when sign-up is disabled so the visitor lands on
the page that can explain it.

**Rationale**: FR-002 and SC-006 forbid a dead route — bookmarks, the
`ApplicantDashboardView` empty-state link and the spec-001-style deep links keep
working. A redirect is the smallest thing that keeps `/register` alive while
FR-020 makes the dialog the single surface.

**Alternatives considered**:
- *Delete `/register` and let it 404.* Fails FR-002 and SC-006.
- *Keep `/register` rendering the old page.* Fails FR-020 (a second, divergent
  sign-up form remains).

---

## R8 — Repository file budget before adding methods

**Decision**: Before adding `findActiveWave` and `ensureApplication`,
`prisma-admission-applicant.repository.ts` (290 lines today) is split into
sibling files: `prisma-admission-applicant.reader.ts`,
`prisma-admission-applicant.writer.ts`, and
`prisma-admission-applicant.draft.ts` (the shared DRAFT + payment +
notification creation used by both `registerApplicant` and `ensureApplication`),
leaving the class a flat contract → call map. The port interface is not split.

**Rationale**: Principle V caps a repository class at 200 lines and this file is
already over budget; adding two methods without the split makes the breach worse
and makes the new code unreadable. The DRAFT creation being shared is what keeps
`registerApplicant` and `ensureApplication` from becoming two copies of the same
write sequence.

**Alternatives considered**:
- *Add the methods and split later.* "Later" is how the file reached 290.
- *Only split the reader side.* The writer side is what grows.

---

## R9 — Ensure-application idempotency

**Decision**: `POST /admissions/my-application/ensure` returns the caller's
existing application when one exists and creates a DRAFT on the active wave when
none does. The existence check runs first; the active-wave resolution second;
creation is a single repository call. If no wave is active and no application
exists, it returns a 409 with a clear "registration is not open" message rather
than creating anything.

**Rationale**: FR-015 (interrupted sign-up) and the OAuth callback both land on
"make sure I have an application". Principle VIII requires idempotency on a
natural key — here `userId`, which is unique on `admission_applications` — and
requires the idempotency check before the uniqueness check so a retry confirms
the record instead of colliding with it. Running an existence check before
touching the wave also means a retry after the wave closed still returns the
applicant's real application.

**Alternatives considered**:
- *Catch the `userId` unique violation and re-read.* Reverses the order
  Principle VIII forbids and turns a normal retry into an error path.
- *Piggyback on `GET /admissions/my-application` by creating on 404.* A GET with
  a write side effect; the idempotent create deserves its own method.

---

## R10 — Cross-repository change order

**Decision**: The identity-service change (intent, flag, role) ships first, then
admission-service (auto-wave, ensure endpoint), then admission-web. Each is a
separate repository with its own PR and its own `pnpm validate`.

**Rationale**: The constitution's workflow requires cross-service contract
changes to merge in dependency order, provider before consumer. The SPA consumes
both services and the new OAuth outcome; it cannot be verified until both are
deployed. Within each repository the changes are additive, so a partially
deployed state degrades to existing behavior rather than breaking.

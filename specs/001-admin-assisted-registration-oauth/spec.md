# Feature Specification: Admin-Assisted Registration, Google Sign-In, and Auth Form Polish

**Feature Branch**: `001-admin-assisted-registration-oauth`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Admin-assisted applicant registration, Google OAuth login, and login/registration form polish for admission-web"

## Context

`admission-web` is the PPDB front end. An applicant registers an account, fills a
form, uploads documents, pays, and waits for a decision; an administrator opens
waves, verifies documents, and accepts or rejects.

Two problems motivate this feature:

1. **The applicant screens are blank for an administrator.** `/registration` and
   `/registration/form` render only when the signed-in account owns an
   application. An administrator owns none, so `GET /admissions/my-application`
   answers 404 and the view renders nothing. There is no empty-state branch.
2. **Some parents cannot operate the public sign-up.** The school wants staff to
   register an applicant on their behalf and fill the form for them.

A third, independent request is Google sign-in. `identity-service` already
publishes the whole flow (`GET /auth/google`, `GET /auth/google/callback`, a
refresh-token cookie, and a `profileIncomplete` query flag), but no front end in
this workspace consumes it.

A fourth is polish of the existing login and registration screens.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrator registers and fills a form for an applicant (Priority: P1)

An administrator opens the applicant list, chooses "Daftarkan Pendaftar", enters
the applicant's account details (name, email, phone, wave, an administrator-set
password), and then fills the seven-step admission form on that applicant's
behalf, including uploading their documents and payment proof. When finished,
the administrator is shown the registration number and the sign-in credentials
once, to hand to the parent. The parent later signs in and sees a completed
application.

**Why this priority**: This is the request that makes the system usable for the
parents who cannot self-serve, and it is the only story that requires new
backend surface. It is the MVP.

**Independent Test**: Sign in as an administrator, open `/admin/applicants`,
register a new applicant, walk all seven steps, submit. Then sign in as the new
applicant and confirm the same application is visible and complete.

**Acceptance Scenarios**:

1. **Given** an administrator signed in, **When** they open `/admin/applicants`
   and choose "Daftarkan Pendaftar", **Then** a dialog opens with account fields
   (name, email, phone, wave, password, password confirmation).
2. **Given** a valid account form, **When** the administrator submits it,
   **Then** an applicant account and a DRAFT application are created, and the
   dialog moves to the form steps.
3. **Given** an account has been created, **When** the administrator fills a
   step and advances, **Then** that step is persisted against the created
   application, not against the administrator's own account.
4. **Given** all steps are filled, **When** the administrator submits, **Then**
   the application status becomes SUBMITTED and the completion panel shows the
   registration number, email, and password once.
5. **Given** an applicant account created this way, **When** that applicant
   signs in normally, **Then** they see the application the administrator filled.
6. **Given** an email already registered, **When** the administrator submits the
   account form, **Then** a clear conflict message is shown and no second
   account is created.

---

### User Story 2 - Applicant signs in with Google (Priority: P2)

An applicant who was registered with a Google email address signs in with
"Masuk dengan Google" instead of a password. The identity service matches the
Google email against the existing account, links the Google identity, and signs
the applicant in to the application they already have.

**Why this priority**: It removes the password step for parents, which is the
second half of "make it usable for parents who struggle". It depends on the
identity service, which is already complete, so it is mostly front-end work. It
is not P1 because staff-assisted registration already unblocks the same parents.

**Independent Test**: Register an applicant with a Google email address, then
sign in through Google with that account and confirm the same application is
shown. Then sign in through Google with an unknown email and confirm the
"account not registered" message.

**Acceptance Scenarios**:

1. **Given** the login page, **When** it renders, **Then** a "Masuk dengan
   Google" control is present below the password form.
2. **Given** the login page, **When** the user activates the Google control,
   **Then** the browser navigates to the identity service Google endpoint and
   carries this application as the return target.
3. **Given** a successful Google sign-in for a registered applicant, **When** the
   browser returns to the callback route, **Then** the session is restored and
   the applicant is routed to `/registration`.
4. **Given** a successful Google sign-in for an email with no account, **When**
   the browser returns to the callback route, **Then** a message states the
   account is not registered and offers the registration link, instead of a
   blank page.
5. **Given** the identity service is unreachable, **When** the Google control is
   activated, **Then** the failure is reported as a service outage, not as bad
   credentials.

---

### User Story 3 - Blank applicant screens explain themselves (Priority: P3)

An administrator who opens the applicant screens, or an applicant who has not
registered yet, sees a plain explanation and a next action instead of an empty
page.

**Why this priority**: It is a small, self-contained fix that removes a dead end.
It is P3 because Story 1 gives administrators a real path, but the empty state
still matters for anyone who navigates there directly.

**Independent Test**: Sign in as an administrator, open `/registration` and
`/registration/form`, and confirm each shows an explanatory empty state with a
working link, with no console error other than the known `/settings` gap.

**Acceptance Scenarios**:

1. **Given** an administrator with no application, **When** they open
   `/registration`, **Then** an empty state explains that this account has no
   registration and links to the applicant list.
2. **Given** an account with no application, **When** they open
   `/registration/form`, **Then** an empty state explains the same and links to
   registration.
3. **Given** the empty state is shown, **When** the account has no APPLICANT role,
   **Then** no applicant-only write control is offered.

---

### User Story 4 - Login and registration match the rest of the application (Priority: P4)

The registration screen still uses plain labels, manual validation, and a toast
for success, while the rest of the application uses the shared floating-label
field and schema validation. Both screens are brought in line and given the
missing interaction affordances.

**Why this priority**: It is pure polish on flows that already work. It is last
because nothing is blocked without it.

**Independent Test**: Open `/login` and `/register`, confirm every field uses the
shared floating-label field, that errors appear per field, that the password
visibility toggle works, and that a successful registration shows a dedicated
success state with the registration number.

**Acceptance Scenarios**:

1. **Given** the registration screen, **When** it renders, **Then** every field
   uses the shared floating-label field with per-field validation messages.
2. **Given** a password field, **When** the visibility control is activated,
   **Then** the password is shown or hidden and the control reports its state.
3. **Given** an invalid submission, **When** the user submits, **Then** the
   offending fields are marked and focusable, and no request is sent.
4. **Given** a successful registration, **When** the request resolves, **Then** a
   success state shows the registration number and a link to sign in, instead of
   a transient toast.
5. **Given** a keyboard-only user, **When** they tab through either screen,
   **Then** every control is reachable and shows a visible focus indicator.

---

### Edge Cases

- An administrator submits the account form with an email that already exists:
  the conflict is reported on the email field, and no account is created.
- An administrator abandons the form step after the account was created: the
  application stays DRAFT and appears in the applicant list, which is a visible,
  repairable state.
- A wave closes while the administrator is filling the form: the step write is
  refused with the existing status rule, and the message says the form is no
  longer editable.
- The application is no longer DRAFT (already submitted): step writes are
  refused, matching applicant behavior.
- Google returns an account whose email matches an existing applicant: the
  identities are linked and the existing application is shown. No second
  application is created.
- Google returns an account with no matching user: the callback shows the
  not-registered message. No user is created silently.
- The Google callback returns with `profileIncomplete=true`: the session is still
  restored; the flag informs the copy but does not block the applicant screens.
- The identity service is down during callback: a service-outage message is
  shown and the user is returned to the login page.
- The password visibility control is activated: the password field keeps its
  value and cursor position.

## Requirements *(mandatory)*

### Functional Requirements

**Administrator-assisted registration**

- **FR-001**: The system MUST let an administrator create an applicant account
  (name, email, phone, wave, password) from the applicant list.
- **FR-002**: The system MUST let an administrator read and write the admission
  form of an application they did not own, for statuses where the applicant may
  edit.
- **FR-003**: The system MUST let an administrator upload documents and payment
  proof against a chosen application.
- **FR-004**: The system MUST let an administrator submit a chosen application.
- **FR-005**: Every administrator on-behalf operation MUST be authorised by a
  permission, never by a role-name comparison.
- **FR-006**: The administrator form flow MUST reuse the existing seven step
  components rather than introduce a second copy of the form.
- **FR-007**: On success the system MUST show the registration number, email, and
  password exactly once, with a copy affordance.
- **FR-008**: The system MUST NOT expose an administrator-set password after the
  completion panel is dismissed.

**Blank states**

- **FR-009**: `/registration` MUST render an explanatory empty state when the
  signed-in account has no application.
- **FR-010**: `/registration/form` MUST render an explanatory empty state when the
  signed-in account has no application.
- **FR-011**: Each empty state MUST offer a working next action, with no control
  the account is not permitted to use.

**Google sign-in**

- **FR-012**: The login page MUST offer a Google sign-in control.
- **FR-013**: The control MUST direct the browser to the identity service Google
  endpoint and state this application as the return target.
- **FR-014**: The application MUST serve a callback route that consumes the
  identity service redirect, restores the session, and routes the user onward.
- **FR-015**: The identity service MUST accept only return targets on a
  configured allowlist; an unlisted or absent target MUST fall back to the
  configured default. Arbitrary redirect targets are forbidden.
- **FR-016**: A callback for an email with no account MUST show the
  not-registered message and a registration link.
- **FR-017**: The callback MUST NOT create an account. Google sign-in is only for
  accounts that already exist.
- **FR-018**: A failed or unreachable identity service during callback MUST be
  reported as a service outage.

**Form polish**

- **FR-019**: Registration MUST use the shared floating-label field and schema
  validation, consistent with the rest of the application.
- **FR-020**: Login and registration MUST offer password visibility toggles that
  report their state to assistive technology.
- **FR-021**: Validation errors MUST be attached to their field and announced.
- **FR-022**: A successful registration MUST show a dedicated success state with
  the registration number.

**Cross-cutting**

- **FR-023**: Any base-component or shared-platform change MUST be mirrored to
  every web application in the workspace that carries the same file; there is no
  sync tooling.
- **FR-024**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are deployment
  configuration and MUST NOT be committed with real values.

### Key Entities

- **Applicant account**: the identity a parent signs in with. Owns exactly one
  application in the admission flow. May be linked to a Google identity.
- **Admission application**: the record being filled. Belongs to a wave, has a
  status that decides editability, and owns documents, payment, and
  notifications.
- **Wave**: the intake period. Decides whether registration is open and holds the
  registration fee.
- **Google identity link**: provider plus provider user id plus email, attached
  to an existing account. Never a standalone identity.
- **OAuth return target**: the application the browser returns to after the
  provider callback. Validated against an allowlist.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can register an applicant and reach a submitted
  application without leaving `/admin/applicants`.
- **SC-002**: An applicant created by an administrator can sign in and see the
  completed application on the first attempt.
- **SC-003**: Both applicant screens render a non-empty state for every signed-in
  account, including one with no application.
- **SC-004**: An unknown Google email reaches an explanatory message rather than a
  blank page or a silently created account.
- **SC-005**: Every interactive control on login and registration responds to
  keyboard navigation, with no console errors on either screen.

## Assumptions

- The identity service Google flow is complete and correct as published; this
  feature consumes it and does not redesign it. Only the return-target allowlist
  is new server work.
- Administrators hold `admissions.read` today; the new write permission is added
  to the catalogue and granted to the roles that already manage admissions.
- The applicant's password is handed over out of band. The system does not send
  email; delivery is the administrator's action.
- Google sign-in is available only to accounts that already exist. Self-service
  Google registration is explicitly out of scope.
- The known `/settings` 404 is a pre-existing platform gap and is out of scope.
- A DRAFT application abandoned mid-flow is an acceptable, visible, repairable
  state.

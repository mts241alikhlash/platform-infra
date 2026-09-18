# Feature Specification: Public Sign-Up Dialog with Google Sign-Up

**Feature Branch**: `002-public-signup-google`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Registration should collect only name, email, and password, with the rest of the data completed inside. It should appear as a popup dialog on the landing page, with a Google sign-up option added. The wave is picked automatically, hidden from the sign-up dialog, and shown locked in the application form."

## Context

`admission-web`'s public sign-up is currently a full page at `/register`. It asks
for name, email, phone, password, password confirmation, and a wave the user
picks from a dropdown, and it creates the applicant account and a DRAFT
application in one step.

Three changes are requested:

1. The sign-up form should be shorter. It collects the identity facts needed to
   create an account, and the rest of the applicant's data is collected later
   inside the application form.
2. Sign-up should be a popup dialog on the landing page rather than a standalone
   page, and it should offer sign-up with Google next to the password form.
3. The admission wave should no longer be a user choice. The school runs one
   active wave at a time, so the wave is selected automatically, kept out of the
   sign-up dialog, and shown to the applicant as a locked value in the form.

This builds on feature `001`, which introduced Google sign-in for accounts that
already exist. This feature adds Google **sign-up**, where a new Google email
becomes a new applicant account and application. It also depends on the
identity service's ability to carry the sign-up intent through the OAuth round
trip, which is a new capability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Parent signs up from the landing page (Priority: P1)

A parent opens the school's landing page, chooses to register, and a dialog
opens over the page. They enter the prospective student's name, an email, and a
password, confirm the password, and submit. The account is created against the
active wave automatically, and they are taken into the application form to fill
the rest of the data.

**Why this priority**: This is the whole request. Shortening the form and
removing the wave choice is what makes sign-up usable for a parent on a phone,
and the popup keeps them on the page that explains the process. It is the MVP.

**Independent Test**: Open the landing page, choose register, complete the
dialog with a new email, and confirm an account and a DRAFT application are
created against the active wave and the applicant lands in the form.

**Acceptance Scenarios**:

1. **Given** the landing page, **When** the visitor activates any register
   action, **Then** a dialog opens over the page without navigating away.
2. **Given** the dialog, **When** it renders, **Then** it asks for name, email,
   password, and password confirmation only, and it does not ask for phone or
   for a wave.
3. **Given** a valid dialog submission, **When** the visitor submits, **Then**
   an applicant account and a DRAFT application are created against the active
   wave, and the visitor is taken into the application form.
4. **Given** a wave is active, **When** the dialog opens, **Then** no wave field
   is shown and the active wave is used without a choice being offered.
5. **Given** no wave is active, **When** the dialog opens, **Then** submission is
   refused with a clear message that registration is not open.
6. **Given** an email already registered, **When** the visitor submits, **Then**
   a clear conflict message is shown and no second account is created.
7. **Given** the dialog is open, **When** the visitor dismisses it, **Then** no
   account is created and the landing page is unchanged.

---

### User Story 2 - Parent signs up with Google (Priority: P2)

A parent who would rather not invent a password chooses "Daftar dengan Google"
in the sign-up dialog. They sign in with Google, and because they arrived
through sign-up rather than sign-in, a new account is created for them, given
the applicant role, and linked to an application on the active wave. They land
in the application form.

**Why this priority**: It is the second half of "usable for parents", and it is
the reason the identity service must learn the sign-up intent. It is not P1
because the password path in Story 1 already unblocks the same parents.

**Independent Test**: From the sign-up dialog, choose Google with an email that
has never been used; confirm an applicant account and a DRAFT application are
created and the form opens. Then repeat with an email that already has an
account; confirm it signs in to the existing application instead of creating a
duplicate.

**Acceptance Scenarios**:

1. **Given** the sign-up dialog, **When** it renders, **Then** a "Daftar dengan
   Google" control is present below the password form.
2. **Given** the visitor chooses Google sign-up, **When** the browser returns
   after a successful Google authorization, **Then** a new account is created,
   given the applicant role, and attached to an application on the active wave.
3. **Given** a Google email that already has an account with an application,
   **When** it is used through sign-up, **Then** the visitor is signed in to the
   existing account rather than given a second one.
4. **Given** a Google email already used for an account, **When** sign-up is
   attempted, **Then** a duplicate account is never created.
5. **Given** sign-up with Google is disabled by the deployment, **When** the
   control is used with an unknown email, **Then** the visitor is told the
   account is not registered instead of an account being created.
6. **Given** the identity service is unreachable, **When** Google sign-up is
   activated, **Then** the failure is reported as a service outage, not as an
   invalid sign-up.

---

### User Story 3 - Applicant sees the chosen wave in the form (Priority: P3)

An applicant who signed up opens the application form and sees the wave they are
registered under shown as a locked field. They cannot change it, and they can
read which wave and academic year their application belongs to.

**Why this priority**: It closes the loop on the automatic selection. It is P3
because the application still works without it, but the applicant would
otherwise have no way to see which wave they were placed in.

**Independent Test**: Sign up, open the form, and confirm a locked wave field
shows the active wave and cannot be edited.

**Acceptance Scenarios**:

1. **Given** an applicant with an application, **When** the form opens, **Then**
   the wave is shown as a field that cannot be changed.
2. **Given** the locked wave field, **When** the applicant reads it, **Then** it
   names the wave and its academic year.

---

### Edge Cases

- What happens when no wave is active at the moment of sign-up, but one opens
  moments later? The sign-up is refused with the "not open" message and can be
  retried; no account is created without a wave.
- What happens when the same person submits the dialog twice quickly? Only one
  account and one application exist; the second attempt reports the email as
  already registered.
- What happens when a Google email is new but the deployment has sign-up
  disabled? No account is created and the not-registered message is shown.
- What happens when the OAuth round trip returns without the sign-up intent?
  The visitor is treated as an ordinary sign-in, preserving the behavior from
  feature `001`.
- What happens when an account exists with the applicant role but no
  application (for example, a sign-up interrupted mid-flight)? Opening the form
  completes the missing application rather than showing an empty screen.

## Requirements *(mandatory)*

### Functional Requirements

**Sign-up dialog**

- **FR-001**: The landing page MUST open sign-up as a dialog over the page, not
  as a navigation to a separate page.
- **FR-002**: Every existing entry point that currently leads to the standalone
  sign-up page MUST open the dialog instead, and MUST NOT lead to a dead route.
- **FR-003**: The sign-up dialog MUST collect name, email, password, and
  password confirmation, and MUST NOT collect phone or wave.
- **FR-004**: The sign-up dialog MUST validate each field and attach its error
  to that field.
- **FR-005**: The sign-up dialog MUST offer a password visibility control that
  reports its state to assistive technology.
- **FR-006**: On success, the visitor MUST land in the application form, and the
  dialog MUST NOT remain open.

**Automatic wave selection**

- **FR-007**: The sign-up MUST select the active wave without asking the user to
  choose one.
- **FR-008**: When no wave is active, sign-up MUST be refused with a clear
  message and MUST NOT create an account.
- **FR-009**: The application form MUST show the applicant's wave as a locked
  field naming the wave and its academic year, and MUST NOT allow it to change.

**Google sign-up**

- **FR-010**: The sign-up dialog MUST offer sign-up with Google below the
  password form.
- **FR-011**: Sign-up with Google MUST be distinguishable from sign-in with
  Google, so that a new Google email becomes a new applicant account only when
  it arrived through sign-up.
- **FR-012**: A new announcement of sign-up capability MUST be opt-in at the
  deployment level: when it is disabled, an unknown Google email MUST NOT create
  an account and MUST be told the account is not registered.
- **FR-013**: A Google email that already has an account MUST sign in to that
  account and MUST NOT create a second one.
- **FR-014**: A new applicant from Google MUST receive an application on the
  active wave, so that they arrive at the form with the same starting point as a
  password sign-up.
- **FR-015**: When an applicant account exists without an application, opening
  the form MUST complete the missing application instead of showing an empty
  screen.
- **FR-016**: An unreachable identity service during Google sign-up MUST be
  reported as a service outage.

**Cross-cutting**

- **FR-017**: The sign-up dialog MUST work at mobile widths without horizontal
  overflow, with tap targets of at least 44 pixels.
- **FR-018**: The dialog MUST be dismissible by keyboard and MUST return focus
  sensibly, and every control MUST be reachable and operable by keyboard.
- **FR-019**: The behavior change to identity services' Google flow MUST
  preserve existing sign-in behavior for every application in the workspace.
- **FR-020**: The sign-up dialog MUST be the single sign-up surface; no
  second, divergent sign-up form may remain.
- **FR-021** (added 2026-09-15, follow-up): The sign-in page MUST offer a route
  to sign-up, so that a visitor who arrives there without an account, including
  one who has just signed out, is not left with no way to register. The route
  MUST be opt-in per application, because the shared sign-in component is used
  by applications that have no sign-up flow.

### Key Entities *(include if data involved)*

- **Applicant account**: A person who can sign in and own one application. Has
  an identity (name, email) and the applicant role.
- **Application**: A DRAFT record owned by an applicant, belonging to exactly
  one wave. Holds the applicant's data, documents, and payment as it is filled
  in.
- **Wave**: A registration period with a start, an end, a quota, and a fee. At
  most one is active at a time in practice; the active one is chosen
  automatically at sign-up.
- **Sign-up intent**: A marker carried through the Google round trip that
  distinguishes "create me an account" from "sign me in".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can complete sign-up from the landing page without
  leaving the page, in under one minute.
- **SC-002**: The sign-up dialog asks for fewer fields than the previous form,
  and no wave choice is required at any point during sign-up.
- **SC-003**: 100% of sign-ups, by password or by Google, result in an
  application attached to the active wave, verified against a signed-in view of
  the form.
- **SC-004**: No sign-up path creates a duplicate account for an email that
  already exists, by password or by Google.
- **SC-005**: With Google sign-up disabled, an unknown Google email creates no
  account in 100% of attempts.
- **SC-006**: Every register entry point on the landing page opens the dialog,
  with zero links to a removed or dead route.

## Assumptions

- The school runs one active wave at a time, so "choose the active wave" needs no
  tie-breaker when more than one is active; the earliest-open active wave is used
  and this is acceptable.
- "Name" in sign-up means the prospective student's full name, as the previous
  form collected it.
- Phone is optional and can be collected later inside the application form,
  which already carries it.
- Sign-up with Google, when enabled, still requires the Google email to be
  verified before an account is created.
- The applicant role and the applicant form already exist; this feature changes
  how an applicant first arrives, not what the form collects.
- Feature `001`'s sign-in with Google remains available and unchanged.
- The three services that back admission-web (identity, academic, admission)
  are already running in any environment where this is tested.

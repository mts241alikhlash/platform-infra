# Quickstart: Public Sign-Up Dialog with Google Sign-Up

**Feature**: `002-public-signup-google` | **Date**: 2026-09-14

Runnable scenarios that prove the feature end to end. Run them after implementing
each repository, in the order below (identity → admission → web), because the
later ones consume the earlier ones.

---

## Prerequisites

- `pnpm prisma:generate` in `identity-service` and `admission-service` (always
  safe, required in a fresh checkout).
- PostgreSQL for both services, migrations applied (`pnpm prisma:deploy`), and an
  active admission wave seeded (`isActive = true`, `startDate <= today <= endDate`).
- identity-service running with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_CALLBACK_URL`, `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL`,
  `GOOGLE_OAUTH_REDIRECT_ALLOWLIST` including `http://localhost:5175`, and
  `GOOGLE_SIGNUP_ENABLED` set per scenario.
- admission-service running, with `IDENTITY_SERVICE_URL` pointing at
  identity-service and a valid `PROVISIONING_SERVICE_TOKEN`.
- admission-web running (`pnpm dev`, port 5175).

---

## S1 — Password sign-up from the landing dialog

1. Open `http://localhost:5175/`.
2. Activate any register control (navbar, hero, wave section, CTA).
   **Expect**: a dialog opens over the landing page; the URL does not change.
3. **Expect**: the dialog asks for name, email, password, confirmation only —
   no phone, no wave, no wave list fetched.
4. Submit with a fresh email.
   **Expect**: dialog closes; the browser is on the application form; the form's
   locked wave field names the active wave and its academic year.
5. Verify `POST /admissions/register` was called **without** `waveId`, and that
   the created application's `waveId` is the active wave.

**Covers**: FR-001, FR-003, FR-006, FR-007, FR-009; SC-001, SC-002, SC-003.

---

## S2 — No active wave

1. Deactivate every wave (`isActive = false`, or set the window so today falls
   outside it).
2. Open the dialog and submit a fresh email.
   **Expect**: a clear "registration is not open" message; no account created.
3. Reactivate a wave, submit again.
   **Expect**: it succeeds.

**Covers**: FR-008; spec Edge Case 1.

---

## S3 — Duplicate email by password

1. Register an email via S1.
2. Open the dialog again (as a guest) and submit the same email.
   **Expect**: a conflict message tied to the email field; no second account.

**Covers**: FR-004, SC-004; spec Edge Case 2.

---

## S4 — Google sign-up, new email, enabled

1. Set `GOOGLE_SIGNUP_ENABLED=true`, restart identity-service.
2. Open the dialog, activate "Daftar dengan Google".
   **Expect**: Google consent screen; the start URL carried `intent=signup`.
3. Complete consent with an email that has never been used.
   **Expect**: return to `/oauth/callback?oauthOutcome=signup-created...`; the
   applicant lands on the application form with a DRAFT application on the
   active wave.
4. Query identity-service: the new user has the `APPLICANT` role and one
   `OAuthAccount`.

**Covers**: FR-010, FR-011, FR-014, SC-003.

---

## S5 — Google sign-up, existing email

1. With `GOOGLE_SIGNUP_ENABLED=true`, sign up with Google using an email that
   already has an account.
   **Expect**: `oauthOutcome=signup-existing`; the visitor is signed in to the
   existing account and lands on their existing application. No second account.

**Covers**: FR-013, SC-004.

---

## S6 — Google sign-up disabled

1. Set `GOOGLE_SIGNUP_ENABLED=false`, restart identity-service.
2. Sign up with Google using an unknown email.
   **Expect**: no account created; the browser lands on `/?signup=1` with a
   "belum terdaftar" message; no session cookie is set.

**Covers**: FR-012, SC-005; spec Edge Case 3.

---

## S7 — Interrupted sign-up is completed by the form

1. Create an account with the `APPLICANT` role and **no** application (delete
   the application row, or interrupt at the right moment).
2. Sign in and navigate to the application form.
   **Expect**: instead of an empty screen, the application is created on the
   active wave and the form opens. Calling the ensure endpoint twice creates
   only one application.

**Covers**: FR-015; spec Edge Case 5; Principle VIII idempotency.

---

## S8 — Existing sign-in is untouched

1. With `GOOGLE_SIGNUP_ENABLED=true`, sign **in** with Google from `/login`
   (no intent).
   **Expect**: `oauthOutcome` is absent; behavior is identical to feature `001`,
   including the roleless-account case for an unknown email.

**Covers**: FR-011, FR-019.

---

## S9 — Entry points and no dead route

1. Visit `/register` directly.
   **Expect**: redirect to `/?signup=1`, dialog opens; no 404.
2. On the `ApplicantDashboardView` empty state, activate the create-account
   action.
   **Expect**: the dialog opens (or a route that opens it), never `/register` as
   a standalone form.
3. Search the landing components for `/register` links.
   **Expect**: none remain as navigation to a form.

**Covers**: FR-002, FR-020, SC-006.

---

## S10 — Mobile and keyboard

1. At 320 px wide, open the dialog.
   **Expect**: no horizontal scroll; controls ≥44 px; content scrolls if short.
2. Tab through the dialog: every control reachable, password toggle reports
   `aria-pressed`, focus stays inside.
3. Press Escape.
   **Expect**: the dialog closes and focus returns to the control that opened it.

**Covers**: FR-005, FR-017, FR-018.

---

## Per-repository gates

Run in each repository before considering the work done:

- `pnpm validate` (format:check → lint → typecheck → lint:strict → test → build)
  in `identity-service`, `admission-service`, `admission-web`.

Targeted while iterating:

- identity-service: `pnpm test oauth-login oauth-redirect`
- admission-service: `pnpm test register-applicant ensure-my-application`
- admission-web: `pnpm test` (dialog + callback specs)

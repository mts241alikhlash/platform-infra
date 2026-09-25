# Contract: Sign-up dialog UI

**Feature**: `002-public-signup-google` | **Owner**: admission-web

The single sign-up surface. One component, `SignUpDialog.vue`, mounted once on
`LandingView.vue`; every register control opens it.

---

## Opening and closing

| Trigger | Result |
| --- | --- |
| Any register control on the landing page | opens the dialog, no navigation |
| `/?signup=1` | `LandingView` opens the dialog on mount and removes the query |
| `/register` | route redirects to `/?signup=1` — never a dead route (FR-002, SC-006) |
| Dismiss (×, overlay, Escape) | closes; no account created; landing page unchanged |
| Successful password sign-up | dialog closes; router goes to the application form (FR-006) |

State lives in `useSignUpDialog.ts` so the navbar, hero, wave section and CTA
share one open flag without prop-drilling.

---

## Fields

| Field | Required | Notes |
| --- | --- | --- |
| `fullName` | yes | min 3, max 100 — same messages as today |
| `email` | yes | email format |
| `password` | yes | min 8, with a visibility toggle that reports state via `aria-pressed` (FR-005) |
| `passwordConfirm` | yes | must match |

**Not present**: phone (FR-003), wave (FR-003, FR-007). No wave is fetched to
render the dialog.

Validation is `vee-validate` + `zod`, errors attached per field, exactly as the
current `RegisterView` does.

---

## Password path

1. Submit → `publicAdmissionService.register({ fullName, email, password, passwordConfirm })`.
   No `waveId`.
2. `201` → close the dialog, `router.push({ name: 'applicant-form' })`.
3. `409` → field-level error: the email is already registered; offer sign-in.
4. `400` "registration is not open" → dialog-level message; submit stays
   available so a retry after a wave opens succeeds (spec Edge Cases).
5. `503` → outage message via the shared `notifyIfOutage` path.

---

## Google path

Below the password form, separated by an "atau" rule, a "Daftar dengan Google"
button, visually matching `LoginForm.vue`'s Google button (same inline SVG,
same outline variant).

Activation navigates to
`authApi.googleStartUrl(window.location.origin, 'signup')` — the start URL gains
an intent argument. The dialog does not close first; the browser leaves the
page, so there is no half-open dialog to return to.

On return, `OAuthCallbackView.vue` handles it:

| `oauthOutcome` | Behavior |
| --- | --- |
| `signup-created` | restore session, call ensure, redirect to the form |
| `signup-existing` | restore session, call ensure, redirect to the form |
| `signup-disabled` | no session; the redirect already landed on `/?signup=1` with a message |
| (absent) | existing feature-`001` behavior, unchanged |

For `signup-created` and `signup-existing` the callback calls the ensure
endpoint before routing, so an account whose application write was interrupted
gets its application rather than an empty screen (FR-015).

---

## Locked wave field

In `ApplicationFormView.vue`, above the steps and next to the existing
registration number, a read-only field shows the wave:

- label "Gelombang Pendaftaran"
- value `application.wave.name` and its academic year name
- disabled / `readonly`, no input, not focusable as an editable control
- never submits, never appears in any step payload

This is display, not an input control, so it does not affect the wizard's
`buildStepPayload`.

---

## Accessibility and layout (FR-017, FR-018)

- Dialog content is scrollable on short viewports; no horizontal overflow at
  320 px.
- Every control ≥44 px tall; primary action full width on mobile.
- Focus moves into the dialog on open, is trapped, and returns to the triggering
  control on close (reka-ui `Dialog` via the existing `@/ui/dialog` primitive).
- Escape dismisses. Title and description are announced via `DialogTitle` /
  `DialogDescription`.

---

## Removed

`RegisterView.vue` no longer renders a sign-up form. Either it is deleted and
the `/register` route points at the redirect, or it becomes the redirect itself.
No second sign-up form remains (FR-020).

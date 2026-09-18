# Task 4 Report — US1 MVP: sign-up dialog, entry points, `/register` redirect

**Status:** DONE

## Files changed

### New

- `src/features/admission/composables/useSignUpDialog.ts` — module-scoped
  `isOpen` ref with `open` / `close`, exactly as the brief specifies.
- `src/features/admission/components/SignUpDialog.vue` — the single sign-up
  surface on `@/ui/dialog` (`Dialog`, `DialogScrollContent`, `DialogHeader`,
  `DialogTitle`, `DialogDescription`); `modelValue` / `update:modelValue`;
  vee-validate + zod with the four fields and the exact messages; both password
  visibility toggles copied from `RegisterView.vue`; the Google button below the
  `atau` rule, inline SVG, `outline` variant.
- `src/features/admission/components/SignUpDialog.spec.ts` — T029.

### Changed

- `src/features/admission/views/LandingView.vue` — imports and mounts one
  `<SignUpDialog v-model="isOpen" />`; on mount `route.query.signup === '1'`
  opens it and `router.replace({ query: {} })` clears the query.
- `src/features/admission/components/landing/LandingNavbar.vue` — both `/register`
  links (desktop and mobile) became buttons calling `open()`; the mobile one
  calls `openFromMenu()` which closes the menu first. The `/login` links stay.
- `src/features/admission/components/landing/LandingHero.vue` — the primary
  "Daftar Sekarang" `RouterLink` and the wave-card "Mulai Pendaftaran"
  `RouterLink` became buttons calling `open()`; arrows and styling kept.
- `src/features/admission/components/landing/LandingWaveSection.vue` — header,
  per-card and mobile `/register` links became buttons calling `open()`; the
  per-card `?wave=` deep link is dropped. `RouterLink` import removed.
- `src/features/admission/components/landing/LandingCta.vue` — `/register` link
  became a button calling `open()`; `RouterLink` import removed.
- `src/features/admission/routes.ts` — `/register` is now
  `redirect: { name: 'landing', query: { signup: '1' } }`, keeping the `meta`.
  The `register` route name is gone.
- `src/features/admission/types/index.ts` — Ruling 2: added
  `PublicRegisterPayload` (no `waveId`); `RegisterPayload` keeps `waveId`
  required for the admin flow.
- `src/features/admission/api/admissionApi.ts` — `register` now takes
  `PublicRegisterPayload`; `adminRegisterApplicant` keeps `RegisterPayload`.
- `src/features/admission/services/publicAdmissionService.ts` — `register` takes
  `PublicRegisterPayload` and its failure branch now carries `status` and
  `outage`, plus the existing `error`, so the dialog can distinguish 409/400/503
  without reaching past the service.
- `src/features/admission/views/ApplicantDashboardView.vue` — the non-admin
  empty action points at `{ name: 'landing', query: { signup: '1' } }`.
- `src/app/providers/router/router.spec.ts` — T030 addition.

### Deleted

- `src/features/admission/views/RegisterView.vue`. `grep` confirms nothing
  imports it.

## Ruling 2 — chosen shape

`PublicRegisterPayload` (no `waveId`) for the dialog, `RegisterPayload`
(`waveId` required) left untouched for the admin flow. Public endpoint uses the
former in `admissionApi.register` and `publicAdmissionService.register`;
`adminRegisterApplicant` and `useAdminRegistration` keep the latter. No `any`.

## Google button and `'signup'`

The button does **not** pass `'signup'` yet. `authApi.googleStartUrl` still takes
one argument (`packages/platform/src/features/auth/api/authApi.ts:17`), and the
intent parameter is Phase 5's T046. Per the brief I called the current one-arg
form, `authApi.googleStartUrl(window.location.origin)`, and left a clear path:
when T046 adds the intent argument, `SignUpDialog.vue`'s `startGoogleSignUp`
becomes `authApi.googleStartUrl(window.location.origin, 'signup')`. The dialog
does not close first.

## TDD evidence

**Red run 1** (specs written first, implementation absent):
`Test Files 2 failed (2)` / `Tests 1 failed | 4 passed (5)`

- `SignUpDialog.spec.ts [ … ] Error: Failed to resolve import "./SignUpDialog.vue" … Does the file exist?`
- `router.spec.ts > redirects /register into the landing route instead of a form
  AssertionError: expected 'register' to be 'landing'` (the route still resolved
  to the old page component).

**Red run 2** (component created, behavior stubbed/incomplete): the
implementation was correct but the spec helper did not flush the promise
microtask chain, producing 3 spurious failures
(`expected 'false' to be 'true'` on `aria-invalid`, dialog message absent,
`update:modelValue` not emitted). Diagnosed with a temporary debug spec that
showed `setFieldError` had populated `errors` (`{"email":"…"}`) and the success
path did emit `update:modelValue: [[false]]`. Fixed the helper's flush, not the
component. Removed the debug spec.

**Green:** `Test Files 12 passed (12)` / `Tests 82 passed (82)` (was 11 files /
76 tests; +1 file, +6 tests).

## Verification

From `D:\Project\241 Apps\admission-web`:

1. `pnpm validate` → all green:
   - `format:check` — `All matched files use Prettier code style!`
   - `lint` (max-warnings=0) — clean
   - `typecheck` (`vue-tsc -b --noEmit`) — clean
   - `lint:strict` — clean
   - `test` — `Test Files  12 passed (12)` / `Tests  82 passed (82)`
   - `build` — `✓ built in 5.02s` (one pre-existing
     `INEFFECTIVE_DYNAMIC_IMPORT` advisory on `src/i18n/locales/en.ts`,
     unrelated).
2. Grep confirmation: no `RegisterView` match anywhere under `src`; no `/register`
   match in `src/features/admission/components/landing/`. The only `/register`
   occurrences are the redirect record in `routes.ts` and the new tests.

## Judgment calls

1. **Service extended, not bypassed.** `publicAdmissionService.register`'s error
   branch gained `status` and `outage` (it already returned `success` / `error`).
   This keeps the 409/400/503 decision inside the service contract, as the brief
   allowed, rather than reading `error.response` in the component. `notifyIfOutage`
   still runs inside the service; the dialog only suppresses a second message for
   an outage (`result.outage`).
2. **400 message.** The brief asks for a dialog-level message for the 400
   "registration is not open" case and for submit to stay enabled. The dialog
   shows `Pendaftaran sedang tidak dibuka.` at dialog level and does not set
   `isSubmitting` permanently or disable the button, so a retry succeeds. No em
   dash.
3. **409 message.** Field-level via `setFieldError('email', …)`, the dialog stays
   open, and the `Masuk di sini` (`/login`) link remains as the sign-in
   affordance. The exact conflict string from the backend is not surfaced as a
   field error; the field shows a localized conflict message instead.
4. **Login failure after a successful register (Ruling 1).** If `loginUser`
   rejects, the dialog stays open and shows the login error plus
   `Akun sudah dibuat, silakan masuk.`, so the visitor knows the account exists
   and can sign in. Not silently ignored.
5. **`DialogScrollContent` used, controls ≥44px.** Password inputs and the
   submit and Google buttons use `h-11` (44px); the visibility toggle is
   `size-11`. `DialogScrollContent` supplies the overlay, `X` close and the
   scroll container, and reka-ui supplies the focus trap, Escape-to-close and
   focus return. No hand-rolled dialog behaviour.
6. **Disabled submit does not block retry.** Submit is disabled only while
   `isSubmitting`; error branches reset it in `finally`.
7. **Router spec isolation.** `resolve('/register')` does not follow a redirect
   in vue-router, so the test pushes `/register` on a router built from a stub
   `landing` route plus the real `/register` record. This proves the redirect
   target without loading the real `LandingView` (which references `/logo.webp`
   and cannot render in the node test environment).
8. **antislop Delivery Gate.** Direction inherited: only existing tokens and the
   existing `LoginForm` Google-button pattern; no new colour, gradient, glow,
   decorative shadow, or animation. No `—` in any new string (checked
   programmatically across the new files). Google SVG is `aria-hidden="true"`;
   both toggles keep `aria-label` and `aria-pressed`. Dialog content scrolls via
   `DialogScrollContent` and the content is `max-w-md`; primary submit and Google
   buttons are full width on mobile. R-26: every control does something (open,
   submit, toggle, navigate, OAuth redirect). The `Masuk` links point at the
   existing `/login`; the Google button starts the real OAuth flow. R-35: the app
   builds and the tests exercise render, validation, toggle state, 409, 400 and
   success.

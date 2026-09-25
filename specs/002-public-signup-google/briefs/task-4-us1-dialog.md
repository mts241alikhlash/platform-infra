# Task Brief — Phase 4 US1 (MVP): sign-up dialog, entry points, /register redirect

## What this is

The MVP. The landing page gains a `SignUpDialog` that collects name, email,
password and confirmation, signs the visitor up, and lands them in the
application form. Every register control opens it. `/register` stops being a page
and becomes a redirect into the dialog. The standalone `RegisterView.vue` form
disappears.

## Binding designs

- `D:\Project\241 Apps\specs\002-public-signup-google\contracts\signup-dialog-ui.md`
- `D:\Project\241 Apps\specs\002-public-signup-google\quickstart.md` S1, S2, S3, S9, S10
- `D:\Project\241 Apps\specs\002-public-signup-google\spec.md` FR-001..FR-009, FR-020, SC-001..SC-006

## Two rulings you must follow (mine, recorded in the ledger)

**Ruling 1 — the dialog signs the new applicant in.**
`POST /admissions/register` creates the account and returns no session. The
application form route has `requiresAuth: true` (admission-web
`src/app/providers/router/index.ts:85`), so FR-006 ("the visitor MUST land in the
application form") is unreachable without a session. Therefore, after a
successful register the dialog MUST call:

```ts
await authService.loginUser({ identifier: email, password })
```

(`authService` is imported from `@/features/platform/auth`; it sets the access
token, fetches identity, persists the user and updates the store. Do not
reimplement it, and do not write a parallel login.) Only then
`router.push({ name: 'applicant-form' })`. If the login step fails, keep the
dialog open and show the login error; the account already exists, so the message
should tell the visitor to sign in. Cost if wrong: none; this is the only path
that satisfies FR-006.

**Ruling 2 — the public register payload has no wave, and the admin one keeps it.**
`RegisterPayload` currently carries `waveId` and is shared by the public dialog
and the admin on-behalf flow. Split by use, not by widening:

- Public (dialog): a payload **without** `waveId`. Either drop `waveId` from
  `RegisterPayload` and give the admin flow `RegisterPayload & { waveId: string }`,
  or introduce `PublicRegisterPayload` (no `waveId`) and leave `RegisterPayload`
  as the admin type. Pick one and be consistent. No `any`.
- `adminRegisterApplicant` and `useAdminRegistration` MUST still send a required
  `waveId` (that endpoint keeps the waveId-required DTO, done in Phase 3).

## Files

### `src/features/admission/composables/useSignUpDialog.ts` (new)

Module-level shared state so navbar, hero, wave section and CTA share one flag
without prop drilling. Small and plain:

```ts
import { ref } from 'vue'

const isOpen = ref(false)

export function useSignUpDialog() {
  function open() { isOpen.value = true }
  function close() { isOpen.value = false }
  return { isOpen, open, close }
}
```

`isOpen` is module-scoped, so every caller gets the same ref. No store, no
provide/inject.

### `src/features/admission/components/SignUpDialog.vue` (new)

The single sign-up surface. Requirements:

- Built on `@/ui/dialog` (`Dialog`, `DialogScrollContent`, `DialogHeader`,
  `DialogTitle`, `DialogDescription`). `DialogScrollContent` already renders the
  overlay, the `X` close control, and the scroll container, and reka-ui gives you
  focus trap, Escape-to-close and focus return to the trigger for free. Do not
  hand-roll any of that.
- Props: `modelValue: boolean`; emits `update:modelValue` (so `LandingView` can
  bind `useSignUpDialog`'s `isOpen`).
- Fields, using `vee-validate` `useForm` + `toTypedSchema(zod)` exactly as
  `RegisterView.vue` did, with `FloatingField` / `FormControl` / `Input`:
  - `fullName`: required, min 3, max 100. Messages: `'Nama lengkap wajib diisi'`,
    `'Nama lengkap minimal 3 karakter'`.
  - `email`: required, valid email. `'Email wajib diisi'`, `'Format email tidak valid'`.
  - `password`: min 8. `'Kata sandi minimal 8 karakter'`.
  - `passwordConfirm`: required, must equal `password`. `'Konfirmasi kata sandi wajib diisi'`,
    `'Konfirmasi kata sandi tidak cocok.'`
  - **No `phone`. No `waveId`. Do not call `fetchActiveWaves` in this component.**
- Each password field has the visibility toggle copied from `RegisterView.vue`
  (`Eye`/`EyeOff`, `:aria-pressed`, `:aria-label`, focus ring classes). Keep
  `aria-pressed` reporting the actual state (FR-005).
- Submit handler (the password path from `signup-dialog-ui.md`):
  1. `publicAdmissionService.register({ fullName: trimmed, email: trimmed, password, passwordConfirm })` — no `waveId`.
  2. `201` → `authService.loginUser({ identifier: email.trim(), password })`
     (Ruling 1), close the dialog, `router.push({ name: 'applicant-form' })`.
  3. `409` → attach the conflict to the **email** field (`setFieldError('email', ...)`),
     do not close, and show a sign-in affordance
     (`RouterLink to="/login"`), per the contract.
  4. `400` with the "registration is not open" message → dialog-level message;
     **submit stays available** so a retry after a wave opens succeeds. Do not
     disable the button.
  5. `503` → the shared outage path (`notifyIfOutage` is already wired inside
     `publicAdmissionService.register`); do not show it as a field error.
- Google button (FR-010): below the password form behind the same `atau` rule and
  the same inline Google SVG and `outline` variant as
  `LoginForm.vue` (`packages/platform/src/features/auth/components/LoginForm.vue:104-139`).
  Label `'Daftar dengan Google'`. On click:
  `window.location.href = authApi.googleStartUrl(window.location.origin, 'signup')`.
  Do not close the dialog first (the browser leaves the page).
  **Note**: `authApi.googleStartUrl` currently takes only `returnOrigin`. The
  intent argument is added in Phase 5 (T042). Until then, calling it with the
  second argument is still correct to write here only if the signature accepts
  it; if it does not yet, call the current one-arg form and leave a clear path
  for Phase 5 to add `'signup'`. State which you did in the report.

`antislop constraints for this component` (direction: inherit the existing
admission-web design system, dial ENERGY 1 / RHYTHM 1 / MOTION 1):
- Reuse existing tokens and the existing `LoginForm` Google-button pattern. No
  new colors, no gradient, no glow, no decorative shadow, no new animation
  beyond what `Dialog` and the existing form already ship.
- **No em dash character (`—`) in any string.**
- Every control at least 44px tall; primary submit full width on mobile; the
  dialog content must scroll on a short viewport and produce **no horizontal
  overflow at 320px** (FR-017).
- Google icon gets `aria-hidden="true"`; the toggle buttons keep their labels
  (FR-018).

### `src/features/admission/views/LandingView.vue`

- Import `SignUpDialog` and `useSignUpDialog`.
- Mount one `<SignUpDialog v-model="isOpen" />`.
- On mount, if `route.query.signup === '1'`, call `open()` and clear the query
  (`router.replace({ query: {} })`) so a refresh does not reopen it (contract:
  "removes the query").
- If it makes the deep-link cleaner, a small `watch` on `route.query.signup` is
  acceptable, but keep it minimal.

### `src/features/admission/components/landing/LandingNavbar.vue`

Replace both `/register` links (desktop line ~66-68, mobile line ~121-126) with
buttons that call `open()` from `useSignUpDialog()`. Keep the visual style and
labels. The mobile one must also `closeMenu()`.

### `src/features/admission/components/landing/LandingHero.vue`

Replace the `RouterLink to="/register"` (line ~78) around the primary
"Daftar Sekarang" button with a button calling `open()`. Keep the arrow and
styling. Same for the wave-details `RouterLink` (line ~184-189) labelled
"Mulai Pendaftaran".

### `src/features/admission/components/landing/LandingWaveSection.vue`

Replace the header `RouterLink` (line ~46-60), the per-card
`RouterLink :to="{ path: '/register', query: { wave: wave.id } }"` (line ~180-191)
and the mobile `RouterLink` (line ~196-210) with buttons calling `open()`.
The per-card button must **drop** the `?wave=` deep link (the wave is now a
server decision, FR-007). Keep the labels.

### `src/features/admission/components/landing/LandingCta.vue`

Replace the `RouterLink to="/register"` (line ~29-43) with a button calling
`open()`.

### `src/features/admission/routes.ts`

- `/register` becomes a redirect, not a component:
  ```ts
  {
    path: '/register',
    redirect: { name: 'landing', query: { signup: '1' } },
  },
  ```
  Keep the meta (`guestOnly`, `title`, `description`) if a redirect record
  accepts it without error; the important part is that `/register` resolves to
  the landing route and never to a form component (FR-002, FR-020, SC-006).
- Delete `src/features/admission/views/RegisterView.vue`. Confirm nothing else
  imports it (`grep` for `RegisterView` across the repo) before deleting. If
  something still imports it, fix that import rather than keeping the file.

### `src/features/admission/types/index.ts`

Apply Ruling 2. Public payload without `waveId`; admin payload keeps it required.

### `src/features/admission/api/admissionApi.ts` and `services/publicAdmissionService.ts`

`register` uses the public payload type (no `waveId`). `adminRegisterApplicant`
keeps the waveId type. Do not change the URL or the response shape.

### `src/features/admission/views/ApplicantDashboardView.vue`

Its non-admin empty action (line ~41) points at `/register`. Because `/register`
now redirects into the landing dialog, that is not a dead route (FR-002 holds).
Leave the link, or point it directly at `{ name: 'landing', query: { signup: '1' } }`
if you prefer; either is acceptable. State which you chose.

### Tests — write FIRST, watch fail

**`src/features/admission/components/SignUpDialog.spec.ts` (T029)** — mount the
dialog with the UI primitives stubbed or real as practical. Assert:
- the form renders exactly four labelled fields (`fullName`, `email`,
  `password`, `passwordConfirm`) and **no phone and no wave** control;
- the password visibility toggle reports `aria-pressed`;
- a mocked `409` produces an email-field conflict and keeps the dialog open;
- a mocked `400` "registration is not open" keeps submit enabled;
- a successful register closes (emits `update:modelValue false`) and navigates to
  `applicant-form` (mock `vue-router` `useRouter().push` and assert the call).

Mock `@/features/platform/auth`'s `authService.loginUser`, the admission service,
and `vue-router` as the existing specs in this repo do.

**`src/app/providers/router/router.spec.ts` (T030)** — add: resolving `/register`
yields the `landing` route (the redirect target), not a form component.

## Hard constraints

- No new dependency. `reka-ui`, `vee-validate`, `zod`, `lucide-vue-next` are all
  already in use.
- Zero comments in business code.
- Do not touch admission-service or identity-service in this phase.
- No em dash in any new text.
- No git in this workspace. Do not run git. Do not commit.

## Acceptance

From `D:\Project\241 Apps\admission-web`:
1. `pnpm validate` (was 11 files / 76 tests) — all green.
2. `grep` confirms no remaining `RegisterView` import and no remaining
   `/register` `RouterLink` in the landing components or routes.

Report: status, files changed, the exact test summary line, which Ruling-2 shape
you chose, whether the Google button passed `'signup'` yet, and any judgment
calls.

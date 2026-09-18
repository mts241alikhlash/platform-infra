# Task 5 Report: US2 Google sign-up (T041–T050)

## Status

DONE

## Files changed

### identity-service

- `src/auth/application/use-cases/oauth-login/oauth-login.use-case.ts` (modified)
- `src/auth/application/use-cases/oauth-login/oauth-login.use-case.spec.ts` (new)
- `src/auth/presentation/http/auth.controller.ts` (modified)
- `src/auth/presentation/http/auth.controller.spec.ts` (modified)

### admission-web

- `packages/platform/src/features/auth/api/authApi.ts` (modified)
- `packages/platform/src/features/auth/api/authApi.spec.ts` (new)
- `packages/platform/src/features/auth/config.ts` (modified)
- `packages/platform/src/features/auth/views/OAuthCallbackView.vue` (modified)
- `packages/platform/src/features/auth/views/OAuthCallbackView.spec.ts` (new)
- `src/features/admission/components/SignUpDialog.vue` (modified)
- `src/features/admission/components/SignUpDialog.spec.ts` (modified)
- `src/app/main.ts` (modified)

`admission-service` untouched. No git commands run.

## Test summaries

### identity-service (`pnpm test`)

```
Test Suites: 46 passed, 46 total
Tests:       291 passed, 291 total
```

Was 45 / 282. New: `oauth-login.use-case.spec.ts` (7 tests) plus 2 new controller
cases; the suite grew by one suite and nine tests.

### admission-web (`pnpm test`, inside `pnpm validate`)

```
Test Files  14 passed (14)
      Tests  90 passed (90)
```

Was 12 files / 82. New: `authApi.spec.ts` (3 tests), `OAuthCallbackView.spec.ts`
(4 tests), and 1 new `SignUpDialog.spec.ts` case. Total +8.

### Full command results

identity-service:

- `pnpm test` -> `Test Suites: 46 passed, 46 total`, `Tests: 291 passed, 291 total`
- `pnpm lint` -> clean (0 problems)
- `pnpm typecheck` -> clean
- `pnpm lint:strict` -> clean
- `pnpm build` -> `nest build` succeeded

admission-web:

- `pnpm validate` -> `All matched files use Prettier code style!`, ESLint clean,
  `vue-tsc` clean, `lint:strict` clean, `Test Files 14 passed (14)` /
  `Tests 90 passed (90)`, `vite build` -> `built in 4.33s`. Only pre-existing
  `INEFFECTIVE_DYNAMIC_IMPORT` warning on `src/i18n/locales/en.ts`.

## TDD red/green evidence

### identity-service use case

Red run (before implementation): `Tests: 4 failed, 3 passed, 7 total`. The
failures were the right ones: `createUserFromOAuth` called without `roleCode`,
`createUserFromOAuth` called even when the flag was off, and `oauthOutcome`
`undefined` instead of `signup-existing`. The three baseline cases (signin create,
inactive throw path) already passed.

Green run after implementation: `Tests: 7 passed, 7 total`.

### admission-web callback view

Red run (before implementation): `Test Files 1 failed | 12 passed (13)`,
`Tests 3 failed | 83 passed (86)`. `ensureMock` not called for
`signup-created`/`signup-existing`, and `restoreSessionMock` called for
`signup-disabled`. The no-outcome feature-001 case passed already.

Green run after implementation: `Test Files 13 passed (13)`,
`Tests 86 passed (86)`.

## B3 callback-dependency approach

Chosen: extend the existing `authConfig` / `configureAuth` hook with
`ensureApplicantApplication: () => Promise<unknown>`, defaulting to
`() => Promise.resolve(null)`. The feature layer registers the real callback at
startup in `src/app/main.ts`:

```ts
ensureApplicantApplication: publicAdmissionService.ensureMyApplication,
```

Why: no file under `packages/platform` imports a non-platform feature. The only
`@/features/*` imports inside the platform package are intra-platform
(`@/features/platform/...`). `eslint.config.mjs` has no import-boundary rule, so
nothing would have failed, but importing `@/features/admission` from
`packages/platform` would invert the documented dependency direction (platform is
consumed by features). The hook mechanism already existed (`configureAuth` is
called in `src/`), so this reuses the established seam and keeps the platform
package ignorant of the admission feature. `OAuthCallbackView` calls
`authConfig.value.ensureApplicantApplication()` and routes to
`{ name: 'applicant-form' }` regardless of the resolved value, so a `null`
result (outage/no wave) still reaches the form. The view spec mocks `../index`
and sets the hook through `configureAuth`.

## T042 finding (no-op confirmed)

No change to `oauth-redirect.spec.ts`. Phase 2b already covers everything T042
asked for, verbatim:

- state round-trip for both intents: lines 65-88
- `buildCallbackUrl` with `'signup-created'` puts `oauthOutcome=signup-created` on
  `/oauth/callback`: lines 150-161
- `'signup-disabled'` puts `signup=1` on `/` with no `oauthOutcome`: lines
  163-188

Adding duplicate assertions would only restate the same expectations. Reported
instead.

## A3 finding

`ConfigModule` is already global: `AppConfigModule` uses
`NestConfigModule.forRoot({ isGlobal: true, validate: envSchema... })` and is
imported by `app.module.ts`. `ConfigService` is therefore injectable into
`OAuthLoginUseCase` with no change to `auth.module.ts`. Confirmed by `pnpm build`
and by the spec providing a fake `ConfigService`. The flag is read per call via
`this.config.get<boolean>('GOOGLE_SIGNUP_ENABLED')`; the zod
`z.enum(['true','false']).transform(...)` already yields a real boolean.
`auth.module.ts` was not touched.

## Judgment calls

- Controller unchanged decorators. `@Public()`, `@Throttle`, `@UseGuards`, and
  the `@ApiOperation` summary are untouched; only the `@ApiResponse` description
  gained a sentence about `signup-disabled`. `resolveRedirectOrigin`,
  `parseRedirectAllowlist`, and `normalizeOrigin` are byte-identical.
- `signup-disabled` result shape. `execute` returns
  `{ oauthOutcome: 'signup-disabled', profileIncomplete: false }` with no
  `accessToken`, `refreshToken`, `refreshExpiresInMs`, or `user`, and creates no
  `AuthSession`. The controller keys off `result.oauthOutcome` to skip
  `setRefreshTokenCookie`. The use-case return type is a TypeScript union, so the
  controller's `else` branch narrows to the signing-in shape.
- `signup-created` / `signup-existing` view path skips the `unknown-account` role
  check deliberately. The account is known to exist with `APPLICANT`, so the
  callback goes straight to restore + ensure + form. The no-outcome (signin) path
  keeps the exact feature-001 logic including the role check and
  `profileIncomplete` branch.
- `signup-disabled` view state. Added `'signup-disabled'` to `CallbackState`,
  with the suggested heading/body copy (no em dash). No `restoreSession` call, no
  cookie exists. The button routes to `{ name: 'landing' }`. The landing route is
  registered in `admissionPublicRoutes`, which is part of the app router.
- Accessor for the outcome. Added a small `oauthOutcome()` helper that returns
  the query value only when it is a string, to avoid a boolean/array leaking into
  comparisons. `profileIncompleteFlag()` is unchanged.
- B4 outage surfacing. No code added. `proceedSignUp` still goes through
  `authService.restoreSession()`, which calls `notifyIfOutage` on failure and
  returns false, landing on `state = 'outage'`. The new outcomes reuse that exact
  path, so it holds as the brief predicted.
- New tests beyond the brief's list. Added `authApi.spec.ts` (bare URL, no-intent
  default, signup intent) to pin B1 and the FR-019 default, and one
  `SignUpDialog.spec.ts` case asserting the Google button calls
  `googleStartUrl(origin, 'signup')`. Both are cheap regressions for the two
  lines the brief changed.
- `authApi.googleStartUrl`'s no-intent URL is now built with `URLSearchParams`,
  which encodes an origin the same way `encodeURIComponent` did, so
  `LoginForm.vue`'s one-argument call produces the identical effective URL. The
  new spec asserts the no-intent URL contains no `intent=`. `LoginForm.vue` was
  not touched.
- No em dash in any new text. No comments in business code. No new dependency.

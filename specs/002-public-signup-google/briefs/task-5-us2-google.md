# Task Brief — Phase 5 US2: Google sign-up (T041–T050)

## What this is

Google sign-up end to end: the intent travels Google → identity-service → back,
identity-service creates an APPLICANT account plus role when the deployment
allows it, the callback tells the SPA what happened, and the SPA ensures the
application and opens the form. The flag defaults off, and feature-001 sign-in is
untouched.

## Binding designs

- `D:\Project\241 Apps\specs\002-public-signup-google\contracts\oauth-signup.md`
- `D:\Project\241 Apps\specs\002-public-signup-google\contracts\signup-dialog-ui.md` (Google path + callback table)
- `D:\Project\241 Apps\specs\002-public-signup-google\research.md` R3, R4
- `D:\Project\241 Apps\specs\002-public-signup-google\quickstart.md` S4–S8

## Part A — identity-service

### A1. Use case (`src/auth/application/use-cases/oauth-login/oauth-login.use-case.ts`)

Inject `ConfigService` (add it to the constructor; the module already provides it
globally via `ConfigModule`). Read the flag per call so a test can set it:

```ts
private readonly signupEnabled: boolean
```
is not enough because env is read at module init; read inside `execute` via
`this.config.get('GOOGLE_SIGNUP_ENABLED')` — the zod transform already coerces it
to a real boolean.

Add `oauthOutcome` to the return type:
```ts
oauthOutcome?: 'signup-created' | 'signup-existing' | 'signup-disabled'
```

Implement the R4 table in `resolveUser` / `execute`. The cleanest shape is to have
`resolveUser` return the user **and** an outcome, then `execute` merge the outcome
into its return object:

| Intent | `findOAuthAccount` hit | `findUserByEmail` hit | email unknown |
| --- | --- | --- | --- |
| `signin` | sign in, no outcome | link, sign in, no outcome | create roleless (unchanged), no outcome |
| `signup` | sign in, `signup-existing` | link, sign in, `signup-existing` | flag on → create with `roleCode: 'APPLICANT'`, `signup-created`; flag off → **do not create**, `signup-disabled` |

For `signup-disabled` the method must **not** throw and must **not** build a
session: return `{ oauthOutcome: 'signup-disabled', profileIncomplete: false }`
with no `accessToken`, `refreshToken`, `refreshExpiresInMs`, and no `user`, and
create no `AuthSession`. The controller keys off the outcome to skip the cookie.

Everything else in `execute` is unchanged: the first branch (`!user.isActive ||
user.deletedAt`) and the session/token generation still run only for the three
signing-in outcomes.

**Note**: `oauth-login.input.ts` already has `intent: OAuthIntent` from Phase 2b.
Use it. Do not re-add it.

### A2. Controller (`src/auth/presentation/http/auth.controller.ts`, `googleAuthCallback`)

Current code passes `req.query.state` **raw** into `resolveRedirectOrigin`. Once
state is encoded that no longer matches the allowlist. Rewrite:

```ts
const { origin: rawOrigin, intent } = decodeOAuthState(
  typeof req.query.state === 'string' ? req.query.state : undefined,
)

const result = await this.oauthLoginUseCase.execute(
  { ...(req.user as unknown as Omit<OAuthLoginInput, 'intent'>), intent },
  userAgent,
  ipAddress,
)

if (result.oauthOutcome === 'signup-disabled') {
  const origin = resolveRedirectOrigin(rawOrigin ?? undefined, allowlist)
  res.redirect(buildCallbackUrl(origin, fallback, false, 'signup-disabled'))
  return
}

this.setRefreshTokenCookie(res, result.refreshToken, result.refreshExpiresInMs)

const origin = resolveRedirectOrigin(rawOrigin ?? undefined, allowlist)
res.redirect(
  buildCallbackUrl(origin, fallback, result.profileIncomplete, result.oauthOutcome),
)
```

- `allowlist` = the existing `parseRedirectAllowlist(...)` call.
- `fallback` = the existing `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL`.
- Keep the existing `@Public()`, `@Throttle`, `@UseGuards(GoogleAuthGuard)` and
  the ApiResponse description; update the description to mention the two new
  outcomes if you like, but do not change decorators.
- `decodeOAuthState` and the `OAuthIntent`/`OAuthOutcome` types come from
  `../../oauth/oauth-redirect.js`.

**Ruling (recorded, mine)**: `resolveRedirectOrigin` keeps receiving only the
decoded origin, which is what the allowlist checks. The raw state can never be an
allowlist member, so this is the only correct ordering. Cost if wrong: none.

### A3. Flag wiring

`GOOGLE_SIGNUP_ENABLED` already exists in `env.validation.ts` (Phase 2b) and
`.env.example`. Confirm `ConfigService` can read it (`configService.get('GOOGLE_SIGNUP_ENABLED')`)
and that no extra provider is needed. If `auth.module.ts` does not already load
ConfigModule, add `ConfigModule` to its imports and say so in the report.

### A4. Tests (T041, T042) — write FIRST, watch fail

**New `src/auth/application/use-cases/oauth-login/oauth-login.use-case.spec.ts`**.
Mock `IAuthRepository` and `TokenManagerService`; provide a fake `ConfigService`
with `get: (k) => k === 'GOOGLE_SIGNUP_ENABLED' ? <bool> : undefined`. Cases:
- `signin` + unknown email → `createUserFromOAuth` called with **no** `roleCode`,
  no `oauthOutcome`, and a session was created.
- `signup` + unknown email + flag `true` → `createUserFromOAuth` called with
  `roleCode: 'APPLICANT'`, outcome `signup-created`, session created.
- `signup` + unknown email + flag `false` → **no** `createUserFromOAuth`, **no**
  `createSession`, outcome `signup-disabled`, and the result has no `accessToken`.
- `signup` + `findOAuthAccount` hit → outcome `signup-existing`, no create.
- `signup` + `findUserByEmail` hit → `linkOAuthAccount` called, outcome
  `signup-existing`, no create.
- an existing account that is inactive/deleted still throws `UnauthorizedException`.

Follow existing spec style in this repo (`Test.createTestingModule` or plain
construction with mocks — match whichever the repository uses).

**Extend `src/auth/oauth/oauth-redirect.spec.ts`** (T042) with:
- `encodeOAuthState`/`decodeOAuthState` round-trip for both intents (already added
  in Phase 2b — do not duplicate; only add what is missing).
- `buildCallbackUrl` with `'signup-created'` puts `oauthOutcome=signup-created`
  on `/oauth/callback`; with `'signup-disabled'` puts `signup=1` on `/` and no
  `oauthOutcome`.

If Phase 2b already covers these, this task is a no-op for the spec file; say so
rather than adding duplicate assertions.

## Part B — admission-web

### B1. `packages/platform/src/features/auth/api/authApi.ts` (T046)

```ts
googleStartUrl: (returnOrigin?: string, intent?: 'signin' | 'signup') => {
  const base = `${API_BASE_URL}/auth/google`
  if (!returnOrigin) return base
  const params = new URLSearchParams({ redirect: returnOrigin })
  if (intent === 'signup') params.set('intent', 'signup')
  return `${base}?${params.toString()}`
},
```

Default stays `signin`, so `LoginForm.vue` (which calls it with one argument) is
untouched and produces the identical URL as before when no intent is passed.
`URLSearchParams` encoding of an origin is equivalent to `encodeURIComponent` for
this value; the existing `LoginForm` path must still yield the same effective
request.

### B2. `src/features/admission/components/SignUpDialog.vue` (T047)

The Google button already exists from Phase 4 and currently calls
`authApi.googleStartUrl(window.location.origin)`. Change it to
`authApi.googleStartUrl(window.location.origin, 'signup')`. Nothing else about
the button changes.

### B3. `packages/platform/src/features/auth/views/OAuthCallbackView.vue` (T048)

Read `route.query.oauthOutcome`. Add handling:

| `oauthOutcome` | Behavior |
| --- | --- |
| `signup-created` | restore session; call the admission ensure endpoint; then route to the applicant form |
| `signup-existing` | same as above |
| `signup-disabled` | no session attempt; show a state telling the visitor sign-up is not open and they can contact the school; offer a button to the landing page. Do **not** call `restoreSession` (no cookie was set) |
| absent | the existing feature-001 behavior, exactly. Do not change a line of it |

- `ensureMyApplication` lives on `usePublicAdmission()` in `@/features/admission`.
  Importing admission code from the platform package would invert the dependency
  direction (platform is consumed by features, not the reverse). **Check the alias
  boundary first**: if `packages/platform` importing `src/features/admission` is
  not already done anywhere and the lint/dependency rules forbid it, instead
  extend `authConfig` (or the existing post-login hook in `authConfig`) so the
  feature layer supplies the ensure callback and the callback view calls that.
  Use the existing `homeRoute`/`configureAuth` mechanism other apps use. State
  which approach you took and why. **This is the one place the plan is thin; use
  your judgment and record the decision in the report.**
- After ensure succeeds or fails, route to `{ name: 'applicant-form' }`. If ensure
  returns `null` (outage/no wave), still route to the form; the form itself
  handles the empty case (FR-015 is about not showing an empty screen, and the
  form's own empty state + the dashboard cover it). Note this in the report.
- `signup-disabled` heading/message: no em dash. Suggested copy:
  heading `Pendaftaran dengan Google belum dibuka`, body `Pendaftaran akun baru
  sedang tidak dibuka. Hubungi admin sekolah untuk informasi pendaftaran.`
- Keep the existing `unknown-account`, `outage`, `incomplete`, `working` states
  and the `profileIncomplete` logic unchanged.

### B4. Outage surfacing (T049)

- The dialog's register path already routes `503` through `notifyIfOutage`
  (Phase 4). Leave it.
- In `OAuthCallbackView.vue`, an unreachable identity service during the Google
  round trip already lands on `state = 'outage'` when `restoreSession` fails, and
  `restoreSession` itself calls `notifyIfOutage`. Verify that path still holds for
  the new outcomes and note it; add handling only if it is broken.

### B5. Tests (T043) — write FIRST, watch fail

**New or extended `packages/platform/src/features/auth/views/OAuthCallbackView.spec.ts`**:
- `oauthOutcome=signup-created` → restore session runs, ensure is called, router
  goes to the applicant form.
- `oauthOutcome=signup-existing` → same.
- `oauthOutcome=signup-disabled` → `restoreSession` is **not** called, the
  not-open state is shown.
- no `oauthOutcome` → existing feature-001 behavior: session restored and it
  routes to `homeTarget()` (assert the pre-existing behavior is unchanged).

Mock `vue-router`, the auth services, and the ensure source the same way the
existing callback/other auth specs do. Read whatever spec already exists for this
view first and follow its mocking style.

## Hard constraints

- NodeNext ESM in identity-service: relative imports end in `.js`.
- Zero comments in business code.
- No new dependency.
- Do not change `resolveRedirectOrigin`, `parseRedirectAllowlist` or
  `normalizeOrigin`.
- Feature-001 sign-in (`signin` intent, or no `state`) must produce byte-identical
  behavior. This is FR-019.
- No em dash in any new text.
- No git in this workspace. Do not run git. Do not commit.

## Acceptance

From `D:\Project\241 Apps\identity-service`: `pnpm test` (was 45 suites / 282),
`pnpm lint`, `pnpm typecheck`, `pnpm lint:strict`, `pnpm build`.
From `D:\Project\241 Apps\admission-web`: `pnpm validate` (was 12 files / 82).

Report: status, files changed, both test summary lines, which callback-dependency
approach you chose in B3, and any judgment calls.

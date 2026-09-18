# Task Brief — Phase 2b: identity-service sign-up intent plumbing (T009–T015)

## What this is

identity-service's Google OAuth flow must learn a **sign-up intent**, so that a
Google email can be told apart as "create me an account" versus "sign me in".
This phase builds only the plumbing: the intent travels in the OAuth `state`
parameter, and the repository can create a user with a role. The actual decision
logic (create vs refuse) is a later task (T044, User Story 2) — do NOT implement
`resolveUser`'s signup branch here.

Everything in this phase is additive. A caller that sends no intent gets today's
behavior exactly.

## Context (from the design docs)

Contracts: `D:\Project\241 Apps\specs\002-public-signup-google\contracts\oauth-signup.md`
Research decisions R1, R3, R4: `D:\Project\241 Apps\specs\002-public-signup-google\research.md`

Key decisions:
- `state` becomes URL-safe base64 of `{"origin":"<origin>","intent":"<intent>"}`.
- A **bare origin** (no JSON) decodes as `{"origin":"<origin>","intent":"signin"}` —
  this backwards compatibility is required, because existing callers and the
  existing controller test pass a bare origin as `state`.
- `intent` values are exactly `signin` and `signup`; anything else means `signin`.
- The callback redirect gains an `oauthOutcome` query parameter with values
  exactly `signup-created`, `signup-existing`, `signup-disabled`, or omitted.
- For `signup-disabled`, the callback redirects to `<origin>/?signup=1` instead
  of `<origin>/oauth/callback`.
- New env flag `GOOGLE_SIGNUP_ENABLED`, boolean, default `false`.
- `createUserFromOAuth` gains an optional `roleCode`; when present it writes the
  `UserRole` row **inside the same `prisma.user.create`**, mirroring
  `provisionAccount` in `prisma-user.repository.ts:148-191`.

## Files to change, in order

### 1. `identity-service/src/auth/oauth/oauth-redirect.ts`

Keep `parseRedirectAllowlist`, `normalizeOrigin`, `resolveRedirectOrigin` exactly
as they are.

Add:
- A type for the intent: `export type OAuthIntent = 'signin' | 'signup'`.
- `export type OAuthOutcome = 'signup-created' | 'signup-existing' | 'signup-disabled'`.
- `export function encodeOAuthState(origin: string, intent: OAuthIntent): string`
  — URL-safe base64 of `JSON.stringify({ origin, intent })`. URL-safe means
  `+` → `-`, `/` → `_`, and strip `=` padding, because this value is a query
  parameter Google echoes back.
- `export function decodeOAuthState(state: string | undefined | null): { origin: string | null; intent: OAuthIntent }`
  — null/undefined/empty decodes to `{ origin: null, intent: 'signin' }`.
  Try to parse the base64 + JSON. If it works and yields a string `origin`,
  return it with `intent === 'signup' ? 'signup' : 'signin'`. If anything fails
  (not base64, not JSON, no origin) treat the raw string as a **bare origin**:
  return `{ origin: state, intent: 'signin' }`. This is the backwards-compat
  path and must not throw.

Change `buildCallbackUrl` to:
```ts
export function buildCallbackUrl(
  origin: string | null,
  fallbackUrl: string,
  profileIncomplete: boolean,
  outcome?: OAuthOutcome,
): string
```
- As today, base is `new URL('/oauth/callback', origin)` when origin, else
  `new URL(fallbackUrl)`.
- When `outcome === 'signup-disabled'`, the path is the origin root with
  `signup=1`: build `new URL('/', origin)` (fallback: `new URL(fallbackUrl)`),
  set `signup=1`, and still set `profileIncomplete`. Do not set `oauthOutcome`.
- Otherwise set `profileIncomplete` and, when `outcome` is present, set
  `oauthOutcome=<outcome>`.

### 2. `identity-service/src/core/config/env.validation.ts`

Add to the `z.object({...})`, next to the existing `GOOGLE_*` keys (after
`GOOGLE_OAUTH_REDIRECT_ALLOWLIST`):

```ts
GOOGLE_SIGNUP_ENABLED: z.coerce.boolean().default(false),
```

Careful: `z.coerce.boolean()` turns the **string** `"false"` into `true`, because
only `""`, `"0"`, `undefined`, `null`, `NaN` are falsy for JS `Boolean()`. This
is acceptable ONLY if you confirm the deployment sets the var by presence rather
than by value. If the repo has an existing boolean env convention, follow that
convention instead — **check `env.validation.ts` and `.env.example` first and
match what is already there.** If no convention exists, use this instead, which
is correct for `GOOGLE_SIGNUP_ENABLED=false`:

```ts
GOOGLE_SIGNUP_ENABLED: z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true'),
```

State in your report which one you chose and why.

Add to `identity-service/.env.example` after the `GOOGLE_OAUTH_REDIRECT_ALLOWLIST`
block:

```
# Opt-in. When false, a Google sign-up with an unknown email creates no account
# and is told the account is not registered. Sign-in with Google is unaffected.
GOOGLE_SIGNUP_ENABLED=false
```

### 3. `identity-service/src/auth/guards/google-auth.guard.ts`

`getAuthenticateOptions` currently reads `redirect` and returns `{ state: origin }`.
Change it to also read `intent`:
- Read `request.query.intent`. Accept only the string `'signup'`; everything
  else (missing, `'signin'`, anything else) is `'signin'`.
- Resolve the origin exactly as today (allowlist unchanged; intent must not be
  able to bypass it).
- **Only when an origin resolved**, return `{ state: encodeOAuthState(origin, intent) }`.
  When no origin resolved, return `{}` as today (the flow falls back to
  `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL`, which carries no intent).

### 4. `identity-service/src/auth/application/use-cases/oauth-login/oauth-login.input.ts`

Add `intent: OAuthIntent` (import the type from `../../../oauth/oauth-redirect.js`).
Make it required in the interface; the guard/controller always supplies one.

### 5. `identity-service/src/auth/domain/repositories/auth.repository.ts`

- `CreateOAuthUserRepositoryInput` gains `roleCode?: string`.
- The `IAuthRepository` abstract class is unchanged otherwise.
- Add to the `OAuthLoginUseCase` return contract (that happens in the use case,
  not here) nothing yet.

### 6. `identity-service/src/auth/infrastructure/persistence/prisma/prisma-auth.repository.ts`

`createUserFromOAuth` must, when `data.roleCode` is present, write the
`UserRole` row in the **same** `prisma.user.create` call, and fail if the role
does not exist. Mirror `provisionAccount`
(`prisma-user.repository.ts:148-191`) including its error style: look the role
up by `code` first, throw `InternalServerErrorException` with a message naming
the missing role if not found, then include
`userRoles: { create: { roleId: role.id } }` in the user create data.

When `roleCode` is absent, the call must be **byte-for-byte the same behavior**
as today (identifier, isActive, oauthAccounts create, and the same
`profile`/`userRoles` include).

Keep the returned shape identical either way: a user with
`profile: PROFILE_NAME_SELECT` and `userRoles: USER_ROLES_FOR_AUTHZ_SELECT`.

### 7. `identity-service/src/auth/auth.module.ts`

Only if a new provider is needed. `OAuthLoginUseCase` and `PrismaAuthRepository`
are already wired; no role repository is introduced (the role lookup is inside
`PrismaAuthRepository` using `this.prisma`). Likely no change — confirm the
module still boots by running `pnpm build`.

## Tests

- **Extend `identity-service/src/auth/oauth/oauth-redirect.spec.ts`** (it exists):
  - `encodeOAuthState` / `decodeOAuthState` round-trip for both intents.
  - A bare origin string (e.g. `http://localhost:5175`) decodes to
    `{ origin: 'http://localhost:5175', intent: 'signin' }`.
  - Garbage input does not throw and decodes as a bare origin with `signin`.
  - An unknown intent string inside the JSON decodes as `signin`.
  - `buildCallbackUrl` appends `oauthOutcome` when given.
  - `buildCallbackUrl` with `signup-disabled` targets `/?signup=1` and does not
    set `oauthOutcome`.
  - Existing assertions in this file must keep passing unchanged.
- **Do not add a spec for `createUserFromOAuth`** in this phase — no dedicated
  spec exists for the repository today and Principle V forbids adding one during
  plumbing work. It gets covered by the use-case spec in T041.

## Hard constraints

- NodeNext ESM: every relative import ends in `.js`.
- Zero comments in business code.
- `parseRedirectAllowlist`, `normalizeOrigin`, `resolveRedirectOrigin` untouched.
- Do not change `OAuthLoginUseCase.resolveUser` behavior yet. The use case may
  accept the new `intent` input field but must ignore it for now, so sign-in and
  sign-up behave identically until T044.
- Do not touch the web app.
- No git in this workspace. Do not run git. Do not commit.

## Acceptance

From `D:\Project\241 Apps\identity-service`:
1. `pnpm test` — all pass (270 before this task, plus your new oauth-redirect cases).
2. `pnpm lint`, `pnpm typecheck`, `pnpm lint:strict`, `pnpm build` — all green.

Report: status, files changed, the test summary line, the env-flag variant you
chose and why, and any judgment calls.

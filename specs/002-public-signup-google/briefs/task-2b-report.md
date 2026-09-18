# Task 2b Report — identity-service sign-up intent plumbing (T009–T015)

**Status**: DONE

## Files changed

1. `identity-service/src/auth/oauth/oauth-redirect.ts` — added `OAuthIntent`,
   `OAuthOutcome`, `encodeOAuthState`, `decodeOAuthState`; extended
   `buildCallbackUrl` with optional `outcome`. `parseRedirectAllowlist`,
   `normalizeOrigin`, `resolveRedirectOrigin` untouched.
2. `identity-service/src/auth/oauth/oauth-redirect.spec.ts` — 12 new cases
   (11 new + 1 existing suite left intact). Written first, watched fail.
3. `identity-service/src/auth/guards/google-auth.guard.ts` — reads
   `request.query.intent`, accepts only string `'signup'`, else `'signin'`;
   returns `{ state: encodeOAuthState(origin, intent) }` only when an origin
   resolved, `{}` otherwise.
4. `identity-service/src/auth/application/use-cases/oauth-login/oauth-login.input.ts` —
   added required `intent: OAuthIntent`.
5. `identity-service/src/auth/strategies/google.strategy.ts` — `validate` return
   type changed to `Omit<OAuthLoginInput, 'intent'>` (see judgment call 1).
6. `identity-service/src/auth/domain/repositories/auth.repository.ts` — added
   `roleCode?: string` to `CreateOAuthUserRepositoryInput`.
7. `identity-service/src/auth/infrastructure/persistence/prisma/prisma-auth.repository.ts` —
   `createUserFromOAuth` writes the `userRole` row inside the same
   `prisma.user.create` when `roleCode` is present; absent path unchanged.
8. `identity-service/src/core/config/env.validation.ts` — added
   `GOOGLE_SIGNUP_ENABLED`.
9. `identity-service/.env.example` — documented `GOOGLE_SIGNUP_ENABLED=false`.
10. `identity-service/src/auth/oauth/oauth-redirect.ts` +
    `oauth-redirect.spec.ts` reformatted by Prettier (whitespace only).

No change to `auth.module.ts` (no new provider needed, as predicted). Controller
untouched.

## TDD evidence

**Red** (before production code), `pnpm test src/auth/oauth/oauth-redirect.spec.ts`:

```
Test Suites: 1 failed, 1 total
Tests:       11 failed, 11 passed, 22 total
```

Failures were `TypeError: encodeOAuthState is not a function` /
`decodeOAuthState is not a function`, and `buildCallbackUrl`
returning the old URL without `oauthOutcome` / without `?signup=1`. The 11
pre-existing assertions still passed, confirming no regression was baked in.

**Green** (after implementation), same targeted run:

```
Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

## Verification (from `D:\Project\241 Apps\identity-service`)

1. `pnpm test` — `Test Suites: 45 passed, 45 total` / `Tests: 282 passed, 282 total`
   (270 before + 12 new). Exit 0.
2. `pnpm lint` — clean, exit 0.
3. `pnpm typecheck` — clean (`tsc --noEmit`), exit 0.
4. `pnpm lint:strict` — clean, exit 0.
5. `pnpm build` — `nest build`, exit 0.
6. `pnpm format:check` — clean after `--write` (the two edited oauth files).

## Env-flag variant chosen

Chose the **enum + transform** variant:

```ts
GOOGLE_SIGNUP_ENABLED: z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true'),
```

Why: I checked `env.validation.ts` and the whole service for an existing boolean
convention and found **none** (the only `z.coerce.boolean` occurrences were in
`node_modules`). The brief says to use `z.coerce.boolean().default(false)` only
if the deployment sets the var by presence; otherwise use the enum variant. The
documented value in `.env.example` is the literal string `GOOGLE_SIGNUP_ENABLED=false`,
and this service loads `.env` via `dotenv`, so value-based setting is the actual
deployment shape. `z.coerce.boolean()` would turn `"false"` into `true` — the
exact footgun the brief warns about — so the enum variant is the safe, correct
choice here. It also rejects a typo like `GOOGLE_SIGNUP_ENABLED=yes` loudly at
boot instead of silently enabling sign-up.

## Judgment calls

1. **`google.strategy.ts` return type.** Making `intent` required on
   `OAuthLoginInput` forces every constructor of that type to supply it. The
   strategy builds the profile portion from Google; the intent arrives via
   `state` and is attached by the controller in T045. Making the strategy return
   `OAuthLoginInput` with a hard-coded `'signin'` would be wrong for a sign-up
   round trip. I changed its return type to `Omit<OAuthLoginInput, 'intent'>` so
   the type stays honest: the strategy supplies the base fields, the controller
   merges in the decoded intent. The controller still compiles because it casts
   `req.user as unknown as OAuthLoginInput`, and the use case ignores `intent`
   for now, so behavior is unchanged until T044/T045.

2. **`decodeOAuthState` on valid JSON with no `origin`.** The brief says "no
   origin" is a failure and should be treated as a bare origin. My
   implementation therefore returns `{ origin: <raw state>, intent: 'signin' }`
   in that case (covered by the "decodes valid JSON without an origin as a bare
   origin" test). This is a slight oddity — the raw value is base64 looking, not
   an origin — but it is what the brief specifies, it cannot throw, and the
   downstream allowlist check (`resolveRedirectOrigin`) will reject anything that
   is not a real allow-listed origin, so it is safe.

3. **Bare-origin detection is parse-first, not regex-first.** I did not special
   case "looks like a URL"; the code tries base64url + JSON and falls back on any
   failure. A bare `http://localhost:5175` fails `JSON.parse` and lands on the
   bare-origin path, verified by the passing round-trip/legacy tests.

4. **Duplicated user-create body.** In `createUserFromOAuth` the roleless and
   role-bearing branches share the same `data`/`include` shape. I kept two
   `prisma.user.create` calls rather than building a conditional `data` object,
   because the brief demands the roleless path be byte-for-byte today's behavior
   and the explicit form makes that trivially auditable. It stays well under the
   200-line repository budget.

5. **No repository spec added**, per the brief (Principle V); the lookup and the
   in-create `userRoles` write will be covered by the T041 use-case spec.

6. **Prettier.** `format:check` (part of `pnpm validate`) flagged my two edited
   oauth files for line wrapping; I ran Prettier on just those files. No logic
   changed in the reformat.

# OAuth Return Target Contract

**Feature**: `001-admin-assisted-registration-oauth`

Owned by `identity-service`. Seven web apps consume it. The response is a `302`
redirect; there is no JSON envelope on these two routes.

## GET `/auth/google`

Starts the round trip. Public, throttled with the `auth` bucket.

- Query: `redirect?` — an **origin** (scheme + host + optional port), no path,
  no query, no fragment. Example: `http://localhost:5175`.
- Behaviour:
  1. Read `redirect`.
  2. Parse it as a URL and reduce it to its origin.
  3. If `redirect` is present **and** its origin is in
     `GOOGLE_OAUTH_REDIRECT_ALLOWLIST`, use it.
  4. Otherwise use the origin of `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL`.
  5. Pass the chosen origin as the OAuth `state` (via
     `AuthGuard.getAuthenticateOptions`).
- Redirects to Google with `scope=email profile` (unchanged strategy config).

Unlisted, malformed or absent `redirect` never fails the request: it falls back.
A start call is not a place to return a 400 to a parent.

## GET `/auth/google/callback`

Completes the round trip. Public, throttled with the `auth` bucket.

- Reads the target origin from `req.query.state` (already validated at start;
  re-validated against the allowlist defensively before use).
- Runs `OAuthLoginUseCase` (unchanged): matches an existing account by email and
  links the provider, or creates a roleless user.
- Sets the existing HttpOnly `refresh_token` cookie (`path: /auth`,
  `sameSite: strict`, `secure` in production) — unchanged.
- Redirects to `<targetOrigin>/oauth/callback?profileIncomplete=true|false`.

| Case | Result |
| --- | --- |
| Known email, matched or already linked | 302 to `<origin>/oauth/callback?profileIncomplete=false` (or `true` when the profile row is absent) |
| Unknown email | 302 with `profileIncomplete`, but **no role** on the created user; the front end shows the not-registered state |
| `state` missing or its origin unlisted | 302 to `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL` |
| Identity service cannot resolve the account | 401 from the guard/use case; no redirect, no account |

## `GOOGLE_OAUTH_REDIRECT_ALLOWLIST`

- Comma-separated list of origins. Same validation idiom as `FRONTEND_URL`
  (`env.validation.ts:59-82`): every entry must parse as a URL; empty entries are
  ignored; an empty list is invalid.
- Default: `http://localhost:5173,http://localhost:5175` during development, so
  both the historical default and admission-web's port are reachable.
- Production: origins must not contain a wildcard (mirror `FRONTEND_URL`'s
  production refinement).

## Consumer rule (all seven sibling web apps)

1. A "Masuk dengan Google" control navigates the browser (full-page, not XHR) to
   `<identity origin>/auth/google?redirect=<encodeURIComponent(window.location.origin)>`.
2. A `/oauth/callback` route calls `authService.restoreSession()` — the existing
   `POST /auth/refresh` with credentials — then:
   - success with an `APPLICANT` role → `/registration`
   - success with an admin role → `/admin`
   - success with no role → a "this account is not registered" message plus a
     link to `/register`
   - `profileIncomplete=true` is read for copy only; it never blocks the screens
3. The identity service being unreachable must surface as a **service outage**
   message, not as bad credentials (reuse `notifyIfOutage` /
   `getIndonesianErrorMessage`; the shared api client already maps 503s).

This contract is append-only. Removing `state` support or narrowing the
allowlist is a coordinated change with every consumer.

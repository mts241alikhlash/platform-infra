# Contract: Google sign-up intent through OAuth

**Feature**: `002-public-signup-google` | **Owner**: identity-service

Extends the OAuth flow from feature `001`. Everything below is additive; a
caller that sends no intent gets today's behavior.

---

## Start: `GET /auth/google`

| Parameter | Required | Values | Meaning |
| --- | --- | --- | --- |
| `redirect` | no | an origin on `GOOGLE_OAUTH_REDIRECT_ALLOWLIST` | where to return |
| `intent` | no | `signin` (default) \| `signup` | which flow to run |

The guard encodes both into the Google `state` parameter. The `state` value is
URL-safe base64 of `{"origin":"<origin>","intent":"<intent>"}`. A bare origin
(no JSON) decodes as `{"origin":"<origin>","intent":"signin"}`, so every existing
link keeps working.

`intent` is ignored when `redirect` is absent or not allow-listed; the flow then
uses `GOOGLE_OAUTH_SUCCESS_REDIRECT_URL` and `signin`.

---

## Callback: `GET /auth/google/callback`

Google returns `code` and `state`. The controller decodes `state`, runs
`OAuthLoginUseCase` with the intent, sets the refresh cookie as it does today,
then redirects to the resolved origin with these query parameters:

| Parameter | Values | Notes |
| --- | --- | --- |
| `profileIncomplete` | `true` \| `false` | existing from feature `001` |
| `oauthOutcome` | `signup-created` \| `signup-existing` \| `signup-disabled` | **new**; omitted for `signin` |

Redirect target: `<origin>/oauth/callback` as today, except `signup-disabled`,
which redirects to `<origin>/?signup=1` so the landing page can explain that
registration is closed rather than the callback page.

For `signup-disabled` the refresh cookie is **not** set — no session is created.

---

## `OAuthLoginUseCase.execute(input, userAgent, ipAddress)`

`OAuthLoginInput` (strategy output, unchanged) plus a new `intent` field.

| Intent | `findOAuthAccount` hit | `findUserByEmail` hit | email unknown |
| --- | --- | --- | --- |
| `signin` | sign in (unchanged) | link, sign in (unchanged) | create roleless user (unchanged) |
| `signup` | sign in, outcome `signup-existing` | link, sign in, outcome `signup-existing` | flag on: create with `APPLICANT`, outcome `signup-created`; flag off: `signup-disabled` |

Return shape gains `oauthOutcome?: 'signup-created' | 'signup-existing' | 'signup-disabled'`.
Existing fields (`accessToken`, `refreshToken`, `refreshExpiresInMs`,
`profileIncomplete`, `user`) are unchanged.

### Role assignment

`CreateOAuthUserRepositoryInput` gains `roleCode?: string`. When present,
`createUserFromOAuth` writes the `userRole` row inside the same
`prisma.user.create`, resolved by `role.code`. When the role code is unknown the
create fails as it does for `provisionAccount` (500), which is the same
expectation that path already has.

---

## Deployment flag

| Variable | Type | Default | Effect |
| --- | --- | --- | --- |
| `GOOGLE_SIGNUP_ENABLED` | boolean (`z.coerce.boolean()`) | `false` | when false, an unknown Google email under `signup` creates no account |

Documented in `.env.example` next to the existing `GOOGLE_*` entries.

---

## Unchanged guarantees

- `GOOGLE_OAUTH_REDIRECT_ALLOWLIST` validation is unchanged; `intent` does not
  bypass it. The origin is still the only thing that can redirect the browser.
- Feature `001` sign-in (linked account, or matched by email) behaves exactly as
  before for both intents.
- `POST /auth/introspect`, `/auth/refresh`, `/auth/me` are untouched.

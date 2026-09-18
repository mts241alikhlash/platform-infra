# Quickstart walk, T051

Run on 2026-09-15 against the live dev stack: identity-service :3000,
admission-service :3700, academic-service :3200, admission-web :5175, Postgres
:5433 with seeded data and one active wave (`G1-2027`, Gelombang 1, 2027/2028).
Driven through Playwright against the real browser, real HTTP, real database.

## Scenario results

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| S1 | Password sign-up from the landing dialog | PASS | Dialog opened from the hero button, URL unchanged. Four fields only, no phone, no wave, no wave list fetched. Submit produced `POST /admissions/register` -> 201 with body `{"fullName","email","password","passwordConfirm"}` and **no `waveId`**. Dialog closed, browser landed on `/registration/form`, form's locked field showed `Gelombang 1` and `2027/2028`. DB: `G1-2027-0002`, status `DRAFT`, `wave_id` = the active wave, account has role `APPLICANT`. |
| S2 | No active wave | PASS | Deactivated the only wave, submitted a fresh email. Dialog showed `Pendaftaran sedang tidak dibuka.`. DB: no user row for that email, application count unchanged at 2. Submit stayed enabled. Wave restored afterwards. |
| S3 | Duplicate email by password | PASS | Resubmitted an existing email. `409` attached to the email field (`Email ini sudah terdaftar. Silakan masuk.` with `aria-invalid`), dialog stayed open, no second account. |
| S4 | Google sign-up, new email, enabled | PARTIAL | Not fully runnable: `GOOGLE_CLIENT_ID` is the placeholder `change-me-in-production`, so Google consent cannot be completed. Verified as far as the environment allows: `GET /auth/google?intent=signup` returns 302 to Google with `state` decoding to `{"origin":"http://localhost:5175","intent":"signup"}`. The account-creation branch itself is covered by `oauth-login.use-case.spec.ts` (flag on + unknown email creates with `APPLICANT`, outcome `signup-created`). |
| S5 | Google sign-up, existing email | PARTIAL | Same consent limitation. The matched-account branch is covered by the use-case spec (`signup-existing`, no create). |
| S6 | Google sign-up, disabled | PASS (UI half) | Opening `/oauth/callback?oauthOutcome=signup-disabled` renders `Pendaftaran dengan Google belum dibuka` with the not-open message and a `Kembali ke Beranda` action, and no session restore is attempted. The server half (no cookie, no account, redirect to `/?signup=1`) is covered by the controller spec. |
| S7 | Google start URL carries the intent | PASS | `GET /auth/google?redirect=...&intent=signup` -> `state` decodes to `{"origin":"http://localhost:5175","intent":"signup"}`; without `intent` it decodes to `"signin"`. |
| S8 | Feature-001 sign-in unchanged | PASS | Signed in with an existing password account through `POST /auth/login` (200) and called the ensure endpoint successfully. `googleStartUrl` with one argument still produces the sign-in `state`. |
| S9 | Idempotent ensure | PASS | `POST /admissions/my-application/ensure` twice for the same user returned the same `registrationNumber` (`G1-2027-0002`) both times; application count stayed at 2. Both responses carried `wave.name` and `wave.academicYear.name`. |
| S10 | `/register` is not a dead route | PASS | Browsing `/register` redirected to `/` and opened the dialog, with no separate form rendered. |

## Accessibility and layout (FR-017, FR-018, R-35)

| Check | Result | Evidence |
| --- | --- | --- |
| No horizontal overflow at 320px | PASS | `documentElement.scrollWidth === clientWidth === 320`; dialog rect 0..314. |
| Tap targets at least 44px | PASS after fix | Every `input` and `button` in the dialog measures 44px or more. The dialog's Close control measured 20x20 before this walk; `DialogScrollContent.vue` was changed to `size-11` and re-measured at 44x44. The remaining inline `Masuk di sini` link is 18px tall, which WCAG 2.5.8 exempts for inline text links. |
| Escape dismisses | PASS | Dialog closed on Escape. |
| Focus trap | PASS | Tab kept focus inside the dialog. |
| Focus returns to the opener | PASS | After Escape, focus was back on the header `Daftar Sekarang` button with `:focus-visible` true. |
| Visible focus indicator | PASS | Focused controls report a visible outline; no `outline: none` without replacement. |

## Console

The only console errors on the landing page are pre-existing and unrelated:
`/auth/refresh` 401 for a guest, `/settings/ADMISSION` 404, and `/profiles/me`
404. None come from this feature's code paths; the sign-up request itself logged
no error.

## Not verified

- Real Google consent round trip (S4, S5): needs real `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET`.
- The `signup-created` / `signup-existing` callback transition in a browser: needs
  the same consent round trip. Its unit coverage and the server-side branch are
  tested.
- Email delivery, because none is part of this feature.

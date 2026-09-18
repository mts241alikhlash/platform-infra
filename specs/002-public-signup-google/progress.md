# SDD Ledger - plan: specs/002-public-signup-google/tasks.md

Mode: no-git (human ruling 2026-09-14: "Tanpa git, langsung kerjakan").
Verification is by test runs and file reads, not commit ranges.

## Baseline (T001)

- identity-service: Prisma client generated; `pnpm test` 45 suites / 270 passed.
  Known flake: `src/shared/domain/no-user-scalar-overfetch.spec.ts` failed once in a
  full `pnpm validate` run, passed standalone and on full-suite re-run. Not caused by
  this feature.
- admission-service: Prisma client generated; `pnpm validate` 24 suites / 163 passed, build ok.
- admission-web: `pnpm validate` 10 files / 74 passed, build ok.

## Rulings

- Ruling: proceed without git - no ledger commits, no diff-based review packages; each
  task's verification is its test command plus a file read of the change. Cost if wrong:
  a bad change cannot be reverted by commit; it must be undone by hand.
- Ruling: T002 (create feature branch per repo) is N/A under no-git. Cost if wrong: none,
  branch creation was only for isolation.

## Progress

- Task 1 (T001-T003 baseline): complete (baseline green; no-git ruling recorded)
- Task 2a (T004-T008 repo split): complete
  - repository 154, reader 155, writer 83, draft 57 lines. All under budget.
  - admission-service 24 suites / 163 tests pass; typecheck + lint:strict green.
  - Judgment (subagent): `createDraftApplication` is an exported free function,
    not a Nest provider (matches the brief's own signature). Accepted.
- Task 2b (T009-T015 identity plumbing): complete
  - oauth-redirect.spec.ts grew by 12 cases. identity-service 45 suites / 282 tests.
  - Env flag: `z.enum(['true','false']).default('false').transform(v => v === 'true')`
    - correct for `GOOGLE_SIGNUP_ENABLED=false`; `z.coerce.boolean()` would read it
    as true. Accepted.
  - Judgment (subagent): `GoogleStrategy.validate` returns
    `Omit<OAuthLoginInput, 'intent'>`; the controller casts `req.user`, so intent is
    added at the callback. Accepted.
  - Judgment (subagent): `createUserFromOAuth` keeps two explicit branches so the
    roleless path is unchanged. Accepted.
  - `OAuthLoginUseCase.resolveUser` still ignores `intent` - correct; the branch is T044.
- Task 3 (T016-T028 US3): dispatched
  - Ruling: `ensure` takes no body; the DRAFT is seeded with an empty `fullName`
    and `email`. `fullName` is resolved from the account display name in the web
    layer (T025), email is filled by the form's first step. An existing account
    with no application reached by plain sign-in (FR-013) has no dialog data, so a
    body would be a false contract. Cost if wrong: placeholder name visible until
    the applicant types it in the form.
  - Ruling: T024 says `findMyDetail` only, but the form re-hydrates from the
    PATCH/POST responses, so the academic-year name is attached on all four detail
    returns (reader findMyDetail/findDetailById, writer updateMyApplication/
    submitApplication). Cost if wrong: none; additive field.
- Task 3 (T016-T028 US3): complete
  - admission-service 25 suites / 170 tests; admission-web 11 files / 76 tests.
  - Ruling: the subagent fixed a pre-existing bug in `ApplicationFormView.vue`
    where the local `application` ref was never assigned, so the form branch (and
    the new locked field) could never render. Assigning it in onMounted/refresh/
    saveStep is the smallest change that makes the task's requirement reachable.
    Cost if wrong: the form now renders where it previously silently showed the
    empty state; that is the intended behavior of the feature either way.
  - antislop check on the locked field: existing tokens only (border, bg-muted,
    text-muted-foreground), plain text not focusable, `break-words` for narrow
    widths, no em dash in the file. Passes R-02, R-25, R-03.
  - Judgment (subagent): ensure endpoint typed with the existing
    `ApplicationDetailResponseDto` rather than raising the untyped-api ceiling.
    Accepted.
- Task 4 (T029-T040 US1): dispatched
  - Ruling: the sign-up dialog signs the new applicant in via the existing
    `authService.loginUser` after a successful `POST /admissions/register`. The
    register response carries no session and `applicant-form` is `requiresAuth`,
    so FR-006 ("land in the application form") is otherwise unreachable. Cost if
    wrong: none; it is the only path that satisfies FR-006.
  - Ruling: split the register payload by use. Public dialog payload has no
    `waveId`; the admin on-behalf flow keeps a required `waveId`. No widening
    with optional fields, no `any`.
- Task 4 (T029-T040 US1): complete
  - admission-web 12 files / 82 tests, `pnpm validate` green.
  - `/register` is a redirect to `{ name: 'landing', query: { signup: '1' } }`;
    `RegisterView.vue` deleted; all eight landing entry points call `open()`.
  - Ruling 1 implemented: dialog calls `authService.loginUser` after register,
    then routes to the form.
  - Minor (deferred): with `/register` now a redirect, the `guestOnly` meta on that
    record no longer fires, because the router guard reads `to.meta` from the
    resolved target. A signed-in user visiting `/register` lands on the landing
    page instead of being sent home. Not load-bearing for the feature (the landing
    dialog is the intended surface); note for the final review.
  - Google button still calls the one-arg `googleStartUrl`; T046 flips it.
- Task 5 (T041-T050 US2): dispatched
  - Ruling: the callback decodes `state` first and passes only the decoded origin
    to `resolveRedirectOrigin`, which is what the allowlist validates. The raw
    encoded state can never be an allowlist member. Cost if wrong: none.
- Task 5 (T041-T050 US2): complete
  - identity-service 46 suites / 291 tests; admission-web 14 files / 90 tests.
  - T042 confirmed a no-op: the state round-trip and both `buildCallbackUrl`
    outcome cases already landed in Phase 2b.
  - B3 approach: `authConfig`/`configureAuth` gained `ensureApplicantApplication`
    (default `() => Promise.resolve(null)`); `src/app/main.ts` registers
    `publicAdmissionService.ensureMyApplication`. Platform still imports no
    feature, so the dependency direction holds.
  - `signup-disabled` returns `{ oauthOutcome, profileIncomplete: false }` with no
    session; the controller returns before `setRefreshTokenCookie`. Verified.
  - No em dash in the dialog or callback view. Verified by char scan.
- Task 6 (T051-T057 Polish): in progress
  - T051 quickstart walk done: `quickstart-results.md`. S1, S2, S3, S6-UI, S7,
    S8, S9, S10 PASS against the live stack. S4/S5 PARTIAL only because the dev
    `GOOGLE_CLIENT_ID` is a placeholder, so the real Google consent cannot be
    completed; the account-creation branches are covered by unit tests.
  - R-35 finding, fixed: the dialog's Close control measured 20x20 px, under the
    44px tap target. `packages/ui/src/components/ui/dialog/DialogScrollContent.vue`
    changed to `size-11` with a visible focus ring. Re-measured at 44x44; web
    suite 14 files / 90 tests still green.
  - R-35 PASS items: no overflow at 320px, all controls >= 44px, Escape closes,
    focus trapped, focus returns to opener with a visible ring, no em dash.
  - T052/T053 done. identity-service `docs/OVERVIEW.md` gained the `state`
    `{origin,intent}` shape, the `GOOGLE_SIGNUP_ENABLED` table (including why it is
    `z.enum` and not `z.coerce.boolean`), and the `oauthOutcome` values.
    admission-service `docs/OVERVIEW.md` gained server-side wave resolution, the
    public/admin DTO split, and `ensure`. admission-web `docs/OVERVIEW.md` gained
    the dialog-replaces-page section, the locked wave field, and the ensure call;
    its stale claim that open sign-up "is not this app's to make" was corrected,
    and its `/register` empty-state sentence was updated to the dialog target.
    Every documented claim was read back against the code before writing.
  - T054 done: `pnpm lint:strict` runs inside `pnpm validate`, green in all three
    repos. No comment added to business code; no suppression added.
  - T055 done: recorded in `research.md` R5 with the verified dead-code detail
    (`admission-wave-repository.ts:49` + `prisma-admission-wave.repository.ts:103`,
    no caller in `src/` or `test/`). Deferred by design, not forgotten.
  - T056 done: applicant persistence files measured at repository 165, reader 175,
    writer 130, draft 57 lines, all under the Principle V 200-line cap, so the
    split held. admission-service spec files: 25 (24 at baseline + the new
    `ensure-my-application.use-case.spec.ts`); no spec was added or deleted by the
    refactor itself, which is what T008 required.
  - T057 done. Final `pnpm validate`: identity-service 46 suites / 291 tests;
    admission-service 25 suites / 170 tests; admission-web 14 files / 90 tests.
    All three green, including format, lint, typecheck, lint:strict and build.

## Follow-up found after T057: no sign-up route from `/login`

Found by the human asking why the page after logout had no sign-up button.
Root cause: `AppLayout.vue:166` sends the user to `/login`, and `LoginForm.vue`
rendered only "Masuk" and "Masuk dengan Google". Feature 002 removed the
standalone `/register` page without giving the login page a way in, so
`/register` stayed a live redirect that nothing pointed at. Not a regression
introduced by the dialog itself, but a gap the feature opened.

- T058-T061 done. `authConfig` gained `signUpUrl` (default `null`) and
  `signUpLabel` (default `Belum punya akun?`). `LoginForm.vue` renders the
  `Belum punya akun? Daftar` line only when `signUpUrl` is set.
  `admission-web/src/app/main.ts` sets `signUpUrl: '/register'`.
- The default is `null` deliberately: `LoginForm.vue` is mirrored into six
  sibling apps, verified to have no `signUpUrl` in their `config.ts`, so a
  hard-coded link would have handed them a route that does not exist. None of
  the six was edited.
- `LoginForm.spec.ts` created (3 cases). admission-web now 15 files / 93 tests.
- Runtime verified against the dev server: the link renders on `/login`, its
  `href` is `/register`, clicking it lands on `/` and opens `SignUpDialog`, and
  clearing cookies plus storage proved the link shows for a genuine guest rather
  than a stale session.
- Unrelated pre-existing defect observed while checking 320px width: `/login`
  reports 1px of horizontal overflow (`scrollWidth` 315 vs `clientWidth` 314).
  Hiding the new paragraph leaves `scrollWidth` at 315, so the new line does not
  cause it; the widest contributing element is `LoginView.vue`'s own shell
  (`flex flex-col gap-4 bg-muted/50 p-6 md:p-10`). Left alone; outside this
  feature.

## Known gaps, stated plainly

- Google sign-up was never exercised through real Google consent (S4/S5). The dev
  `GOOGLE_CLIENT_ID` is a placeholder. What is proven: the start URL carries the
  intent in `state`, the account-creation and refusal branches are unit-tested, and
  the `signup-disabled` UI state renders. What is not: the live round trip.
- The `/register` `guestOnly` note from Task 4 still stands: a signed-in user
  visiting `/register` reaches the landing page rather than being redirected home.
  Harmless for this feature, since the dialog is the intended surface.
- No git means no revert. Any change here is undone by hand, and there is no
  commit range to review. Recorded up front as the no-git ruling.

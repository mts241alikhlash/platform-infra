# Progress: UI Audit Remediation

**Feature**: `003-ui-audit-remediation`
**Created**: 2026-09-15
**Status**: Implementation complete. All seven apps pass `pnpm validate`;
S4 (live Google consent) is open by necessity.

## Outcome

| Item | Result |
| --- | --- |
| Em dashes in the seven apps | **0** (was 167: 104 code, 63 outside the first scan) |
| `pnpm validate` | 7/7 green, test counts at or above baseline |
| Control edge contrast | 1.24:1 -> **3.37:1** vs card, 3.23:1 vs background |
| CTA body text contrast | 3.87/4.15 -> **5.09:1** |
| Decoration removed | 5 orbs, 1 glass capsule, 5 arrows, their imports |
| `/login` at 320px | no overflow at 320/360/375/414/768 |
| `DESIGN.md` | written, provenance stated, palette measured |
| Click-through | recorded in `quickstart-results.md`, element by element |
| S4 live Google round trip | **OPEN**, `GOOGLE_CLIENT_ID` is a placeholder |

## What this feature is

Remediation of the eight findings in `anti-slop/audit-002-2026-09-15.md`, plus a
repo-wide em dash sweep that the audit undercounted.

## Decisions of record, 2026-09-15

| Decision | Choice | Rationale |
| --- | --- | --- |
| Scope of findings | all eight | owner |
| Spec location | new feature `003`, not appended to `002` | the work is mostly pre-existing code, so it is not feature 002's to own |
| Em dash scope | all 104 occurrences in 7 apps, including 10 test and 7 comment | owner; the audit named only 5 |
| Dash replacement | en dash for ranges, comma/period/colon/parentheses for prose, hyphen for empty values | matches the three files that already use an en dash for a range |
| Control-edge token | `oklch(0.64 0.006 264.531)` in all seven apps | 3.37:1 vs card, 3.23:1 vs background; `oklch(0.65 ...)` passes but clears the background bar by only 0.10 |
| `--border` | unchanged | it is applied globally and would restyle every non-control surface |
| Decoration | remove the four orbs and the glass capsule | owner chose removal over writing a justification |
| CTA arrows | remove all five | no written purpose exists, and the labels already name the action |
| `DESIGN.md` | agent-authored at the owner's request, and states its own provenance | the owner's first choice was to supply it; they changed to agent-authored on 2026-09-15 |

## Artifacts

| File | State |
| --- | --- |
| `spec.md` | written, 22 functional requirements, 4 user stories |
| `plan.md` | written, Constitution Check passes with 2 action items |
| `research.md` | written, R1 to R10 with measured values |
| `data-model.md` | written, four artifacts, no persistent model |
| `contracts/control-edge-token.md` | written |
| `contracts/em-dash-replacement.md` | written, four replacement classes |
| `contracts/design-direction.md` | written, file authored and provenance stated |
| `quickstart.md` | written, S1 to S12 |
| `checklists/requirements.md` | written, all items pass |
| `tasks.md` | written, T001 to T054 across 7 phases, all complete |
| `baseline.md` | written, Phase 1 evidence: test counts, em dash inventory, token values |
| `quickstart-results.md` | written, S1 to S12 with S4 open |
| `anti-slop/audit-002-2026-09-15-followup.md` | written, one entry per finding |

## Corrections made during implementation

The planning corrections above stand. Two more were forced by doing the work:

1. **The 104 was itself an undercount.** The Phase 1 inventory script scanned
   only `src`, `packages\ui\src`, `packages\platform\src`, and
   `packages\shared\src`. A full-tree scan found **63 further occurrences** in
   `packages\reference-data\src`, `smoke\`, `CLAUDE.md`, `package.json`, and
   `docs\` in every app. The owner approved correcting all of them on
   2026-09-15, so the true figure is **167**. This is the same class of error as
   the audit's original "five", made one level up.
2. **T050 assumed a token was documented in seven apps.** It is documented in
   one: only `admission-web/docs/OVERVIEW.md` describes the design token, and the
   other six never mention `style.css`, `--input`, or contrast at all. The token
   change was recorded where the documentation actually exists rather than
   inventing six new sections.

## Accepted appearance changes, documented rather than discovered

- **The unchecked switch fill.** `--input` colors five control borders and, via
  `data-[state=unchecked]:bg-input`, the fill of an off `Switch`. Darkening the
  token makes that fill visibly darker. It is accepted: the switch still reads as
  off, and the alternative (a separate `--control-border` token) would leave
  `--input` serving four of its five consumers and add a token for one case. See
  `contracts/control-edge-token.md`.
- **Card hover lift.** Removing the per-card orb also removed the only
  `group-hover` consumer in `LandingWaveSection.vue`, so the now-dead `group`
  class was removed with it. The card's own `hover:-translate-y-1` lift stays.

## Facts established by measurement, not assumption

- **The em dash count in code was 104, not 5.** 87 user-visible, 10 test, 7
  comment, across 65 distinct files in 7 apps. `hr-web` 39, `academic-web` 23,
  `portal-web` 12, `inventory-web` 10, `admission-web` 8, `assessment-web` 7,
  `admin-web` 5. A full-tree scan later added 63 outside `src`/`packages`, for a
  true total of 167; all are removed.
- **Four files exist in more than one app** and must move together:
  `ServiceUnavailable.vue` (7), `useReferenceList.ts` (7), `school-identity.ts`
  (7, comment), `DashboardView.vue` (3).
- **`--input` colors two things**: five control boundaries and the unchecked
  switch fill. Darkening it changes the switch visibly, which is accepted and
  recorded rather than discovered later.
- **No app ships a dark theme.** One theme per `src/style.css`, no `.dark` block,
  `themeToggleRefs=0` across all seven. R-21 and R-34 are out of scope.
- **An i18n layer exists and does not cover the edited strings.** `admission-web`
  installs `vue-i18n` 11 and wires it in `src/app/main.ts:12,32`, with locale
  files at `src/i18n/locales/{en,id}.ts`; the catalogue holds only `menu.*` keys,
  so every edited string is a hardcoded literal.
- **The first candidate token value would have passed on paper only.**
  `oklch(0.65 ...)` scores 3.24:1 vs card but 3.10:1 vs background, which rounding
  can move below the bar.

## Corrections made while planning

Three claims were wrong as first written and were fixed rather than left standing:

1. `plan.md` said the em dash work spans 85 files, 74 user-visible. Measured: 65
   files, 59 user-visible.
2. `research.md` R10 said no i18n layer exists. It does; the R10 text was
   corrected to describe what the catalogue actually holds.
3. The automatic classifier misfiled six occurrences (`WeeklyHolidaysSection.vue:59`,
   `EnrollmentHistoryTab.vue:169`, and `WorkPatternFormDialog.vue:166` are empty
   values, not prose; `AttendancePeriodView.vue:119` and
   `NonWorkingDayListView.vue:211` are two-value labels). `tasks.md` warns about
   each so the pattern is not trusted over the line.

## Open items

- **S4**: the live Google consent round trip cannot run, because
  `GOOGLE_CLIENT_ID` is the placeholder `change-me-in-production`. Recorded as
  OPEN in `quickstart-results.md`, not claimed as passing.
- **No automated em dash guard exists.** A lint rule would prevent occurrence
  168. Recorded as a follow-up for the owner in `DESIGN.md` and in the follow-up
  report, not implemented here.
- **No dark theme in any app.** R-21 and R-34 are unaddressed by design;
  `spec.md` states it as a non-goal rather than leaving it silent.
- **Em dashes outside the seven apps.** A full-tree scan found 3,448 more in the
  backend services, skill folders, and the `specs/001`/`specs/002` documents.
  None is in scope for this feature and none is user-visible UI, but the figure
  is recorded so nobody reads "zero" as workspace-wide.

## Checked against upstream, 2026-09-15 (after the feature closed)

The owner asked whether the theme scaffold follows best practice, so the
shadcn-vue theming docs and the Tailwind v4 theme docs were consulted (Context7:
`/websites/shadcn-vue`, `/websites/tailwindcss`). Result: the scaffold already
matches upstream where it matters, and two divergences were found.

- **Already correct, left alone.** `@theme inline` referencing `var(--token)` is
  the documented Tailwind v4 pattern for indirect tokens. `@custom-variant dark`
  being present without a `.dark` block is the shipped scaffold, not leftover
  code.
- **Radius scale was incomplete, fixed.** The scaffold defines `--radius-sm`
  through `--radius-4xl` as multiples of `--radius` (`* 0.6` to `* 2.6`). The
  apps carried the older additive form (`- 4px`, `- 2px`, `+ 4px`) that stops at
  `xl`, so `rounded-2xl` and `rounded-3xl` fell through to Tailwind's defaults.
  Measured in the browser before the fix: `2xl` 16px, `3xl` 24px. After adopting
  the scaffold scale: `2xl` 18px, `3xl` 22px, with `sm/md/lg/xl` unchanged at
  6/8/10/14px because both forms agree at `--radius: 0.625rem`. `rounded-4xl` is
  defined but resolves to 0px only because no file uses it, so Tailwind emits no
  utility; it is not a defect. This touched 153 call sites across the seven apps
  (151 `rounded-2xl`, 2 `rounded-3xl`), all by edit, not by script.
- **`--input` divergence is deliberate, now documented.** Upstream ships
  `--input` equal to `--border` (`oklch(0.922 0 0)`), roughly 1.3:1 against
  white, which is below the WCAG 3:1 non-text bar. Keeping the darker value is a
  correction of upstream, not drift, and `DESIGN.md` now says so to stop a future
  tidy-up from reverting it.

Both changes were verified by re-reading the emitted CSS (`.rounded-2xl {
border-radius: calc(var(--radius) * 1.8) }`) and by `pnpm validate` in all seven
apps, with test counts unchanged from baseline.

## Closed during Phase 7

- **FR-022 / T046**: the pre-existing `/login` overflow at 320px is **fixed**.
  `scrollWidth === clientWidth` at 320, 360, 375, 414, and 768px, with no element
  crossing the right edge. The specific cause was not isolated: the page measures
  clean now and no single line was identified as the culprit, so this is recorded
  as "no longer reproduces" rather than as a diagnosed fix.

## Next step

None. The feature is implemented and verified. Any further work is one of the
open items above, each of which is a product or tooling decision rather than a
remediation of an audit finding.

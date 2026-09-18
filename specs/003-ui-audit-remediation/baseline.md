# Phase 1 Baseline: UI Audit Remediation

Captured 2026-09-15, before any edit, on:

- pnpm 11.25.0
- Node v24.20.0
- Windows (win32)

## T001: `pnpm validate` baseline

All seven apps were already green before this feature. Every stage of
`format:check + lint + typecheck + lint:strict + test + build` passed in each.

| App | Test files | Tests | Status |
| --- | --- | --- | --- |
| `academic-web` | 34 | 234 | PASS |
| `admin-web` | 9 | 80 | PASS |
| `admission-web` | 15 | 93 | PASS |
| `assessment-web` | 14 | 97 | PASS |
| `hr-web` | 27 | 184 | PASS |
| `inventory-web` | 12 | 130 | PASS |
| `portal-web` | 14 | 101 | PASS |

SC-006 requires each app at or above its own numbers above, after the changes.

`admission-web` matches the figure recorded after feature 002 (15 files / 93
tests), which confirms the two features are measuring the same thing.

## T002: em dash inventory

`%TEMP%\opencode\classify_em2.ps1` was re-run. Result: **104 occurrences in 65
distinct relative paths**, matching `data-model.md` Entity 2 exactly.

| Class | Count |
| --- | --- |
| `PROSE` | 57 |
| `EMPTY_VALUE` | 13 |
| `NOTE_PREFIX` | 9 |
| `DATE_RANGE` | 8 |
| `TEST` | 10 |
| `COMMENT` | 7 |

User-visible: 87 in 59 files. Non-user-visible: 17 (10 test, 7 comment).

| App | Occurrences | Files |
| --- | --- | --- |
| `hr-web` | 39 | 30 |
| `academic-web` | 23 | 20 |
| `portal-web` | 12 | 9 |
| `inventory-web` | 10 | 7 |
| `admission-web` | 8 | 8 |
| `assessment-web` | 7 | 7 |
| `admin-web` | 5 | 4 |

Machine-readable list: `%TEMP%\opencode\em_rows.json`.

The classifier is a triage aid, not ground truth. It misfiled six occurrences,
each flagged in `tasks.md`: `WeeklyHolidaysSection.vue:59`,
`EnrollmentHistoryTab.vue:169`, and `WorkPatternFormDialog.vue:166` are
`EMPTY_VALUE` not `PROSE`; `AttendancePeriodView.vue:119` and
`NonWorkingDayListView.vue:211` build a two-value label.

## T003: pre-change token values

Read from the `:root` block of `<app>/src/style.css` in all seven apps.

| Token | Value (all seven apps) |
| --- | --- |
| `--input` | `oklch(0.928 0.006 264.531)` |
| `--border` | `oklch(0.928 0.006 264.531)` |
| `--primary` | `oklch(0.54 0.14 255)` |

All seven apps declare the same values. `--input` and `--border` are identical
before the change, which is the finding: a control boundary and a divider are
indistinguishable, and at 1.24:1 against `card` neither is visible.

Phase 4 changes `--input` to `oklch(0.64 0.006 264.531)` and must leave
`--border` at `oklch(0.928 0.006 264.531)`.

## Checkpoint

Phase 1 is complete. Phase 2 is empty by design, so all four user stories are
unblocked.

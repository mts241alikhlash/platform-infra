---
description: "Task list for UI Audit Remediation"
---

# Tasks: UI Audit Remediation

**Input**: Design documents from `/specs/003-ui-audit-remediation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No `*.spec.ts` is required. Principle V requires a spec for a new *use
case*, and this feature ships none. Existing suites must stay green and stay at or
above their baseline count (SC-006), so the test work here is regression
verification, not authoring.

**Organization**: Tasks are grouped by user story. The em dash story (US3) is the
largest and is grouped by app, because the file that exists in several apps must be
corrected in all of them in the same session (constitution, Development Workflow).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3, US4
- Every task names exact file paths

## Path Conventions

Seven sibling app roots: `academic-web/`, `admin-web/`, `admission-web/`,
`assessment-web/`, `hr-web/`, `inventory-web/`, `portal-web/`. Paths below are
relative to the named app root. `packages/ui`, `packages/platform`,
`packages/shared` are copies inside each app, not shared packages.

**Occurrence classes** (from `contracts/em-dash-replacement.md`):
`DATE_RANGE` to en dash `–`; `PROSE` to comma, period, colon, or parentheses;
`EMPTY_VALUE` to plain hyphen `-`; `NOTE_PREFIX` to the note with no leading dash;
`TEST` and `COMMENT` follow the class of the text they contain.

**Warning about the inventory**: the class labels below were produced by
`%TEMP%\opencode\classify_em2.ps1`, which triages by pattern. It misfiled four
occurrences it could not pattern-match: `WeeklyHolidaysSection.vue:59`,
`EnrollmentHistoryTab.vue:169`, and `WorkPatternFormDialog.vue:166` are
`EMPTY_VALUE`, not `PROSE`, and `AttendancePeriodView.vue:119` and
`NonWorkingDayListView.vue:211` build a two-value label, so they are `NOTE_PREFIX`,
not a range. Read each line before replacing it. The pattern is a triage aid, not
ground truth.

---

## Phase 1: Setup

**Purpose**: Capture the state this feature must not regress, before any edit.

- [x] T001 Capture the pre-change test baseline in every app this feature touches, running `pnpm validate` in `academic-web`, `admin-web`, `admission-web`, `assessment-web`, `hr-web`, `inventory-web`, `portal-web` and recording the test file count and test count for each; SC-006 compares against these numbers and only `admission-web` (15 files / 93 tests from feature 002) is known in advance
- [x] T002 [P] Capture the em dash inventory by running `%TEMP%\opencode\classify_em2.ps1` from the workspace root, which writes `%TEMP%\opencode\em_rows.json`; confirm it reports 104 occurrences in 65 distinct relative paths (87 user-visible in 59, 10 test, 7 comment) and that the totals match `data-model.md` Entity 2
- [x] T003 [P] Confirm the pre-change token values by reading `--input`, `--border`, and `--primary` in the `:root` block of `<app>/src/style.css` in all seven apps, and confirm `--input` reads `oklch(0.928 0.006 264.531)` in each, so the change in Phase 4 is measured against a known starting point

**Checkpoint**: The pre-change state is recorded and the work can be verified against it.

---

## Phase 2: Foundational

**Purpose**: None. This feature has no blocking prerequisite: it changes text,
one token value, and decorative markup, and every user story is independently
actionable in its own files after Phase 1.

**Checkpoint**: Phase 1 complete, all stories unblocked.

---

## Phase 3: User Story 1 - The landing page stops promising a choice that does not exist (Priority: P1) 🎯 MVP

**Goal**: The landing copy matches the shipped product, in which the wave is
resolved by the server and the visitor chooses nothing.

**Independent Test**: Read the landing page in a browser with an open wave, then
complete sign-up and read the created application's wave from the database. The
copy matches the outcome without the visitor choosing anything.

**Constraint that governs every string**: the dialog takes no wave argument
(`src/features/admission/composables/useSignUpDialog.ts`) and the form renders the
wave as a locked field (`src/features/admission/views/ApplicationFormView.vue`).
No replacement may ask the visitor to choose, select, or pick a wave.

- [x] T004 [US1] Rewrite the "how do I start registering" answer in `admission-web/src/features/admission/components/landing/LandingFaq.vue:8`, removing "...kemudian pilih gelombang pendaftaran yang tersedia." and describing what the system does instead, with no instruction to choose a wave and no new claim about timing
- [x] T005 [US1] Rewrite the wave section heading in `admission-web/src/features/admission/components/landing/LandingWaveSection.vue:42`, replacing "Pilih gelombang yang tersedia" with wording that presents the open wave rather than asking the visitor to select one, keeping the section's meaning (schedule, quota, fee)
- [x] T006 [US1] Rewrite the per-card button label in `admission-web/src/features/admission/components/landing/LandingWaveSection.vue:182`, replacing "Daftar pada gelombang ini" with wording that names the action and not that card's wave, and stays consistent with the T005 heading since both open the same dialog

**Checkpoint**: No landing string instructs a wave choice. Run quickstart S1 and S3.

---

## Phase 4: User Story 2 - Every text and control edge passes its contrast bar (Priority: P1)

**Goal**: Two text runs reach 4.5:1 and every control edge reaches 3:1.

**Independent Test**: Measure each flagged pairing in a browser at the computed
color and confirm the ratio meets its bar, and confirm non-control surfaces did
not move.

**Contract**: `contracts/control-edge-token.md`. `--input` becomes
`oklch(0.64 0.006 264.531)`; `--border` stays `oklch(0.928 0.006 264.531)`.

- [x] T007 [P] [US2] Replace `text-white/80` with `text-white` in `admission-web/src/features/admission/components/landing/LandingCta.vue:21`, taking the eyebrow text from 3.87:1 to 5.09:1 against `bg-primary`
- [x] T008 [US2] Replace `text-white/85` with `text-white` in `admission-web/src/features/admission/components/landing/LandingCta.vue:27`, taking the body text from 4.15:1 to 5.09:1; must run after T007 because both edit `LandingCta.vue`
- [x] T009 [P] [US2] Change `--input` to `oklch(0.64 0.006 264.531)` in `academic-web/src/style.css`, leaving `--border` untouched, reaching 3.37:1 against card and 3.23:1 against background
- [x] T010 [P] [US2] Change `--input` to `oklch(0.64 0.006 264.531)` in `admin-web/src/style.css`, leaving `--border` untouched
- [x] T011 [P] [US2] Change `--input` to `oklch(0.64 0.006 264.531)` in `admission-web/src/style.css`, leaving `--border` untouched
- [x] T012 [P] [US2] Change `--input` to `oklch(0.64 0.006 264.531)` in `assessment-web/src/style.css`, leaving `--border` untouched
- [x] T013 [P] [US2] Change `--input` to `oklch(0.64 0.006 264.531)` in `hr-web/src/style.css`, leaving `--border` untouched
- [x] T014 [P] [US2] Change `--input` to `oklch(0.64 0.006 264.531)` in `inventory-web/src/style.css`, leaving `--border` untouched
- [x] T015 [P] [US2] Change `--input` to `oklch(0.64 0.006 264.531)` in `portal-web/src/style.css`, leaving `--border` untouched
- [x] T016 [US2] Verify the token change is confined, by reading `--border` back in all seven apps and confirming it still reads `oklch(0.928 0.006 264.531)`, and by checking that a non-control surface (a card edge and a table rule) is visually unchanged

**Checkpoint**: Both text pairings and both control-edge pairings pass. Run
quickstart S5 and S6, including the unchecked-switch observation that
`research.md` R1 records as accepted.

---

## Phase 5: User Story 3 - No em dash ships in any interface (Priority: P2)

**Goal**: Zero occurrences of U+2014 in any shipped file across the seven apps.

**Independent Test**: Scan `src/**` and `packages/**` in all seven apps for
U+2014 and confirm zero remain. Read the files as UTF-8: PowerShell's default
encoding misreads UTF-8 and turns an em dash into a hyphen, so a scan using the
default encoding is not evidence.

**Shared files first.** These four paths exist identically in more than one app,
and the constitution names a copy left behind a bug. Each task below covers every
copy in the same session.

- [x] T017 [P] [US3] Remove the em dash from `packages/ui/src/components/ServiceUnavailable.vue:31` in **all seven apps** (`academic-web`, `admin-web`, `admission-web`, `assessment-web`, `hr-web`, `inventory-web`, `portal-web`); `PROSE`, "Data yang ada tidak hilang, hanya belum bisa diambil sekarang."; the seven copies are byte-identical (same MD5), so they must still be byte-identical after the edit
- [x] T018 [P] [US3] Remove the em dash from `packages/platform/src/features/reference-data/composables/useReferenceList.ts:12` in **all seven apps**; `PROSE`, inside a documentation string, "PaginationQueryDto caps it here." after a comma; verify all seven copies remain byte-identical
- [x] T019 [P] [US3] Remove the em dash from `packages/platform/src/features/profile/types/school-identity.ts:8` in **all seven apps**; `COMMENT`, "every service already depends on it for auth, so a" after a comma; verify all seven copies remain byte-identical
- [x] T020 [P] [US3] Remove the em dash from `packages/platform/src/features/dashboard/views/DashboardView.vue:724` in `assessment-web`, `hr-web`, `inventory-web`; `NOTE_PREFIX`, the rendered `— {{ formatDate(event.endDate) }}` becomes the date with no leading dash; verify the three copies remain byte-identical

**App-local files.** Each app's own files, independent of the others.

- [x] T021 [P] [US3] Fix the 20 em dash files in `academic-web`: `src/features/academic/academic-calendar/composables/useCalendarDialogForm.ts:107` (DATE_RANGE), `.../useCalendarFormPage.ts:110` (DATE_RANGE), `academic-setting/components/PassingScoreSection.vue:59` (PROSE), `academic-setting/components/WeeklyHolidaysSection.vue:59` (EMPTY_VALUE, the classifier called it PROSE, read it), `classroom/components/EnrollmentHistoryTab.vue:169` (EMPTY_VALUE, the classifier called it PROSE), `curriculum-subject/components/CurriculumSubjectFormDialog.vue:225` (PROSE), `semester/components/PromotionStepSelect.vue:51` (DATE_RANGE), `semester/components/RolloverSemesterDialog.vue:55` (DATE_RANGE), `semester/composables/usePromotionTable.spec.ts` x3 (TEST), `semester/logic/selectableTargetYears.spec.ts` x2 (TEST), `semester/views/PromotionView.vue:399` (PROSE), `student-graduation/components/BulkGraduationDialog.vue:108` (PROSE), `student-graduation/components/GraduationStudentTable.vue:528` (PROSE), `student-parent/routes.ts:11` (PROSE), `student-parent/views/StudentParentView.vue:86` (PROSE), `teaching-assignment/components/TeachingAssignmentFormDialog.vue:349` (PROSE), `time-slot/components/TimeSlotManageTable.vue:73` (EMPTY_VALUE)
- [x] T022 [P] [US3] Fix the em dash in `admin-web/packages/platform/src/features/permission/components/PermissionFormDialog.vue` at lines 82 and 110; both `PROSE`, the first inside a returned `module.action` string and the second "not dapat diubah, hanya deskripsi."
- [x] T023 [P] [US3] Fix the 5 app-local em dash files in `admission-web`: `src/features/admission/components/DocumentsStep.vue:55` (NOTE_PREFIX), `components/PaymentStep.vue:42` (NOTE_PREFIX), `components/WaveFormDialog.vue:135` (DATE_RANGE), `views/ApplicationDetailView.vue:359` (NOTE_PREFIX), `views/WaveListView.vue:50` (DATE_RANGE); leave `LandingHero.vue:32` and `LandingWaveSection.vue:25` alone, they already use an en dash correctly
- [x] T024 [P] [US3] Fix the 3 app-local em dash files in `assessment-web`: `src/features/assessment/my-dashboard/components/StudentDashboard.vue:36` (DATE_RANGE), `rapor/components/myRaporColumns.ts:23` (PROSE, a `join(' - ')` that is really a range, read it), `rapor/components/RaporDetailDialog.vue:83` (NOTE_PREFIX)
- [x] T025 [P] [US3] Fix the em dash in `hr-web/src/features/employee/employee/components/EditPositionDialog.vue:191` (PROSE) and the 7 payroll files: `payroll/assignment/components/salaryAssignmentColumns.ts:160` (DATE_RANGE), `payroll/payslip/components/PayslipCard.vue` lines 26 and 52 (EMPTY_VALUE and PROSE), `payroll/run/__tests__/payrollRunService.spec.ts` x2 (TEST), `payroll/run/components/RunWorkflowActions.vue` lines 47 and 49 (PROSE and EMPTY_VALUE), `payroll/run/views/PayrollRunDetailView.vue` lines 63 and 125 (both EMPTY_VALUE), `payroll/shared/money.ts` lines 11 and 18 (both EMPTY_VALUE)
- [x] T026 [US3] Fix the 6 presence-attendance em dash files in `hr-web`: `src/features/presence/employee-attendance/components/columns.ts` x3 (lines 29, 40, 107; PROSE and EMPTY_VALUE), `components/CorrectionDialog.vue:100` (EMPTY_VALUE), `components/CorrectionTrailPopover.vue:24` (PROSE, a null guard), `components/myAttendanceColumns.ts` lines 22 and 71 (PROSE and EMPTY_VALUE), `components/recapColumns.ts:10` (EMPTY_VALUE), `views/EmployeeAttendanceView.vue:65` (PROSE); must run after T025 only because both edit `hr-web`, the files do not overlap
- [x] T027 [US3] Fix the remaining 12 presence em dash files in `hr-web`: `src/features/presence/credential/components/credentialColumns.ts:45` (EMPTY_VALUE), `credential/components/IssueCredentialDialog.vue:118` (PROSE), `device/components/deviceColumns.ts:49` (EMPTY_VALUE), `device/views/DeviceListView.vue:105` (PROSE), `kiosk/views/KioskPairingView.vue:34` (PROSE), `kiosk/views/KioskView.vue:90` (PROSE), `leave/components/leaveApprovalColumns.ts:34` (EMPTY_VALUE), `leave/components/myLeaveColumns.ts:87` (PROSE), `leave-type/components/leaveTypeColumns.ts:64` (PROSE), `work-pattern/components/workPatternAssignmentColumns.ts:66` (PROSE), `work-pattern/components/WorkPatternFormDialog.vue:166` (EMPTY_VALUE, the classifier called it PROSE, it is a rendered `-`), `work-pattern/views/AttendancePeriodView.vue` lines 110 and 119 (PROSE and a two-value label), `work-pattern/views/NonWorkingDayListView.vue:211` (a two-value label, the classifier called it a range; decide whether it is a range or a label and state which)
- [x] T028 [P] [US3] Fix the 3 app-local em dash files in `inventory-web`: `src/features/inventory/logic/labelSheetLayout.spec.ts` x2 (TEST), `views/AssetLabelPrintView.vue:166` (PROSE), `views/WorkflowListView.vue` lines 79, 275, 320 (all PROSE)
- [x] T029 [P] [US3] Fix the 6 app-local em dash files in `portal-web`: `src/features/media/components/MediaLibraryDialog.vue` lines 104 and 174 (both PROSE), `page/views/PageListView.vue:45` (PROSE, a null guard), `post/services/postService.spec.ts` (TEST), `post/views/PostFormView.vue` lines 328 and 440 (both PROSE), `post/views/PostListView.vue` lines 96 and 145 (PROSE and EMPTY_VALUE), `taxonomy/config/categoryConfig.ts:44` (PROSE)
- [x] T030 [US3] Re-run `%TEMP%\opencode\classify_em2.ps1` and confirm zero U+2014 across `src/**` and `packages/**` in all seven apps; if any remain, fix them before leaving this phase. This is the gate for US3 and the evidence for SC-004

**Checkpoint**: The scan returns zero in all seven apps. Run quickstart S7 and S8.

---

## Phase 6: User Story 4 - Decoration earns its place and the direction is written down (Priority: P3)

**Goal**: Four orbs and one glass badge are gone, five arrows are gone, and
`DESIGN.md` exists with owner-supplied content.

**Deviation found while implementing**: a **fifth** orb was found at
`LandingWaveSection.vue:95` (`rounded-full bg-primary/8` with a
`group-hover:scale-125`). It was not in the audit or this task list, but it is
the same pattern as the four T031/T032 remove, so it was removed and the
now-dead `group` class with it. The audit undercounted decoration the same way it
undercounted em dashes.

**Independent Test**: Inspect the two sections and confirm the decoration is gone;
click the five CTAs and confirm they still work; open the workspace root and find
`DESIGN.md`.

**Constraint**: removal must cost no text and no function. The capsule badge
carries real text that stays as plain text; every CTA must still open the dialog.

- [x] T031 [P] [US4] Remove the two blurred orbs in `admission-web/src/features/admission/components/landing/LandingHero.vue` at lines 51 and 54 (`bg-primary/35 blur-3xl` and `bg-amber-300/20 blur-3xl`), leaving the hero photograph and the dark scrim at lines 47 to 48 intact, since the hero's text contrast depends on that scrim
- [x] T032 [P] [US4] Remove the two blurred orbs in `admission-web/src/features/admission/components/landing/LandingCta.vue` at lines 15 and 18 (`bg-white/10 blur-2xl` and `bg-sky-300/25 blur-2xl`)
- [x] T033 [US4] Unwrap the glass capsule badge in `admission-web/src/features/admission/components/landing/LandingHero.vue:64`, removing `rounded-full border border-white/20 bg-white/10 backdrop-blur-sm` and the dot span at line 66, and keeping the text "Pendaftaran online MTs Persis 241 Al-Ikhlas" as visible plain text; must run after T031 because both edit `LandingHero.vue`
- [x] T034 [US4] Remove the `ArrowRight` usage and the now-unused import in `admission-web/src/features/admission/components/landing/LandingCta.vue` (import line 2, usage line 37); leaving the import fails `lint:strict` on an unused import
- [x] T035 [US4] Remove the `ArrowRight` usage and the now-unused import in `admission-web/src/features/admission/components/landing/LandingHero.vue` (import line 4, usage line 86); must run after T031 and T033 because all three edit `LandingHero.vue`
- [x] T036 [US4] Remove the three `ArrowRight` usages (lines 54, 183, 198) and the now-unused import (line 4) in `admission-web/src/features/admission/components/landing/LandingWaveSection.vue`
- [x] T037 [US4] Write `DESIGN.md` at the workspace root per `contracts/design-direction.md`: the six fields (identity, personality, palette, typography, mood, and the three dials), palette and typography measured from `src/style.css` in all seven apps rather than invented, and an opening section stating that the file is agent-authored at the owner's request. The owner asked the agent to author it with best practice on 2026-09-15, which supersedes the earlier plan where the owner supplied the answers. Done: `DESIGN.md` written, 0 em dashes, palette values match the shipped tokens

**Checkpoint**: Decoration and arrows are gone, no CTA lost its behavior, and
`DESIGN.md` exists or is explicitly open. Run quickstart S9 and S10.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T038 Re-run the em dash scan as the final gate across all seven apps, reading files as UTF-8, and record the zero result as the evidence for SC-004

**Deviation found while implementing**: the Phase 1/T002 inventory scanned only
`src`, `packages\ui\src`, `packages\platform\src`, and `packages\shared\src`, so
it missed 63 occurrences in `packages\reference-data\src`, `smoke\`,
`CLAUDE.md`, `package.json`, and `docs\`. The owner approved correcting all of
them on 2026-09-15. True total: **167**, now zero. The scan gate below reads the
whole tree, not the four directories.
- [x] T039 [P] Run `pnpm validate` in `academic-web` and confirm all six stages pass with the test count at or above the T001 baseline, which is the regression evidence for the `--input` change and the 20 em dash edits in that app
- [x] T040 [P] Run `pnpm validate` in `admin-web`, same check
- [x] T041 [P] Run `pnpm validate` in `admission-web`, same check, expecting at or above the 15 files / 93 tests baseline from feature 002
- [x] T042 [P] Run `pnpm validate` in `assessment-web`, same check
- [x] T043 [P] Run `pnpm validate` in `hr-web`, same check; this app carries the most edits (39 occurrences)
- [x] T044 [P] Run `pnpm validate` in `inventory-web`, same check
- [x] T045 [P] Run `pnpm validate` in `portal-web`, same check
- [x] T046 Investigate the pre-existing 1px horizontal overflow on `/login` at 320px and fix it if the cause is one line, or state it with the cause if it is not; this is FR-022, and it is pre-existing, not caused by the sign-up link
- [x] T047 Run quickstart S1, S2, S3, S5, S6, S7, S8, S9, S11, S12 against the running stack with a real database read for S2, and record the per-scenario result with its evidence
- [x] T048 Record quickstart S4 (Google round trip) as OPEN with its reason written down; with `GOOGLE_CLIENT_ID` = `change-me-in-production` it cannot be run, and it may not be reported as passing. S10 passes on T037 plus the review check in `contracts/design-direction.md`
- [x] T049 [P] Update `admission-web/docs/OVERVIEW.md` so the landing page description matches the new copy and the removal of the orbs, badge, and arrows, reading each claim back against the code before writing it
- [x] T050 [P] Update the seven apps' shared documentation for the `--input` value change, since `packages/ui` and `packages/platform` are copied per app and a documented token that drifted is the bug the constitution names
- [x] T051 Write the follow-up report to `anti-slop/audit-002-2026-09-15.md`, one line per finding stating what was fixed and what stayed open (finding 5's two gaps, and the widening of finding 2 from 5 occurrences to 104)
- [x] T052 Record the decision that no automated em dash guard was added, and note the follow-up for the owner, per `research.md` R10
- [x] T053 Record that no app ships a dark theme, so R-21 and R-34 are out of scope, and that this is stated rather than silently skipped
- [x] T054 Record in the feature's `progress.md` the accepted appearance change to the unchecked switch, so it is documented rather than discovered later as a regression

---

## Requirements Coverage

Every functional requirement maps to at least one task, and every task carries a
requirement or a verification obligation. Nothing here is work the spec did not
ask for.

| Requirement | Tasks |
| --- | --- |
| FR-001 no instruction to choose a wave | T004, T005 |
| FR-002 per-card CTA names no specific wave | T006 |
| FR-003 wave section stays, with real schedule/quota/fee | T005 (keeps the section), T047 (S2, S3) |
| FR-004 FAQ describes the server-resolved wave | T004 |
| FR-005 CTA text at 4.5:1, no translucent white on normal text | T007, T008 |
| FR-006 control edge at 3:1 against card and background | T009 to T015 |
| FR-007 change confined to `--input`, `--border` unchanged | T016 |
| FR-008 applied to all seven apps in one session | T009 to T015 |
| FR-009 no em dash in any user-visible string | T017 to T030 |
| FR-010 ranges use an en dash | T017, T021, T023, T024, T025, T027 |
| FR-011 prose uses comma, period, colon, or parentheses | T018, T019, T021, T022, T024, T025, T026, T027, T028, T029 |
| FR-012 empty value uses a plain hyphen | T021, T025, T026, T027, T029 |
| FR-013 note separated by punctuation, not a leading dash | T020, T023, T024, T027 |
| FR-014 all 104 occurrences corrected | T002 (inventory), T017 to T030 |
| FR-015 multi-app files corrected in every copy | T017, T018, T019, T020 |
| FR-016 four blurred orbs removed | T031, T032 |
| FR-017 glass capsule removed, its text kept | T033 |
| FR-018 arrow removed from five CTAs | T034, T035, T036 |
| FR-019 `DESIGN.md` exists with the six fields | T037 |
| FR-020 `DESIGN.md` names its provenance, measures what is measurable | T037 |
| FR-021 click-through recorded element by element | T047 |
| FR-022 two gaps stated, `/login` overflow investigated | T046, T048 |

Success criteria map as follows: SC-001 → T047; SC-002 → T047; SC-003 → T047;
SC-004 → T030 and T038; SC-005 → T037 and T048; SC-006 → T001 and T039 to T045;
SC-007 → T047.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies, run first, because the baselines and the inventory are what everything else is verified against
- **Foundational (Phase 2)**: empty, so all four stories are unblocked once Phase 1 finishes
- **US1 (Phase 3)**: after Phase 1; three edits in two files, both in `admission-web`
- **US2 (Phase 4)**: after Phase 1; T007 and T008 are one file, T009 to T015 are seven independent files
- **US3 (Phase 5)**: after Phase 1; T017 to T020 (shared) and T021 to T029 (per app) are independent of each other
- **US4 (Phase 6)**: after Phase 1; T031/T033/T035 chain on `LandingHero.vue`, T032 and T034 chain on `LandingCta.vue`, T036 is independent, T037 is done
- **Polish (Phase 7)**: after all stories

### Cross-story file conflicts

Three landing files appear in more than one story, so the stories are not fully
independent and the order matters:

| File | Stories | Note |
| --- | --- | --- |
| `LandingWaveSection.vue` | US1 (T005, T006), US3 (T023), US4 (T036) | edit in that order |
| `LandingCta.vue` | US2 (T007, T008), US3 (T032), US4 (T034) | edit in that order |
| `LandingHero.vue` | US3 (T023 leaves it alone), US4 (T031, T033, T035) | US3 must not touch it |

`research.md` R9 records why the order is copy, then contrast, then em dashes,
then decoration: it keeps each landing file edited once per concern instead of
interleaving, and a failure in the decoration pass cannot mask a copy or contrast
regression.

### Within each story

- US1: T004 is independent; T005 before T006, same file
- US2: T007 before T008, same file; T009 to T015 parallel; T016 after all of them
- US3: T017 to T020 parallel with each other and with T021 to T029; T030 after all
- US4: T031 before T033 before T035; T032 before T034; T036 independent; T037 done

### Parallel opportunities

- Phase 1: T002 and T003 parallel after T001
- Phase 4: T009 to T015 all parallel (seven different `style.css` files)
- Phase 5: T017 to T020 and T021 to T029 largely parallel; T021 to T029 are per-app and do not overlap, but T025, T026, T027 all edit `hr-web` and should be run in that order to avoid two agents in one app
- Phase 7: T039 to T045 all parallel, one app each

---

## Parallel Example: User Story 2

```text
# The seven token edits are seven different files, so launch them together:
Task: "T009 Change --input in academic-web/src/style.css"
Task: "T010 Change --input in admin-web/src/style.css"
Task: "T011 Change --input in admission-web/src/style.css"
Task: "T012 Change --input in assessment-web/src/style.css"
Task: "T013 Change --input in hr-web/src/style.css"
Task: "T014 Change --input in inventory-web/src/style.css"
Task: "T015 Change --input in portal-web/src/style.css"
```

## Parallel Example: User Story 3

```text
# Shared files first, then the per-app groups:
Task: "T017 ServiceUnavailable.vue, all seven copies"
Task: "T018 useReferenceList.ts, all seven copies"
Task: "T019 school-identity.ts, all seven copies"
Task: "T020 DashboardView.vue, three copies"
Task: "T021 academic-web, 20 files"
Task: "T022 admin-web, 1 file"
Task: "T023 admission-web, 5 files"
Task: "T024 assessment-web, 3 files"
Task: "T028 inventory-web, 3 files"
Task: "T029 portal-web, 6 files"
# hr-web is four sequential groups (T025 to T027) because they share one app
```

---

## Implementation Strategy

### MVP first

US1 and US2 are both P1 and both tiny: three copy edits, two text-color edits,
and seven one-line token edits. Together they close the only finding the feature
made false and all three measured contrast failures. Ship that first and the
audit's Hard Gate failures for honesty and legibility are gone.

1. Phase 1 (baselines), then T004 to T006 (US1), then T007 to T016 (US2)
2. **STOP and validate**: quickstart S1, S3, S5, S6
3. Demo or deploy

### Incremental delivery

1. US1 and US2 → the P1 failures are closed
2. US3 → the Hard Gate em dash rule passes repo-wide (the largest, most mechanical slice)
3. US4 → decoration and arrows gone; `DESIGN.md` open until the owner answers
4. Phase 7 → gates green in seven apps, quickstart recorded, audit updated

### Stated gaps, not silently skipped

- S4 (live Google consent) cannot run with the placeholder client ID
- S10 (`DESIGN.md`) stays open until the owner supplies the direction
- The unchecked switch changes appearance, accepted and recorded
- No app ships a dark theme, so R-21 and R-34 are out of scope
- No automated em dash guard is added; noted as a follow-up

### Scope note

There is no "commit after each task" step in this list. This workspace has no git
repositories, ruled on 2026-09-14, so verification is by test runs and file reads
rather than by diff.

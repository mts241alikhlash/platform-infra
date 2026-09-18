# Phase 1 Data Model: UI Audit Remediation

This feature introduces no persistent model. What follows describes the four
artifacts the requirements actually edit, so a task can be checked against
something concrete rather than a description.

## Entity 1: Control edge token

A single CSS custom property, declared once per app, consumed by form controls.

| Field | Value |
| --- | --- |
| Name | `--input` |
| Current value | `oklch(0.928 0.006 264.531)` (`#E5E7EB`) |
| Target value | `oklch(0.64 0.006 264.531)` (`#8A8C90`) |
| Declared in | `<app>/src/style.css`, `:root` block |
| Line | 69 in `admission-web`; each app differs, so the line is found by name |
| Exposed to Tailwind as | `--color-input` (line 34, `@theme inline`) |
| Consumed as | `border-input` utility, and `bg-input` |

**Consumers, verified by grep across `admission-web/packages`:**

| Consumer | Class position | Is it a boundary? |
| --- | --- | --- |
| `ui/input/Input.vue:28` | `border-input ... border` | Yes, control edge |
| `ui/textarea/Textarea.vue:27` | `border-input ... border` | Yes, control edge |
| `ui/native-select/NativeSelect.vue:40` | `border-input ... border` | Yes, control edge |
| `ui/select/SelectTrigger.vue:30` | `border-input ... border` | Yes, control edge |
| `ui/checkbox/Checkbox.vue:26` | `border-input ... border` | Yes, control edge |
| `ui/switch/Switch.vue:26` | `data-[state=unchecked]:bg-input` | No, it is the off-state fill |

**Constraint that follows**: the token has two roles. Changing it fixes five
control boundaries and also darkens the unchecked switch fill. The switch change
is accepted and recorded in `research.md` R1, not treated as a violation, because
the off-state fill had the same illegibility problem and darkening it helps.

**Not changed**: `--border` keeps `oklch(0.928 0.006 264.531)`. It is applied
globally by `* { @apply border-border }` in the same file and colors every
divider, card edge, table rule, and the scrollbar thumb.

**Replication**: seven copies, all currently identical in value, in files that
are otherwise different per app. `src/style.css` MD5 values are all distinct
(they differ in `@source` paths and one app adds a reduced-motion block), so each
copy is edited by hand and verified by reading the value back, not by comparing
file hashes.

## Entity 2: Em dash occurrence

104 instances of U+2014, each needing exactly one replacement decided by its
class. The full list is machine-readable at `%TEMP%\opencode\em_rows.json` and is
reproducible with `%TEMP%\opencode\classify_em2.ps1`.

| Field | Meaning |
| --- | --- |
| App | one of the seven; `hr-web` 39, `academic-web` 23, `portal-web` 12, `inventory-web` 10, `admission-web` 8, `assessment-web` 7, `admin-web` 5 |
| File | path relative to the app root |
| Line | 1-based line number at scan time, moves as edits land, so match on text too |
| Class | `PROSE`, `DATE_RANGE`, `EMPTY_VALUE`, `NOTE_PREFIX`, `TEST`, `COMMENT` |
| Text | the matching line, as written |

**Class distribution:**

| Class | Count | Files | Replacement rule |
| --- | --- | --- | --- |
| `PROSE` | 57 | many | comma, period, colon, or parentheses |
| `EMPTY_VALUE` | 13 | hr + academic + portal | plain hyphen `-` |
| `NOTE_PREFIX` | 9 | admission, assessment, hr, inventory | drop the dash, keep the note |
| `DATE_RANGE` | 8 | academic, admission, assessment, hr | en dash `–` |
| `TEST` | 10 | academic, hr, inventory, portal | by the class of the string it builds |
| `COMMENT` | 7 | shared + per-app | by the prose rule |

**Occurrence-to-class examples**, one per class, so a task can self-check:

- `DATE_RANGE`: `admission-web/src/features/admission/views/WaveListView.vue:50`,
  `` `${formatDate(row.original.startDate)} — ${formatDate(row.original.endDate)}` ``
  becomes an en dash.
- `EMPTY_VALUE`: `hr-web/src/features/payroll/shared/money.ts:18`, `? '—'`
  becomes `? '-'`.
- `NOTE_PREFIX`: `admission-web/src/features/admission/components/PaymentStep.vue:42`,
  `— {{ applicationPayment.note }}` becomes the note with no leading dash.
- `PROSE`: `academic-web/src/features/academic/academic-setting/components/PassingScoreSection.vue:59`,
  "tercantum di kurikulum tingkat dan tahun tersebut — jadi tidak ada KKM"
  becomes a comma.
- `COMMENT`: `admission-web/packages/platform/src/features/profile/types/school-identity.ts:8`,
  "not call any of them — every service already depends on it for auth, so a"
  becomes a comma.
- `TEST`: `hr-web/src/features/payroll/run/__tests__/payrollRunService.spec.ts`
  (2 occurrences), follows whatever class the string it builds is.

**Invariant**: the character U+2014 is not a range separator, not punctuation,
and not a placeholder. Each of the four classes has exactly one legal
replacement, so classification is the whole task and no judgement is left at
edit time.

**Files that exist in more than one app**, so a copy left behind is a drift bug:

| File | Apps | Hits |
| --- | --- | --- |
| `packages/ui/src/components/ServiceUnavailable.vue` | all 7 | 7 |
| `packages/platform/src/features/reference-data/composables/useReferenceList.ts` | all 7 | 7 |
| `packages/platform/src/features/profile/types/school-identity.ts` | all 7 | 7 (comment only) |
| `packages/platform/src/features/dashboard/views/DashboardView.vue` | assessment, hr, inventory | 3 |

## Entity 3: Landing copy string

Three strings on the admission landing page that describe a choice the product
does not offer. Each is a decision, not a mechanical replacement, so it is
listed with its constraint rather than its new text.

| Location | Current | Constraint on the replacement |
| --- | --- | --- |
| `LandingFaq.vue:8` | "Pilih tombol Daftar Sekarang, buat akun menggunakan email aktif, kemudian pilih gelombang pendaftaran yang tersedia." | Describes what the system does; no instruction to choose a wave; no new claim about timing. |
| `LandingWaveSection.vue:42` | heading "Pilih gelombang yang tersedia" | Presents the open wave; does not ask the visitor to select one; keeps the section's meaning (schedule, quota, fee). |
| `LandingWaveSection.vue:182` | button "Daftar pada gelombang ini" | Names the action, not the card's wave; stays consistent with the section heading, since both open the same dialog. |

**Ground truth for the constraint**: the dialog takes no argument
(`admission-web/src/features/admission/composables/useSignUpDialog.ts`, module-scoped
`isOpen`, `open()` takes none), and the wave is server-resolved by
`findActiveWave()` in `admission-service`. So no replacement may mention choosing,
selecting, or picking a wave.

**Not changed**: `LandingWaveSection` still renders each wave's schedule, quota,
and fee from the API. `LandingRequirements.vue:32` says requirements follow "the
registration wave", which stays true and is out of scope.

## Entity 4: Design direction document

A new file at the workspace root, whose content is supplied by the owner.

| Field | Value |
| --- | --- |
| Path | `D:\Project\241 Apps\DESIGN.md` |
| Author | the product owner; the agent transcribes only |
| Required content | identity, personality, palette, typography, mood, and the three dials (ENERGY / RHYTHM / MOTION) |
| Current status | not written; FR-019 open until the owner supplies answers |
| Existing material | palette and typography are measurable from `src/style.css` and can be confirmed rather than invented |

**Constraint**: R-37 and R-31 require the direction to exist and each major
decision to carry a one-line reason. A placeholder file would satisfy the check
and defeat the purpose, so the task does not write one.

## What this feature does not touch

- No Prisma model, no migration, no schema file. `prisma:generate` is not needed.
- No DTO, no controller, no use case, no repository. No `*.spec.ts` is required by
  Principle V, since no new use case ships.
- No API contract, so the append-only rule does not engage.
- No permission code, no route, no database read.

# Contract: em dash replacement

How every one of the 104 occurrences of U+2014 is decided and replaced.

## The rule being satisfied

antislop R-02 forbids the em dash character in any text. It does not forbid
dashes generally, so a range may use an en dash and a table may use a hyphen. The
carve-out for documenting the rule does not apply to shipped UI text.

## Replacement table

| Class | Trigger | Replacement | Forbidden alternative |
| --- | --- | --- | --- |
| `DATE_RANGE` | the dash sits between two dates, years, terms, or codes in a displayed span | en dash `–` (U+2013), same surrounding spaces | comma, the word "sampai", em dash |
| `PROSE` | the dash joins two clauses of a sentence | comma, period, colon, or parentheses, whichever the sentence wants | en dash, hyphen |
| `EMPTY_VALUE` | the dash is returned for a missing value (`?? '—'`, `? '—'`, `cell: ... ?? '—'`) | plain hyphen `-` (U+002D) | en dash, empty string |
| `NOTE_PREFIX` | the dash begins a rendered note beside a label | remove the dash, render the note under its label | comma prefix (reads as clutter) |
| `TEST` | the dash is inside a spec, in a string it builds | follow the class of the string built | leaving it |
| `COMMENT` | the dash is inside a code comment | comma or colon | leaving it |

## Worked examples, one per class

```ts
// DATE_RANGE, admission-web/src/features/admission/views/WaveListView.vue:50
`${formatDate(row.original.startDate)} — ${formatDate(row.original.endDate)}`
`${formatDate(row.original.startDate)} – ${formatDate(row.original.endDate)}`

// EMPTY_VALUE, hr-web/src/features/payroll/shared/money.ts:18
? '—'
? '-'

// PROSE, academic-web/.../PassingScoreSection.vue:59
tercantum di kurikulum tingkat dan tahun tersebut — jadi tidak ada KKM
tercantum di kurikulum tingkat dan tahun tersebut, jadi tidak ada KKM
```

```vue
<!-- NOTE_PREFIX, admission-web/src/features/admission/components/PaymentStep.vue:42 -->
— {{ applicationPayment.note }}
{{ applicationPayment.note }}
```

## Precedent already in the repo

An en dash for a range is not a new convention. Three files already do it:

- `admission-web/src/features/admission/components/landing/LandingHero.vue:32`
- `admission-web/src/features/admission/components/landing/LandingWaveSection.vue:25`
- `admission-web/packages/ui/src/components/ui/calendar/Calendar.vue:125`

The audit named the inconsistency between these and the eight em dash ranges as
the reason those ranges are not merely rule violations but internal
contradictions. They are corrected to match.

## Invariants a reviewer checks

1. A repo-wide scan of `src/**` and `packages/**`, `*.vue`, `*.ts`, `*.css`, in
   all seven apps returns zero U+2014.
2. No rendered spacing changed. The en dash sits between the same spaces the em
   dash did.
3. Files that already used an en dash (`LandingHero.vue`, `LandingWaveSection.vue`
   range sites, `Calendar.vue:125`) are not rewritten; only their em dash sites,
   if any, change. A mechanical sweep that normalizes an already-correct file is a
   defect.
4. The four files present in more than one app are corrected in every copy:
   `ServiceUnavailable.vue` (7), `useReferenceList.ts` (7),
   `school-identity.ts` (7, comment), `DashboardView.vue` (3).

## Exception process

There is none. R-02 is a Hard Gate, and the owner chose to correct all 104 on
2026-09-15, including test files and comments, so no exemption is claimed and no
`// antislop-disable` style marker is introduced.

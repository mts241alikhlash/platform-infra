# Phase 0 Research: UI Audit Remediation

Every value in this document was measured, not recalled. The measurement
scripts are named so a reader can re-run them.

## R1. The control-edge token value

**Decision**: `--input: oklch(0.64 0.006 264.531)`, applied to all seven apps.
`--border` stays `oklch(0.928 0.006 264.531)`.

**Rationale**: The non-text bar is 3:1 (R-25). Measured against `card`
(`#FFFFFF`), the current `--border`/`--input` value `#E5E7EB` scores 1.24:1.
Candidate values, measured with `%TEMP%\opencode\contrast4_plan.py` and
`contrast5_plan.py` (the oklch to sRGB conversion, then WCAG relative
luminance):

| Value | Hex | vs card | vs background |
| --- | --- | --- | --- |
| `oklch(0.928 ...)` current | `#E5E7EB` | 1.24 FAIL | 1.19 |
| `oklch(0.72 ...)` | `#A3A5A8` | 2.47 FAIL | 2.36 |
| `oklch(0.68 ...)` | `#96989C` | 2.89 FAIL | 2.77 |
| `oklch(0.67 ...)` | `#939599` | 3.00 borderline | 2.87 FAIL |
| `oklch(0.66 ...)` | `#909296` | 3.12 | 2.98 borderline |
| `oklch(0.65 ...)` | `#8D8F93` | 3.24 | 3.10 |
| **`oklch(0.64 ...)` chosen** | `#8A8C90` | **3.37** | **3.23** |
| `oklch(0.60 ...)` | `#7E8084` | 3.96 | 3.79 |

`oklch(0.65 ...)` passes both bars but only clears the background comparison by
0.10. Rounding between the oklch conversion and the browser's own rendering can
move a ratio by more than that, and a value that passes only on paper is the
failure this feature exists to fix. `oklch(0.64 ...)` keeps 0.23 of margin while
still reading as a light grey edge rather than a dark outline.

**Constraint that shaped the decision**: the change must be confined to
`--input`, because `--input` colors two things, and only one of them is a
boundary. It is the border of `Input`, `Textarea`, `NativeSelect`,
`SelectTrigger`, and `Checkbox` (a real control edge, where the fix belongs), and
it is also the fill of an unchecked `Switch` (`data-[state=unchecked]:bg-input`).
Darkening it visibly changes the unchecked switch, which is a control surface
rather than a boundary. That is a real, accepted appearance change, recorded here
so it is not discovered as a surprise, and it improves the same contrast
complaint: the switch's off-state fill was previously almost indistinguishable
from the card.

**Alternatives considered**:
- Change `--border` instead. Rejected: `--border` is applied globally by
  `* { @apply border-border }` in `src/style.css` and colors every divider, card
  edge, and table rule, plus the scrollbar thumb. Darkening it is a whole-app
  restyle, far larger than the audit finding.
- Add a new `--control-border` token and point only the control classes at it.
  Rejected as the larger change: it edits seven `.vue` component files in seven
  apps (49 edits) plus seven `style.css` files, against seven edits total for the
  token-value approach, and it forks a token the design system already has.
- Leave it and record it as design-system debt. Rejected by the owner on
  2026-09-15, who chose to fix all seven apps.

## R2. The two CTA text colors

**Decision**: replace `text-white/80` (`LandingCta.vue:21`) and `text-white/85`
(`LandingCta.vue:27`) with solid `text-white`.

**Rationale**: Measured on `bg-primary` (`#2D6FBE`), compositing the white with
the opacity over the primary background before measuring:

| Value | Ratio | Bar 4.5 |
| --- | --- | --- |
| `text-white` solid | **5.09** | PASS |
| `text-white/90` | 4.47 | FAIL |
| `text-white/85` current | 4.15 | FAIL |
| `text-white/80` current | 3.87 | FAIL |

Solid white is already the convention used elsewhere in the same section's
heading and in `LandingHero.vue:70`. Opacity is the sole cause; removing it is
the smallest correct change, and it needs no new value.

Marginal alternatives were considered and rejected: `text-white/95` scores 4.77
and passes, but it is an invented value that no token defines, and there is no
visual reason to keep transparency on text whose whole job is to be read.

**Script**: `%TEMP%\opencode\contrast5_plan.py`.

## R3. The em dash replacement rules

**Decision**: four rules, one per occurrence class.

| Class | Count | Replacement | Example |
| --- | --- | --- | --- |
| Date or value range | 8 | en dash `–` (U+2013) | `${formatDate(s)} – ${formatDate(e)}` |
| Prose sentence | 57 | comma, period, colon, or parentheses | "...tersebut, jadi tidak ada KKM" |
| Empty table cell or absent value | 13 | plain hyphen `-` (U+002D) | `?? '-'` |
| Note beside a label | 9 | punctuation, dash dropped | prefix `— {{ note }}` becomes `{{ note }}` under its label |
| Test file | 10 | per the class of the string it builds | follows the same four rules |
| Code comment | 7 | per prose rule | comma or colon |

**Rationale**: R-02 forbids U+2014 absolutely. It does not forbid a dash, only
that character, so the en dash is legal for a range and is already the
convention in this codebase: `LandingHero.vue:32`,
`LandingWaveSection.vue:25`, and `Calendar.vue:125` all use an en dash for a
range today. Using it consistently makes the eight ranges match their own
neighbours, which the audit called out as the reason those two are not merely
rule violations but internal inconsistency.

The 13 empty-value sites render `-` from a `?? '-'` fallback. Those are not
sentences and not ranges; a plain hyphen is what a table uses for "no value", and
it is what the surrounding code already means.

The 9 note-prefix sites render `— {{ note }}` as a leading dash before a note.
Dropping the dash and letting the note sit under its label removes the character
without adding punctuation that would read as clutter.

**Alternatives considered**: replace every em dash with a comma, including
ranges. Rejected: it produces "1 Jan 2027, 31 Mar 2027", which reads as a list of
two items rather than a span. Replace ranges with the word "sampai". Rejected as
the larger edit and a departure from three files that already got it right.

**Exemption decision**: the owner chose to correct all 104, so test files and
code comments are included and no exemption is claimed.

## R4. The landing copy that promises a wave choice

**Decision**: three strings change, the wave section stays.

- `LandingFaq.vue:8`: "...kemudian pilih gelombang pendaftaran yang tersedia."
  becomes a statement of what the system does, naming the active wave as
  resolved rather than chosen.
- `LandingWaveSection.vue:42`: heading "Pilih gelombang yang tersedia" becomes a
  heading that presents the open wave, not a choice.
- `LandingWaveSection.vue:182`: button "Daftar pada gelombang ini" becomes the
  same action the section offers, without naming that card's wave.

**Rationale**: Since feature 002, `findActiveWave()` resolves the wave
server-side (earliest open, `isActive=true AND deletedAt IS NULL AND
startDate<=today<=endDate`) and the public register DTO no longer accepts
`waveId` (verified: `admission-service/src/admission/applicant/presentation/http/dto/request/public-register-applicant.dto.ts`). The
section still shows real per-wave schedule, quota, and fee from the API, which is
useful information, so removing the section would remove real content to fix a
copy problem.

**The duplication risk, and the answer**: once the per-card button loses its wave
wording, it reads the same as the section's own "Mulai Pendaftaran" button. Both
open the same dialog. Rather than invent a distinction, the per-card button
follows the section heading's phrasing, and the card keeps its distinct value
(the quota and fee that only that card shows). FR-021 requires clicking both and
confirming the dialog is the same and correct, so the sameness is verified as
intentional rather than left as a copy accident.

**Verified against code**, not assumed: the dialog has no wave input
(`admission-web/src/features/admission/components/SignUpDialog.vue`), and
`admission-web/src/features/admission/views/ApplicationFormView.vue` renders the
wave as a locked field. So no copy may ask the visitor to choose one.

## R5. Removing decoration

**Decision**: delete four `div`s and one badge element, keeping the hero
photograph, the dark scrim, and the typography.

| Element | Location |
| --- | --- |
| Blurred orb, `bg-primary/35`, `blur-3xl` | `LandingHero.vue:51` |
| Blurred orb, `bg-amber-300/20`, `blur-3xl` | `LandingHero.vue:54` |
| Blurred orb, `bg-white/10`, `blur-2xl` | `LandingCta.vue:15` |
| Blurred orb, `bg-sky-300/25`, `blur-2xl` | `LandingCta.vue:18` |
| Glass capsule: `rounded-full border border-white/20 bg-white/10 backdrop-blur-sm` | `LandingHero.vue:64` |

**Rationale**: R-01 bans radial orbs as a default without purpose, R-10 caps
`backdrop-filter` at one or two elements, R-09 warns against the full capsule +
border + dot + uppercase combination, and R-31 requires a one-line reason for
every major decision. No reason for any of the five exists anywhere in the repo.
The owner chose removal over writing a justification, on 2026-09-15.

For the capsule badge, the text it carried ("Pendaftaran online MTs Persis 241
Al-Ikhlas") is real information, so the element is unwrapped and the text kept,
not deleted. The hero keeps its photograph and its dark scrim
(`LandingHero.vue:47-48`), so its dark background and text contrast survive
untouched; this was checked because the orbs sit over that scrim and removing
them must not change the scrim's computed color.

## R6. Removing the CTA arrows

**Decision**: remove the `ArrowRight` glyph from all five register CTAs:
`LandingCta.vue:37`, `LandingHero.vue:86`, `LandingWaveSection.vue:54`,
`LandingWaveSection.vue:183`, `LandingWaveSection.vue:198`. Remove the now-unused
`ArrowRight` imports from all three files.

**Rationale**: R-08 says an arrow is not the default identity for every button,
and if used, its purpose must be written down. No purpose is written down, and
five arrows on five register buttons is the pattern R-08 names. The button labels
are already specific ("Daftar Sekarang", "Mulai Pendaftaran"), so the arrow adds
no orientation the label does not already give.

**Verified**: the import is used only for these five CTAs in these three files
(`LandingWaveSection.vue` imports it at line 4 and uses it at 54, 183, 198;
`LandingCta.vue` at line 2 and 37; `LandingHero.vue` at line 4 and 86), so
removing the usages leaves the imports unused and they must go too, or
`lint:strict` fails on an unused import.

## R7. `DESIGN.md`

**Decision**: `DESIGN.md` is written at the workspace root, authored by the agent
at the owner's explicit request on 2026-09-15, and it states that provenance in
its own first section.

**Rationale**: R-37 requires direction to be loaded before UI work and R-31
requires each major decision to carry a one-line reason. Today the direction lived
in `specs/002-public-signup-google/plan.md`, which satisfies the rule for that
feature but is invisible to anyone reading the apps. The owner first chose to
supply the direction, then asked the agent to author it with best practice.

That second choice carries the risk R-37 names: agent-authored direction drifts
toward default AI taste. The mitigation is not to pretend a human wrote it. The
file opens by stating who wrote it and why, marks the measurable fields as
measured, and marks the judgement fields as revisable. Palette and typography are
read out of `src/style.css` in all seven apps, so they are facts about the build
rather than choices.

The five fields the spec requires, and where each came from:

1. **Identity**: the school and its audience (parents registering a child, school
   staff administering waves and applications). Read from the shipped surfaces.
2. **Personality**: formal, warm, direct. The agent's reading of the existing copy
   and layout, marked revisable.
3. **Palette**: measured, not invented. `primary #2D6FBE`, `foreground #030712`,
   `background #F9FAFC`, `card #FFFFFF`, `muted-foreground #6A7282`,
   `destructive #E7000B`, `border #E5E7EB`, `input #8A8C90` after this feature,
   `ring #4C82C6`, each with its measured contrast obligation.
4. **Typography**: `--font-sans` is `'DM Sans'` with a system fallback in all
   seven apps. The reason for keeping it is written down.
5. **Mood, and the three dials**: ENERGY 1 / RHYTHM 1 / MOTION 1, confirmed from
   feature 002 rather than re-decided.

**Alternatives considered**: leave the file unwritten and keep the direction in
the spec folder, which was the original plan. Rejected by the owner on 2026-09-15.
Write it without stating provenance. Rejected: it satisfies the letter of FR-019
while misrepresenting how the direction was produced, which is precisely the
failure R-37 exists to prevent.

## R8. What finding 5 needs

**Decision**: no code change. Two actions.

1. The live Google consent round trip (quickstart S4/S5) stays unrun, because
   `GOOGLE_CLIENT_ID` is the placeholder `change-me-in-production`. It stays
   stated as a gap.
2. The pre-existing 1px horizontal overflow on `/login` at 320px is
   investigated. FR-022 requires fixing it if the cause is one line, and stating
   it if not. It is pre-existing and not caused by the new sign-up link, but it
   is a real R-03 failure on a page this platform ships.

**Rationale**: R-35 asks for the click-through to be recorded, which feature 002
did in `specs/002-public-signup-google/quickstart-results.md`. This feature
re-runs the affected scenarios after the changes and records which pass, which
cannot be checked, and why.

## R9. Ordering, and why

**Decision**: copy fixes first, then contrast, then em dashes, then decoration
and direction.

**Rationale**: the landing copy and the contrast values are the two P1 findings
and both live in three files
(`LandingFaq.vue`, `LandingWaveSection.vue`, `LandingCta.vue`). Doing them first
means those files are edited once, not twice, because two of them also carry em
dashes and three carry arrows. The em dash sweep is repo-wide and mechanical, so
it comes after the judgement work. Decoration removal touches the same landing
files for a third time and last, so a failure there cannot mask a copy or
contrast regression.

**Constraint on the em dash sweep**: `LandingWaveSection.vue` and
`LandingHero.vue` already use en dashes and are on the audit's clean list. They
must not be rewritten by the sweep, only the specific em dash sites edited, or a
mechanical pass risks normalizing a file that was already correct.

## R10. Scope worth stating rather than hiding

- **No dark theme exists.** All seven apps declare one theme in `src/style.css`
  with no `.dark` block, and `themeToggleRefs=0` across all seven. Audit R-21
  and R-34 are therefore not addressed by this feature and are recorded as out
  of scope, not silently skipped.
- **No automated guard is added** against a future em dash. A lint rule (for
  example a `no-irregular-whitespace`-style custom rule or a regex check in
  `validate`) would prevent the 105th occurrence, and the repo has none. This is
  noted as a follow-up decision for the owner, not implemented here, because the
  spec's scope is the audit findings.
- **An i18n layer exists and does not cover these strings.** `admission-web`
  installs `vue-i18n` 11 and wires it in `src/app/main.ts:12,32`, with
  `src/i18n/locales/en.ts` and `id.ts`. The catalogue holds only `menu.*` keys
  (19 lines each, 0 em dashes), so every string this feature edits is a hardcoded
  literal in a component, not a translation key. The em dash work therefore edits
  the components, not the catalogues. Worth knowing for a future feature: if the
  landing copy is ever localized, FR-001 to FR-004 move into the catalogue and
  this edit would have to follow. The scan covered `src/**/*.ts`, so the locale
  files are already confirmed clean.

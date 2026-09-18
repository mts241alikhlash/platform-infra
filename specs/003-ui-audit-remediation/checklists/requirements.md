# Specification Quality Checklist: UI Audit Remediation

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-15
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Validation iterations

**Iteration 1.** The spec was written from `anti-slop/audit-002-2026-09-15.md`
and the owner's decisions of 2026-09-15 (all eight findings, new feature folder,
fix the token in all seven apps, remove the decoration, remove the arrows, owner
supplies the direction, correct all 104 em dashes).

Two facts changed the spec's shape after the audit was written, both found by
measurement rather than assumption:

1. **The audit undercounted finding 2 by a factor of twenty.** It named five em
   dashes in `admission-web`. A repo-wide scan of the seven apps found 104
   occurrences in 65 files, 87 of them user-visible. The owner widened the scope
   to all 104. FR-009 to FR-015 record the widened scope, and `research.md` R3
   records the four replacement classes.
2. **The audit's likely fix for finding 4 would have missed the background bar.**
   The first candidate value, `oklch(0.65 ...)`, passes against the card at 3.24:1
   but clears the background comparison by only 0.10. FR-006 pins
   `oklch(0.64 ...)` at 3.37:1 and 3.23:1, and records the rejected value so the
   decision is visible.

Three claims were checked against code rather than carried over from the audit,
and two of them were wrong as first written:

- The audit's list of five em dash sites in `admission-web` was correct as far as
  it went. The claim that no other app was affected was never made by the audit
  and is false.
- The first draft of `research.md` R10 stated that no i18n layer exists. That is
  false: `admission-web` installs `vue-i18n` 11 and wires it in
  `src/app/main.ts:12,32`. The catalogue holds only `menu.*` keys, so none of the
  edited strings is a translation key, but the claim was corrected rather than
  left standing.
- The first draft of `plan.md` said the em dash work spans 85 files, 74 of them
  user-visible. The measured figures are 65 files and 59. Corrected.

### Scope decisions recorded rather than hidden

- **No dark theme exists in any of the seven apps.** One theme is declared per
  `src/style.css`, no `.dark` block exists anywhere, and no theme toggle exists
  (`themeToggleRefs=0` across all seven). Audit R-21 and R-34 are out of scope,
  stated in the spec's Context section and `research.md` R10.
- **Finding 4 changes one token with two roles.** `--input` colors five control
  boundaries and the unchecked switch fill. The switch change is accepted and
  recorded in `research.md` R1 and `contracts/control-edge-token.md`, so it is not
  discovered later as a surprise.
- **`--border` is deliberately not touched**, because it is applied globally and
  would restyle every non-control surface. FR-007 and contract invariant 3.
- **An automated em dash guard is not added.** The repo has no lint rule against
  the character, so a future occurrence is possible. Noted as a follow-up for the
  owner in `research.md` R10, not implemented, because the spec's scope is the
  audit findings.
- **FR-019 stays open** until the owner supplies the direction. A placeholder
  `DESIGN.md` would satisfy the check and defeat its purpose, so no task writes
  one.

### Verification not yet performed

Nothing in this feature has been implemented. All contrast figures come from
`%TEMP%\opencode\contrast{2,3,4,5}_plan.py`, which convert oklch to sRGB and then
compute WCAG relative luminance. The browser-measured values are expected to
agree; S5 and S6 in `quickstart.md` require confirming that in a running browser
rather than trusting the scripts alone.

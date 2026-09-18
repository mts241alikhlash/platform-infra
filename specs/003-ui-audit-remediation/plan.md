# Implementation Plan: UI Audit Remediation

**Branch**: `003-ui-audit-remediation` (nominal; this workspace has no git) | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ui-audit-remediation/spec.md`

**Source of work**: `anti-slop/audit-002-2026-09-15.md`, findings 1 to 8, plus a
repo-wide em dash scan run while specifying (which widened finding 2 from 5
occurrences to 104).

## Summary

Eight audit findings, four of them Hard Gate failures, are remediated in this
order: the landing copy that misdescribes the shipped product, two text contrast
failures and one non-text contrast failure, 104 em dash occurrences across seven
apps, and the removal of unreasoned decoration plus a written-down design
direction. One finding (5) needs no code change beyond closing the two gaps it
honestly named.

The work is almost entirely presentation. There is no schema change, no
migration, no API contract change, no use case, and no repository. Two files
change in all seven web apps (`--input` in `src/style.css`, and
`ServiceUnavailable.vue`), and two more are shared across apps
(`useReferenceList.ts` in seven, `DashboardView.vue` in three), so the
constitution's "make the change in all of them, in the same session" rule
governs a large part of the task list.

## Technical Context

**Language/Version**: TypeScript 5.x, Vue 3.5 SFCs, Tailwind CSS v4

**Primary Dependencies**: Vue 3.5, Vue Router, Pinia, vee-validate + zod,
reka-ui, `@/ui` in-repo component package, lucide-vue-next (icons)

**Storage**: N/A for this feature. No schema, no migration, no query.

**Testing**: Vitest. `pnpm validate` per app runs
`format:check + lint + typecheck + lint:strict + test + build`. Baseline counts
measured before this feature: `admission-web` 15 files / 93 tests. Other apps are
not feature-002 touched but are touched by the em dash and token work, so their
baselines must be captured at the start of Phase 1 rather than assumed.

**Target Platform**: Browser. Seven apps are affected:
`academic-web`, `admin-web`, `admission-web`, `assessment-web`, `hr-web`,
`inventory-web`, `portal-web`.

**Project Type**: Web frontend, seven sibling repositories, no shared build.
`packages/ui`, `packages/platform`, `packages/shared` are copied into each app,
not linked. There is no sync tooling.

**Performance Goals**: Not applicable. The only runtime cost is removing markup.

**Constraints**: Presentation-only changes. Contrast values must land at the
measured targets, not near them. `--border` must not move, so non-control
surfaces are untouched. Em dash removal must not change layout or spacing.

**Scale/Scope**: 7 apps, 4 files that exist in more than one app, 104 em dash
occurrences in 65 distinct files (87 user-visible across 59 files, plus 10 test
and 7 comment occurrences), 1 token value, 9 decorative markup removals, 1 new
root document.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
| --- | --- | --- |
| I. Layered Dependency Flow | N/A | No service code, no use case, no repository. |
| II. Service Boundaries | PASS WITH ACTION | `ServiceUnavailable.vue` and `useReferenceList.ts` are copies, not imports; the constitution accepts duplicated code across repositories but names a drifted copy a bug. All copies move in the same session. |
| III. Scoped and Authorized Data Access | N/A | No query, no permission surface. |
| IV. Explicit Contracts | N/A | No API, no DTO. The design token is the only interface, and it is one-way: `--input` to `border-input`. |
| V. Green Quality Gates | PASS WITH ACTION | Zero new use cases, so no `*.spec.ts` requirement applies. `pnpm validate` must pass in every app touched. The file budget is not threatened: the largest file edited is `ApplicationDetailView.vue` at 560 lines, and it loses a character rather than gaining code. |
| VI. Data Ownership and Transactions | N/A | No writes. |
| VII. Schema Ownership and Migration Safety | N/A | No schema, no migration. No Prisma. |
| VIII. Cross-Service Failure Is Explicit | N/A | No service call. |
| Workflow: change a file present in several repositories in all of them, same session | **PASS WITH ACTION** | This is the governing rule for this feature. Four files exist in more than one app. Task list enumerates every copy explicitly. |
| Zero comments in business code | PASS | Rule R-02 forbids the character in the 7 code comments found. They are edited or left by owner decision, never added. |

No violations require the Complexity Tracking table. The gate passes with the
action items above folded into Phase 1 and Phase 2.

## Design Direction (antislop R-37)

Decision, recorded 2026-09-15: **`DESIGN.md` is agent-authored at the owner's
request, and says so.** The owner first chose to supply the direction, then asked
the agent to author it using best practice (2026-09-15, same day). The file
therefore opens by stating its own provenance, because agent-authored direction
tends toward the generic taste antislop exists to filter.

- Design Read: *the admission landing page and its sibling apps, for parents and
  school staff, in the existing shipped design-system language, dial ENERGY 1 /
  RHYTHM 1 / MOTION 1.* Unchanged from feature 002.
- `DESIGN.md` (FR-019, FR-020) exists at the workspace root. Its palette and
  typography are measured from the shipped `src/style.css` in all seven apps, not
  invented; its identity, personality, and mood claims are the agent's reading of
  what the seven apps already do, and are marked revisable.
- Reason written one line: the shipped direction is a fact about the build, so
  recording it beats inventing one, and stating who wrote it beats implying the
  owner did.
- This feature removes decoration rather than justifying it (FR-016, FR-017,
  FR-018), because the owner chose removal over a written reason for four orbs,
  one glass badge, and five arrows. Removal is the honest answer when the only
  available reason is "it looked good".

### Post-Design Re-evaluation

After Phase 1 the gate still passes. Design added no new surface: the token
change is a value edit, the em dash work is character replacement, and the
decoration work is deletion. The one design decision with a user-visible
consequence is FR-007 keeping `--border` still, which confines the appearance
change to control edges.

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-audit-remediation/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: measured values and decided replacements
├── data-model.md        # Phase 1: the four artifacts this feature edits
├── quickstart.md        # Phase 1: validation scenarios
├── contracts/
│   ├── control-edge-token.md    # the one token contract
│   ├── em-dash-replacement.md   # replacement rules by occurrence class
│   └── design-direction.md      # what DESIGN.md must contain, owner-supplied
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code

Seven sibling apps, each with the same internal shape. Paths are relative to
each app root.

```text
<app>/
├── src/
│   ├── style.css                      # the token, one per app (7 copies, all differ)
│   ├── features/                      # per-app feature code, where most em dashes live
│   └── app/                           # router, main, providers
└── packages/
    ├── ui/src/components/
    │   ├── ServiceUnavailable.vue     # identical bytes in all 7 apps
    │   └── ui/                        # Input, Textarea, Select, Checkbox, Switch, ...
    ├── platform/src/features/
    │   ├── reference-data/composables/useReferenceList.ts   # identical in all 7
    │   ├── dashboard/views/DashboardView.vue                # identical in 3
    │   └── profile/types/school-identity.ts                 # identical in all 7 (comment only)
    └── shared/src/
```

**Structure Decision**: No new source files. Two files are created in the
workspace: `DESIGN.md` at the root (FR-019) and this spec folder. Everything else
is an edit to an existing file. Because `packages/*` is copied rather than
linked, every shared edit is repeated per app by hand, and the task list names
each copy.

## The Eight Findings, Mapped

| # | Tier | What | Where | Requirement |
| --- | --- | --- | --- | --- |
| 1 | HIGH | Landing copy promises a wave choice the product removed | `admission-web` landing, 3 strings | FR-001 to FR-004 |
| 2 | HIGH | Em dash in UI text | 104 occurrences, 7 apps (audit knew 5) | FR-009 to FR-015 |
| 3 | HIGH | CTA text below AA at 3.87:1 and 4.15:1 | `LandingCta.vue:21,27` | FR-005 |
| 4 | MEDIUM | Control edge at 1.24:1 against card | `--input` in 7 `style.css` | FR-006 to FR-008 |
| 5 | MEDIUM | Verification evidence and its two gaps | no code change; record | FR-021, FR-022 |
| 6 | MEDIUM | Four orbs and one glass badge, no reason | `LandingHero`, `LandingCta` | FR-016, FR-017 |
| 7 | LOW | Arrow on five CTAs, no reason | 3 landing files | FR-018 |
| 8 | LOW | No `DESIGN.md` | workspace root | FR-019, FR-020 |

## Complexity Tracking

Not required. The Constitution Check reports no unjustified violation.

# Future Feature Plans

The character journal shipped as beta in acd760c. Its plans stay here as history.

The files under `.agent/plans/` are living implementation documents for future work that has not shipped yet. Shipped features are listed in `.agent/FEATURES.md`. The human runbook is `README.md`. D&D Beyond's sheet structure lives in `docs/ddb-reference/`.

Completed work should move to `.agent/FEATURES.md` and the corresponding implementation plan should be removed.

Create an ExecPlan under `.agent/plans/` for:

- a planned feature that has not shipped yet,
- storage migrations,
- D&D Beyond endpoint or DOM integration changes,
- permission changes,
- significant refactors.

A useful ExecPlan must be understandable by a developer who has only the repository and the plan file.

## Required sections

```markdown
# Title

## Goal
What user-visible result will exist when this plan is complete?

## Scope
What is included and explicitly excluded?

## Current state
What exists before this work begins?

## External assumptions
Which browser, D&D Beyond, or API behaviors are relied upon, and how will they be verified?

## Approach
Describe the design and important data flow.

## Milestones
Use a checklist of independently verifiable increments.

## Validation
List automated checks and manual browser tests.

## Risks and rollback
What can fail, how is user data protected, and how can the change be reverted?

## Progress log
Add dated notes as work proceeds.

## Decision log
Record decisions made during implementation and why.
```

Keep future-feature plans current. Check off completed milestones, record discoveries, and adjust the approach when live-site evidence contradicts the original design.

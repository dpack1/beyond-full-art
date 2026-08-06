# Execution Plans

An ExecPlan is a living implementation document for work that spans multiple modules, includes external research, or carries meaningful risk.

Create an ExecPlan under `.agent/plans/` for:

- a new product phase,
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

Keep the plan current. Check off completed milestones, record discoveries, and adjust the approach when live-site evidence contradicts the original design.

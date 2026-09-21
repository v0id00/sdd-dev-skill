---
name: sdd-apply
description: "Use when an approved spec needs implementing. Implements in spec order with AC traceability, refuses Draft specs, reports real command evidence."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: author
---

# Implement an approved spec

## When to use

- A spec is `Approved` and someone asked for the behavior to exist in code.
- A plan (`specs/plans/NNNN-slug.plan.md`) was accepted and implementation should start.
- An `Implemented` spec has an approved amendment that adds or changes behavior.
- Resuming partially-finished work on an approved spec.
- Do NOT load this for a `Draft` spec — route to `sdd-interview` (unfinished) or `sdd-review` (needs a decision) instead.

## Inputs

- The target spec `specs/NNNN-slug.md`, read in full.
- Its `- **Status:**` line: must be `Approved`, or `Implemented` with an approved amendment.
- Its `## References` and, if present, the subordinate plan `specs/plans/NNNN-slug.plan.md`.
- The project's real verification command (test runner, build, linter) as the repo defines it.

## Procedure

1. Locate the spec and read its status. Fail closed: proceed only on `Approved`, or `Implemented` with an approved amendment. `Draft`, `Rejected`, `Superseded`, or a missing status line means stop and say so — offer `sdd-interview` or `sdd-review`.
2. Read the spec end to end, then its `## References`, then its plan file if one exists. The plan is subordinate: if the plan and the spec disagree, the spec wins and you say which line conflicted.
3. Restate the `## Acceptance Criteria` list as your working checklist. If a needed behavior is not in the spec, stop — that is a spec change (`sdd-update`), not an implementation decision.
4. Implement in dependency order, smallest diff that satisfies the ACs. Where the project has tests, write the failing test first.
5. Work AC by AC. After each, run the project's real verification command and capture the output verbatim.
6. When the spec is silent on an edge case, choose the conservative default — feature off, behavior unchanged, explicit error over silent success — then raise it as a spec amendment request instead of burying it in a code comment.
7. Leave AC checkboxes unticked until `sdd-verify` proves them. If you tick one yourself, its evidence must be in the transcript.
8. Report what changed, which ACs are covered, what is left, and the follow-up `sdd-update` items. Ask before committing anything.

## Outputs

- Code and tests satisfying the spec's ACs, in the smallest coherent diff.
- `specs/plans/NNNN-slug.plan.md` updated as tasks complete, if a plan exists.
- A short report: files changed, AC coverage, remaining work, `sdd-update` follow-ups.

## Guardrails

- Never write code for a `Draft` spec.
- Never self-approve; only the user moves a spec from `Draft` to `Approved`.
- Never widen scope beyond the spec's `## Behavior` and its ACs.
- Never bypass, skip, or weaken a failing test to make progress look green.
- Never fabricate command output — an unverifiable claim is reported as unverified, not as done.
- No commit, push, or destructive git action without asking.

## Verify

- Every AC claimed as done maps to real command output you produced in this session.
- If you edited the spec, `- **Updated:**` is today's date, then run `sdd lint` and `sdd index`.
- `sdd stats` still shows the spec as `Approved` (or the amended status) until `sdd-verify` flips it.
- No AC checkbox was ticked without matching evidence in the transcript.

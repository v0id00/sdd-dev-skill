---
name: sdd-plan
description: "Use when an Approved spec needs a task breakdown. Writes a plan file whose every task cites the acceptance criteria it satisfies, and refuses to plan a Draft spec."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: author
---

# Turn an approved spec into an executable plan

Produce the task breakdown for one `Approved` spec, with every task traced to the ACs it satisfies. The plan is subordinate to the spec: it cites, it never redefines.

## When to use

- A spec just moved to `Approved` and the user asks "what now" or "how do we build this".
- Implementation is about to start and the work must be ordered and sized first.
- A plan exists but does not trace to ACs, or the spec changed under it.
- A migration, feature flag, or contract change needs sequencing before code.
- The user asks for the blast radius and the risky steps of an approved spec.

## Inputs

- `specs/README.md` — rules and format. Read this first; if `specs/` is missing, run the sdd-init skill.
- The spec in full, read last so nothing is lost: status is `Approved` (or `Implemented` with an agreed amendment).
- `specs/INDEX.md` and the specs it references, plus `AGENTS.md` for the project's plan path convention.
- The current implementation wherever the spec names interfaces — read enough to size the work honestly.

## Procedure

1. Verify the status line reads `Approved`, or `Implemented` with an amendment the user agreed to. If it is `Draft`, refuse and point at the sdd-interview and sdd-review skills.
2. Read the spec in full, then the files it names under `## Interfaces`, then skim the current implementation so sizes are honest.
3. Enumerate tasks in dependency order. For each task record: what changes, which files or layers, the AC ids it satisfies, the command that verifies it, and a size (S/M/L). No time estimates.
4. Add the sequencing risks: migrations and their rollback, contract and interface changes, feature flags (default OFF for a half-finished capability), tests to write first, and anything that must ship before or after something else.
5. Write the plan at `specs/plans/NNNN-slug.plan.md` with `authority: spec NNNN` as an explicit line at the top. Use `AGENTS.md`'s configured plan path instead when it names one. Never write the plan flat next to the spec as `specs/NNNN-slug.plan.md`: the `sdd` linter reads every `NNNN-*.md` directly inside `specs/` as a spec and reports the plan as `duplicate-id` (error) plus `section-expected` and `updated-missing` warnings. Subdirectories of `specs/` are not scanned, which is why `specs/plans/` is safe.
6. In the plan, cite the spec's contract rather than copying it: reference `spec NNNN` for every table, signature, and status definition.
7. Confirm the plan with the user in one round of at most 5 decisions covering only the sequencing choices that actually matter (flag strategy, migration order, shippable slices, test-first scope).
8. Build a task/AC coverage table and look for holes: any AC that no task satisfies is a hole in the plan and must be fixed before you finish.
9. Hand off the plan; do not begin implementing in this skill.

## Outputs

- `specs/plans/NNNN-slug.plan.md` (or the project's configured plan path) with `authority: spec NNNN` at the top.
- A task list in dependency order, each task carrying its AC ids, verification command, and S/M/L size.
- A task/AC coverage table, with every AC mapped to at least one task.
- The sequencing risks and flags, and the open sequencing decisions the user resolved.

## Guardrails

- Never plan a `Draft` spec; no code and no plan for unapproved work.
- Never duplicate the spec's contract text into the plan — cite the spec id instead. One contract, one file.
- Never add scope the spec does not contain. New scope means a new spec or an agreed amendment of the existing one — ask first.
- Never write a Status value into the plan; the spec owns status.
- Never write time estimates, only sizes and dependencies.
- Do not implement, commit code, or flip any status in this skill.

## Verify

- Every AC id in the spec appears in the coverage table; report any AC with no task, or state that none is missing.
- Walk the dependency order once: no task uses an artifact a later task creates.
- Each task's verification command must be runnable as written, and must produce output that can prove the AC later.
- Re-read the plan against the spec: names, defaults, and paths must match the spec exactly, with no second copy of a contract.
- Run `sdd lint --verbose`: 0 errors. If the plan had to live inside `specs/`, report the `duplicate-id` or `stray-file` warning it causes, name the plans path that would remove it, and confirm `specs/INDEX.md` still lists only real specs.

---
name: sdd-update
description: "Use when an approved or implemented spec must change. Classifies the request, edits the spec first, cascades the change across the repo, and only then allows code."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: author
---

# Change a spec without forking the truth

Handle a change request against an existing spec — usually `Approved` or `Implemented`. Order is fixed: spec edit first, cascade second, code third.

## When to use

- The user says "actually, it should do X instead" about behavior a spec already owns.
- A field, default, command, or endpoint named in a spec is being renamed or removed.
- A plan, `AGENTS.md`, or a doc contradicts the spec it is supposed to cite.
- Implementation drifted from an `Approved` spec and someone wants to codify the drift.
- The change is a clarification with no behavior impact but the spec text is now stale.

## Inputs

- `specs/README.md` — rules and format. Read this first; if `specs/` is missing, run the sdd-init skill.
- The spec being changed, read in full, plus every spec it references and every spec that references it.
- `specs/INDEX.md`, `AGENTS.md`, `CLAUDE.md`, `TODO.md`, and any plan file that cites the spec.
- The current implementation, to size the real blast radius.

## Procedure

1. Classify the request before editing: **clarification** (no behavior change), **behavior change** (existing spec changes), or **new capability** (needs its own spec). Say which class you chose and why.
2. Clarification: edit in place, bump `- **Updated:**`, append a Decision Log row. Continue with step 6.
3. Behavior change on an `Implemented` spec: ask the user whether the spec returns to `Draft`/`Approved` for re-approval or stays `Approved` with a scoped amendment. Ask — never assume. An `Approved` spec is frozen: any behavior edit re-opens approval.
4. New capability: create it with `sdd new "<title>"`, then link both ways — `Supersedes:` on the new spec, `Superseded by:` on the old one. Do not bloat the existing spec with a second contract.
5. Apply the edit, including the Acceptance Criteria that changed. Retired ACs are struck through or renumbered and keep their id history; they are never silently dropped.
6. **Cascade**: search the repo, the other specs, `AGENTS.md`/`CLAUDE.md`, `TODO.md`, and every plan or template for the identifiers and phrases this change invalidates — the old field name, the old default, the old command, the old status word. Fix each hit, or replace it with a citation of the spec that now owns the contract.
7. A companion plan that now disagrees does not get rewritten silently: add a `SPEC OVERRIDE` note citing the owning spec id and the date, and tell the user the plan is stale.
8. Bump `- **Updated:**` and append a Decision Log row with the date and the why, not just the what.
9. Run `sdd lint --verbose`, then `sdd index`, then `sdd stats --json`. Report the blast radius you actually changed, file by file.

## Outputs

- The edited spec, with updated ACs, `Updated` date, and a Decision Log row.
- Cascade fixes across the other specs, docs, and config-creating files, or explicit citations replacing duplicated contract text.
- For new capabilities: a scaffolded `specs/NNNN-slug.md` with both supersession links present.
- `SPEC OVERRIDE` notes on any plan that now disagrees with the spec.
- Lint, index, and stats output after the change.

## Guardrails

- Never edit code before the spec edit lands. Spec first, in the same commit.
- Never leave a stale plan or doc contradicting the spec; fix it or flag it, in writing, in this run.
- Never reuse or renumber an existing spec id. New work takes the next free number.
- Never delete a spec, an AC, or a Decision Log row.
- Never change Status to `Approved` or `Rejected` — those are user decisions.
- If the change contradicts an approved spec elsewhere, stop and surface the contradiction instead of picking a side.
- One contract, one file: cite the owning spec, never copy its table or signature into another document.

## Verify

- Run `sdd lint --verbose`: 0 errors, and no `cascade-leak` or `broken-ref` warnings left unexplained.
- Run `sdd index` and read the touched row: title, status, AC counts, and `Updated` match your edit.
- Run `sdd stats --json` and confirm the AC totals moved exactly as the edited criteria imply.
- Search once more for the old identifier; every remaining hit must be intentional (history, a superseded spec, or a `SPEC OVERRIDE` note).
- State which code is now required, and which spec id authorizes it, before anyone touches the implementation.

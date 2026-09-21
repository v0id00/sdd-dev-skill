---
name: sdd-verify
description: "Use when acceptance criteria need proof before closing a spec. Runs the real verification per AC, ticks only what passed, moves Approved to Implemented."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: review
---

# Prove acceptance criteria and close the spec

## When to use

- Implementation of an `Approved` spec is finished and its ACs must be proven.
- Someone claims "it works" and you need real output instead of a promise.
- A spec is `Implemented` but a reviewer questions the evidence.
- CI needs a deterministic, reproducible pass/fail over the AC checkboxes.
- Immediately before flipping a spec to `Implemented`.

## Inputs

- The spec `specs/NNNN-slug.md` with its `## Acceptance Criteria` list.
- A runnable proof for each AC: a test, a command, an endpoint, or an observable file/behavior.
- The project's real verification command(s).

## Procedure

1. Read the spec and list every AC in order, by its `ACn` id.
2. Map each AC to a concrete proof — the test to run, the command to execute, the endpoint to call, the file/behavior to observe. If an AC cannot be mapped, mark it untestable and name the exact spec line that blocked closure.
3. Run the proofs for real. Capture the exact command and the relevant output lines.
4. Tick only the ACs whose evidence you actually produced: `- [ ] AC1:` becomes `- [x] AC1:`.
5. For any failing or unprovable AC: leave it unticked, record the actual output, and keep the spec `Approved` (revert it if it was already flipped). Never soften the AC text to make it pass.
6. Optionally append a verification log block to the spec, or write `specs/NNNN-slug.verify.md`, containing the command and raw output excerpts — never a summary of what you believe happened.
7. When every AC is ticked and proven: change `- **Status:** Approved` to `Implemented`, bump `- **Updated:**` to today, add a Decision Log row, then run `sdd lint --verbose` (expect 0 errors, especially `implemented-unchecked`) and `sdd index`.
8. Report the evidence table and the `sdd stats` counts.

## Outputs

- The spec with proven ACs ticked and, if all pass, `Status: Implemented`.
- An evidence table: AC id, the command run, the observed result.
- `specs/INDEX.md` regenerated; `sdd stats` counts for the report.

## Guardrails

- Fabricated or paraphrased evidence is banned — quote real output or state plainly that it was not verified.
- Never tick an AC to satisfy the status machine.
- Never move a spec to `Implemented` with an untested AC; `sdd lint` flags it as `implemented-unchecked`.
- A spec whose work was replaced closes as `Superseded` (with a `Superseded by:` link), never as a quiet deletion.
- Never self-approve — you do not move a spec into `Approved`.

## Verify

- `sdd lint --verbose` exits 0 with no `implemented-unchecked` error.
- `sdd index` reports `INDEX.md` up to date after any edit.
- `sdd stats` reflects the new `Implemented` count.
- If you edited the spec, `- **Updated:**` holds today's date and the Decision Log has the closure row.

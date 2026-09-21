# AGENTS.md

This repository is **spec-driven**: `specs/` is the source of truth, and code follows specs.

## Read first

1. `specs/README.md` — the rules and the exact spec format. Non-negotiable.
2. `specs/INDEX.md` — the spec index with statuses.
3. The individual spec you are about to touch.

## Hard rules

- **No code for a `Draft` spec.** Implementation starts only after a spec is `Approved`.
- **Spec first.** Behavior change = spec change first, in the same commit.
- **Never self-approve.** `Draft → Approved` and `Rejected` are user decisions. Ask, do not assume.
- **Acceptance criteria are checkboxes and they must be proven.** Attach real command/test output; fabricated evidence is a lie and is banned.
- **Never delete a spec.** Retirement is `Status: Superseded` plus a `Superseded by:` link.
- **One contract, one file.** Do not copy a table or signature out of a spec into a plan; cite the spec instead.

## Tools

| Command | Purpose |
|---|---|
| `sdd stats` | Status counts, stale specs |
| `sdd lint` | Format, duplicate ids, broken links, cascade leaks |
| `sdd index` | Regenerate `specs/INDEX.md` |
| `sdd new "Title"` | Scaffold the next spec from the template |

## Workflow

`discover → draft → review (questions, rounds of ≤5) → user approves → plan → implement → verify ACs → Implemented`

## Conventions

- Spec/doc language: English (change this line if the project decides otherwise).
- Spec ids: `NNNN-slug.md`, zero-padded, sequential, never reused.
- Commits that implement a spec: reference the id, e.g. `spec 0007: add retry budget`.

## Verification

Evidence before claims. Run the command, read the output, paste the relevant lines. "Should work" is not evidence.

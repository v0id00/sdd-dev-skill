---
name: sdd-status
description: "Use when the caller needs spec counts, AC progress, or stalled work. Runs sdd stats/lint/index and reports the next actionable item, human or --json."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: track
---

# Report spec state and the stalled work

## When to use

- "Where are we?" — counts by status and acceptance-criteria progress.
- Before a planning session or standup, to see what is waiting on whom.
- To find stalled work: `Draft` specs untouched beyond the stale window, or `Approved` specs running cold.
- A script, bot, or CI job needs machine-readable state.
- After a batch of spec edits, to check whether `INDEX.md` is still truthful.
- This skill reports only; it never edits specs.

## Inputs

- The project's `specs/` directory.
- The caller's output preference: human table or `--json`.

## Procedure

1. Run `sdd stats` for the human table, or `sdd stats --json` when the caller needs machine-readable output (piping into `jq`, a report file, a commit message).
2. Explain the numbers:
   - Waiting on the user: `Draft` specs awaiting approval, `Rejected` specs and whether their reason is recorded.
   - Waiting on an agent: `Approved` specs with no implementation begun.
   - Stalled: `Draft` specs past `--stale-days` (default 14). `sdd stats` reports stale drafts only; approved-spec staleness (`--stale-approved-days`, default 60) surfaces as a `sdd lint` warning.
3. Run `sdd lint` and summarise only the findings that change what someone does next.
4. Run `sdd index` to keep `specs/INDEX.md` truthful, and report whether it changed.
5. Present, in this order: counts table, AC progress, top 3 actionable items each with its exact next command, then stale/orphaned work.
6. When the caller wants a file report or a commit message, build it from `--json` (`sdd stats --json`, `sdd lint --json`) rather than re-parsing the human output.
7. Exit-code awareness: `sdd stats` and `sdd lint` return 1 when there are errors, so in CI or scripts use `--json` and inspect `.errors` / `.ok` instead of trusting the shell.

## Outputs

- A counts table, AC progress, top 3 actions, and the stale list.
- `specs/INDEX.md` regenerated when it had drifted.
- Optional `--json` payloads for automation.

Human output shape (`sdd stats`):

```
specs in /repo/specs  6 total
  Draft           2  ██
  Approved        1  █
  Implemented     2  ██
  Rejected        1  █
  Superseded      0
  ACs           9/14  64% proven

stale drafts (older than 14 days):
  0003 specs/0003-export-csv.md — 21d

0 errors · 1 warnings (sdd lint for detail)
```

Key `sdd stats --json` fields:

- `specsDir` — absolute `specs/` path.
- `total` — spec count.
- `counts` — `{ Draft, Approved, Implemented, Rejected, Superseded }`.
- `acceptanceCriteria` — `{ total, done }` across all specs.
- `errors` / `warnings` — issue counts (errors drive exit code 1).
- `stale` — `[{ id, file, age }]` for stale drafts.
- `specs` — `[{ id, file, title, status, owner, updated, acs }]` where `acs` is `"done/total"`.

## Guardrails

- The CLI is the source of the numbers — never hand-count specs by eye.
- Never present a status you did not read from the CLI or the spec files.
- Never edit specs here; `sdd-update` and `sdd-review` make changes, `sdd-lint` fixes format breaks.
- Do not describe warnings as failures; state severity exactly as the CLI assigns it.

## Verify

- The counts table matches `sdd stats --json` (`.total`, `.counts`, `.acceptanceCriteria`).
- Each actionable item cites a real next command (`sdd lint --verbose`, `sdd-review`, `sdd-update`).
- `sdd index` reported no change, or its change matches what you reported.

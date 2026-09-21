---
name: sdd-lint
description: "Use when specs need a format and cascade check. Runs sdd lint, splits errors from warnings, fixes findings and regenerates INDEX.md."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: track
---

# Check the specs for format breaks and cascade leaks

## When to use

- Before closing a spec, or before proposing a commit or pull request.
- After bulk spec edits, renames, or status flips.
- CI needs a hard gate on spec hygiene.
- A reference may dangle after a spec was superseded or renamed.
- `specs/INDEX.md` may be stale or missing.

## Inputs

- The project's `specs/` directory and the spec files inside it.
- Whether the project runs `--strict` in CI.

## Procedure

1. Run `sdd lint --verbose`, which adds the fix hint for each rule. Use `sdd lint --json` when findings must be processed programmatically, and `sdd lint --strict` when warnings must fail the run.
2. Group findings by severity: errors block, warnings need a decision.
3. Fix errors first and report each fix. A broken reference to a deleted or renamed file means the reference is wrong, not the target.
4. For `cascade-leak` warnings, check whether the cited spec was superseded and update the citing spec to point at the replacement. That is a spec edit: bump `- **Updated:**` and add a Decision Log row.
5. For stale drafts, do not silently extend the date. Either continue with `sdd-interview`, ask for approval, or retire the spec with the user's decision.
6. Run `sdd index` after any spec edit.
7. Re-run `sdd lint` until it exits 0; under strict mode, until `sdd lint --strict` exits 0.
8. Cache note: parse results are cached in `.sdd/cache.json`, keyed by file size plus mtime with a 1 hour TTL. Pass `--no-cache` when you suspect a stale reading.

## Outputs

- A findings list grouped by severity, each entry naming file, rule code, and fix.
- Corrected specs and a regenerated `specs/INDEX.md`.
- A clean `sdd lint` run (exit 0), or an explicit statement of what remains blocked and why.

Rule reference, with the severity the CLI assigns:

Errors (block; `sdd lint` exits 1):

- `filename` — file is not `NNNN-slug.md`.
- `heading` — missing `# NNNN — Title` heading.
- `id-mismatch` — heading id differs from the file-name id.
- `status-missing` — no `- **Status:**` line.
- `status-invalid` — status not one of Draft, Approved, Implemented, Rejected, Superseded.
- `rejected-reason` — `Rejected` spec with no `- **Rejected reason:**` line.
- `superseded-link` — `Superseded` spec with no `- **Superseded by:**` link.
- `section-missing` — missing `## Purpose` or `## Acceptance Criteria`.
- `implemented-unchecked` — `Implemented` spec with unticked acceptance criteria.
- `no-acs` — `Approved` spec with no acceptance criteria.
- `duplicate-id` — two specs share the same `NNNN`.
- `broken-ref` — a markdown link target does not exist.
- `missing-target` — `Supersedes` or `Superseded by` names a spec id that does not exist.

Warnings (need a decision; fail only under `--strict`):

- `section-expected` — one of Out of Scope, Behavior, Interfaces, Data Model, Open Questions, Decision Log, References is missing.
- `no-acs` — `Implemented` spec with no acceptance criteria (same code as the error case, warn level here).
- `ac-unnumbered` — acceptance criteria without `ACn` ids.
- `updated-missing` — no `- **Updated:**` line.
- `cascade-leak` — an `Approved` or `Implemented` spec references a `Draft` or `Superseded` spec.
- `stale-draft` — `Draft` untouched beyond `--stale-days` (default 14).
- `stale-approved` — `Approved` untouched beyond `--stale-approved-days` (default 60).
- `index-missing` — `INDEX.md` not generated.
- `index-stale` — `INDEX.md` differs from generated output.
- `stray-file` — markdown in `specs/` that is neither a spec nor README/INDEX.

Exit codes: `0` clean; `1` findings (any error, or any warning under `--strict`); `2` usage error; `3` I/O error.

## Guardrails

- Never silence a finding by deleting the spec, weakening an AC, or hand-editing `specs/INDEX.md` (it is generated).
- Never declare the run clean without re-running the CLI.
- Do not mass-rewrite specs to please the linter: a stale-spec warning is information for the user, not a licence to rewrite history.
- Retire a spec with `Status: Superseded` plus a link, never by deletion.

## Verify

- `sdd lint` (or `sdd lint --strict`) exits 0, or every remaining finding is listed with its rule code and blocker reason.
- `sdd index` reports `INDEX.md` up to date after the edits.
- Every spec you edited carries today's date in `- **Updated:**`.

---
name: sdd-init
description: "Use when a repo lacks specs/ or must be made spec-first before any other SDD work. Bootstraps specs/README.md, INDEX.md, AGENTS.md, CLAUDE.md and TODO.md via sdd init."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: bootstrap
---

# Bootstrap a spec-driven repository

Turn a new or existing repository into a spec-first repository: `specs/` becomes the source of truth and the agent contract (AGENTS.md / CLAUDE.md) points at it.

## When to use

- The repo has no `specs/` directory and needs the spec-first contract installed.
- An existing codebase is being brought under spec-driven development.
- `AGENTS.md`, `CLAUDE.md` or `TODO.md` are missing, or `.sdd/cache.json` is absent from `.gitignore`.
- A partially spec'd repo must have `specs/README.md`, `specs/INDEX.md` restored to the canonical templates.
- The user asks to "set up SDD", "add specs to this repo", or "initialize spec-driven development".

## Inputs

- The repository root (default: current working directory).
- The situation class: empty repo, existing code with no specs, or partially spec'd — determine it by listing the repo root.
- Project build / test / lint / verify commands, read out of `package.json`, `Makefile`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml` or CI config. Never invent them.
- The doc/spec language (default English) and the specs directory name (default `specs`) — confirm both with the user before writing.
- Read `specs/README.md` first when it already exists; it is the authority. When `specs/` does not exist, this skill is the entry point.

## Procedure

1. Inventory the repo root: `specs/`, `specs/README.md`, `specs/INDEX.md`, `AGENTS.md`, `CLAUDE.md`, `TODO.md`, `.gitignore`, and any build manifest.
2. Classify the situation — empty repo, existing code with no specs, or partially spec'd — and state the classification to the user in one line.
3. Confirm the spec/doc language and the specs directory name before writing anything.
4. If `AGENTS.md` or `CLAUDE.md` already exists, run `sdd init --dry-run` and show the user exactly which paths would change. `sdd init` keeps existing `AGENTS.md`/`CLAUDE.md` and rewrites only `specs/README.md` and `specs/INDEX.md`.
5. Run `sdd init [dir]` once the user agrees. Never overwrite an existing `AGENTS.md`/`CLAUDE.md` silently — show the proposed content and get explicit confirmation.
6. Fill the placeholders the templates leave behind: repo layout, build / test / lint / verification commands, spec language. Read those values from the real project files.
7. Do not invent a spec per imagined feature. Either write architecture-level skeleton drafts marked `Status: Draft`, or hand off to sdd-discover (existing behavior) or sdd-spec (new work).
8. Run `sdd lint --verbose`, fix what it reports, then `sdd index` to (re)generate `specs/INDEX.md`.
9. Run `sdd stats` and report the result. Propose the commit; do not commit.

## Outputs

- `specs/README.md` — rules, status lifecycle, exact spec format; the authority every other SDD skill defers to.
- `specs/INDEX.md` — generated index (never hand-edited).
- `AGENTS.md`, `CLAUDE.md` — the agent contract for the repo, placeholders filled.
- `TODO.md` — deferred-work ledger.
- `.sdd/cache.json` appended to `.gitignore`.
- Optionally, skeleton `Draft` specs under `specs/`.

## Guardrails

- Never overwrite an existing `AGENTS.md` or `CLAUDE.md` without showing the change and getting a yes.
- Never invent build/test/lint commands. Read them from the project; an unknown command stays a placeholder the user must fill.
- Do not create a spec per imagined feature — this skill installs the contract, it does not design the system.
- Do not run git commit or git push; propose the command instead.
- If the host tool blocks writing `CLAUDE.md` (protected file), report the block and hand the intended content to the user. Never route around the block.
- No code for a `Draft` spec, and never self-approve: `Draft → Approved` is the user's decision only.

## Verify

- `sdd lint --verbose` exits 0, or reports only issues you can name and explain to the user.
- `sdd index --dry-run` reports `INDEX.md already up to date`.
- `sdd stats --json` resolves the specs directory and prints its counts.
- Inspect the tree: `specs/README.md`, `specs/INDEX.md`, `AGENTS.md`, `CLAUDE.md`, `TODO.md` exist; search `.gitignore` for `.sdd/cache.json`.
- Re-read the filled `AGENTS.md`/`CLAUDE.md` and confirm each build/test/verify command came from a real manifest file.

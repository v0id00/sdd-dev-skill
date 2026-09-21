---
name: sdd-interview
description: "Use when a Draft spec is ambiguous or unapproved. Runs rounds of at most five decisions with a recommendation each, applying answers and cascades before the next round."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: author
---

# Ask the questions that make a spec decidable

Interrogate a `Draft` spec until nothing important is ambiguous. Ask a lot of questions, but structured: rounds of at most 5 decisions, recommendation first, each round applied and cascaded before the next one opens.

## When to use

- A spec exists but its Behavior, Edge cases, or Open Questions still admit more than one reading.
- The user asks to "approve", "start", or "implement" a spec whose Open Questions are unanswered.
- A published default (threshold, timeout, retention, permission, migration path) is assumed but never written down.
- The user approved a spec and later changed their mind about a detail.
- You are about to write code and cannot state, in one line, what the code must do.

## Inputs

- `specs/README.md` — rules and the exact spec format. Read this first; if `specs/` is missing, run the sdd-init skill before anything else.
- The target spec, read in full, plus every spec it references.
- `specs/INDEX.md` for adjacent specs, and `TODO.md` for deferred items.
- `references/interview-round.md`, next to this skill — the exact round format to reuse.
- The current implementation, read only to learn what already exists (never to justify skipping a decision).

## Procedure

1. Read the spec in full together with every spec it references and `specs/README.md`. Do not start asking before you have read them.
2. List every assumption the spec silently makes: defaults, thresholds, storage, error paths, permissions, concurrency, migration, backwards compatibility, observability, cost. Write the list out, even the items you expect the user to shrug at.
3. Group the open decisions into thematic rounds of at most 5 items. Label items A, B, C...; give each 2-4 concrete options; mark exactly one option `— *recommended*` with a one-line reason, using the format of `references/interview-round.md`.
4. Inside each round mark 1-3 decisions as **critical** and demand a definite answer for those: name the item and why it cannot be defaulted (it shapes the data model, a public contract, or the migration path).
5. Tell the user the answering shortcuts: `default` / `öneri` takes the recommendation for that item; `you decide` makes you choose and record the reason in the spec's Decision Log.
6. Wait for the whole round, then apply it in one pass: patch the spec, add the changed Acceptance Criteria, then **cascade** — search the repo and the other specs for the phrases the decision invalidated (the old term, file name, config key, default) and fix or cite each hit.
7. Record every decision in the spec's `## Decision Log` (date, decision, why). Move deferred items to `TODO.md` with one line of context. Bump `- **Updated:**`. Run `sdd lint --verbose` and `sdd index`.
8. Only then open the next round. Never hold two unapplied rounds at once.
9. Repeat until no decidable question remains, then state the residual risks you accepted and hand off to the sdd-review skill.

## Outputs

- A spec whose Open Questions are answered or explicitly deferred, with the blocking ones resolved.
- A filled `## Decision Log` and updated cascade-affected files (other specs, `AGENTS.md`, plans, docs).
- New `TODO.md` entries for everything deferred.
- A clean `sdd lint --verbose` run and a regenerated `specs/INDEX.md`.

## Guardrails

- Never ask more than 5 decisions in one round.
- Never default a critical decision silently — ask, and show why it is critical.
- Never flip Status: `Draft -> Approved` is the user's decision, and an agent never self-approves.
- Never accumulate unapplied rounds; apply round N before asking round N+1.
- If the user answers `you decide`, record the reasoning in the Decision Log — do not choose in silence.
- Never invent an answer to an unanswered blocking Open Question. A spec with one cannot be approved, and you must say which question blocks it.
- No code is written in this skill.

## Verify

- Run `sdd lint --verbose`: expect 0 errors, and no new warnings you did not explain.
- Run `sdd index`: the index must match the new titles and statuses.
- Run `sdd stats --json`: confirm the Draft count and AC totals changed only as the rounds intended.
- Re-read the spec aloud against the original verbal request; every phrase with two readings must now have one.
- If the user did not understand a technical default, explain it in 1-2 plain sentences, apply the safe default, and invite a veto rather than leaving it quiet.

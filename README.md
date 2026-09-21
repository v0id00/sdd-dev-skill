# sdd-dev-skill

A **spec-driven development** skill library for agentic coding tools — Claude Code, opencode, Codex CLI, Hermes, Gemini CLI and Cursor — plus a zero-dependency CLI that keeps the specs honest.

The idea is small and old: **write down what the system should do before an agent writes the code that does it.** What's new here is that the skills enforce it. An agent using these skills will refuse to implement a `Draft` spec, refuses to approve its own draft, refuses to mark a spec `Implemented` without real command output, and never deletes a spec to make a problem go away.

```
you: "add a retry budget to the fetch client"
agent: spec 0007 is Draft — 4 decisions open, all with a recommendation.
       approve after we answer them: A1, B2, C1 …
```

## Install

Requires **Node ≥ 18**. No dependencies, nothing global is touched unless you ask for it.

```bash
# no install: run the CLI straight from git (works before any npm publish)
git clone https://github.com/v0id00/sdd-dev-skill.git
node sdd-dev-skill/bin/sdd.mjs list

# or, once the package is on npm
npx sdd-skills list

# project-local skills (checked into your repo, shared with the team)
npx sdd-skills install --tool claude        # .claude/skills/
npx sdd-skills install --tool opencode      # .opencode/skills/
npx sdd-skills install --tool codex         # .agents/skills/
npx sdd-skills install --tool gemini       # .gemini/extensions/sdd/
npx sdd-skills install --tool cursor       # .agents/skills/ + .cursor/rules/sdd.mdc

# every tool at once, user-level (available in every project)
npx sdd-skills install --all --global

# see the plan before anything is written
npx sdd-skills install --all --dry-run
```

`--global` targets `~/.claude/skills/`, `~/.config/opencode/skills/`, `~/.agents/skills/`, `~/.hermes/skills/spec-driven-development/`, `~/.gemini/extensions/sdd/`; `--project` (default) writes into the current repo. Hermes is global-only — the CLI says so instead of pretending.

Then, in any repo:

```bash
npx sdd-skills init          # specs/, AGENTS.md, CLAUDE.md, TODO.md
npx sdd-skills stats         # dashboard
npx sdd-skills lint          # format + consistency check
```

**Claude Code plugin alternative:**

```bash
/plugin marketplace add v0id00/sdd-dev-skill
/plugin install sdd@sdd-dev-skill
```

Per-tool details, including how to uninstall, are in [docs/install.md](docs/install.md). Which tool's skill format is verified when: [docs/compatibility.md](docs/compatibility.md).

## The skills

Eleven skills, one per step. Agents load only the one they need — that's the point of the format.

| Skill | Role | What it does |
|---|---|---|
| `sdd-init` | bootstrap | Turns a new **or existing** repo spec-first: `specs/README.md` (the rules), `INDEX.md`, `AGENTS.md`, `CLAUDE.md`, `TODO.md`. Never silently overwrites your existing agent files. |
| `sdd-discover` | bootstrap | Reverse-engineers what the code **does today** into `Draft` specs. As-is only — no refactoring, no "this should be better". Ambiguity becomes an Open Question, not an invented rule. |
| `sdd-spec` | author | Turns a request into one complete spec: purpose, out-of-scope, behavior, interfaces, data model, testable acceptance criteria, open questions. |
| `sdd-interview` | author | The interrogation protocol. Rounds of **≤5 decisions**, each with a recommendation first, a one-line reason, and 1–3 flagged as critical. Applies each round's answers *and their cascades* before opening the next. |
| `sdd-review` | review | The gate. Produces a review report (testability, contradictions, blast radius), asks approve / approve-with-changes / keep-draft / reject, and only then flips the status. |
| `sdd-update` | author | Change requests: spec edit first, cascade grep second, code third. A change to an `Approved` spec re-opens approval instead of quietly rewriting history. |
| `sdd-plan` | author | Approved spec → task breakdown, every task traced to the AC ids it satisfies, plan explicitly subordinate to the spec (`authority: spec NNNN`). |
| `sdd-apply` | author | **Fail-closed** implementation gate. Draft, Rejected or status-less spec means no code. Implements AC by AC with the real verification command after each. |
| `sdd-verify` | review | Replaces "should work" with evidence: runs the proofs, pastes real output, ticks only the ACs actually proven, then moves `Approved → Implemented`. |
| `sdd-status` | track | The dashboard: counts by status, AC progress, stale specs, and the next actionable command. Human table or `--json`. |
| `sdd-lint` | track | Interprets the CLI's findings (broken references, duplicate ids, cascade leaks, stale drafts) and fixes them by severity — without rewriting history to please the linter. |

## How it works

`specs/` is the source of truth. `AGENTS.md` / `CLAUDE.md` point the agent at it. Each spec is one file, one concern, with a machine-parsed header:

```markdown
# 0007 — Retry budget

- **Status:** Draft
- **Owner:** unassigned
- **Created:** 2026-09-21
- **Updated:** 2026-09-21

## Purpose          ## Out of Scope     ## Behavior
## Interfaces       ## Data Model       ## Acceptance Criteria
## Open Questions   ## Decision Log     ## References
```

### Status lifecycle

```
Draft ──(user approves)──> Approved ──(ACs proven)──> Implemented
  │                            │
  └──(user rejects)──> Rejected └──(replaced)──> Superseded
```

**Only the user moves a spec into `Approved` or `Rejected`.** An agent moves `Approved → Implemented` after proving the acceptance criteria, and moves a spec to `Superseded` only after its replacement is approved. Nothing is ever deleted.

### The loop

```
init ──> discover (existing code)  ─┐
        or spec (new work)         ─┴─> interview (≤5 decisions / round)
                                        ─> review ─> [ user approves ]
                                        ─> plan ─> apply ─> verify ─> Implemented
                                                    └─> status / lint (any time)
```

Two rules do most of the work:

- **Spec first.** A behavior change is a spec edit *first*, in the same commit. Writing code and updating the spec afterwards is how spec folders die.
- **Evidence, not adjectives.** An acceptance criterion is proven by a command, a test run, or visible behavior — quoted output, not a summary of what the agent believes happened.

Deeper write-up, including the cascade problem (one decision invalidating three other files) and multi-agent notes: [docs/how-it-works.md](docs/how-it-works.md).

## The CLI

`sdd` is what makes the folder mechanical instead of vibes-based. Every command supports `--json`, `--dry-run` and `--verbose`.

| Command | Purpose |
|---|---|
| `sdd install --tool <t> \| --all [--global \| --project] [--link] [--force]` | Install the skills into a tool |
| `sdd init [dir]` | Scaffold `specs/`, `AGENTS.md`, `CLAUDE.md`, `TODO.md` |
| `sdd new "<title>" [--owner NAME]` | Create the next spec (`NNNN-slug.md`, `Status: Draft`) |
| `sdd stats [--specs specs] [--stale-days 14]` | Counts by status, AC progress, stale specs |
| `sdd lint [--strict] [--verbose]` | Format, ids, references, cascade leaks, staleness |
| `sdd index` | Regenerate `specs/INDEX.md` (never hand-edit it) |
| `sdd list` / `sdd doctor` | Bundled skills / validate the install and the skill-list budget |

```bash
$ sdd stats
specs in /repo/specs  12 total
  Draft         4  ████
  Approved      5  █████
  Implemented   2  ██
  Rejected      1  █
  Superseded    0
  ACs         18/31  58% proven
0 errors · 2 warnings (sdd lint for detail)

$ sdd lint --verbose
lint /repo/specs — 12 specs scanned
  ✗ 0007-retry-budget.md [cascade-leak] Approved spec references Superseded spec 0003 (0003-fetch-timeout.md)
      fix: A live spec citing a Draft/Superseded spec is a cascade leak: update or cite the replacement.
```

Exit codes: `0` clean · `1` findings (`lint`; warnings too under `--strict`) · `2` usage · `3` I/O. Parse results are cached in `.sdd/cache.json` (keyed by file mtime + size, 1 hour TTL) — `--no-cache` when you suspect a stale read.

## What ends up in your repo

```
specs/
  README.md      # the rules and the exact format — the authority
  INDEX.md       # generated: id, title, status, ACs, owner, updated
  0001-....md
AGENTS.md        # points every agent at specs/, repeats the hard rules
CLAUDE.md
TODO.md          # deferred items, each with the reason it was deferred
```

## Scope and honesty

- **Verified** (docs read, format checked, installer tested): Claude Code, opencode, Codex CLI, Hermes.
- **Best-effort**: Gemini CLI (skills ship inside an extension — `gemini extensions link` once) and Cursor (its skill discovery is unstable, so the installer also writes a `.cursor/rules/sdd.mdc` pointer and puts skills in the portable `.agents/skills/`).
- The `sdd` CLI is tested against `node --test tests/` — including the refusal paths (`lint` exit codes, global-only installs, dry-runs).
- These skills change *how the agent works*. They don't make a vague request precise — that is what `sdd-interview` is for.

## Development

```bash
npm test                                   # skill format + CLI tests
node bin/sdd.mjs install --tool claude --link   # symlink instead of copy
node bin/sdd.mjs doctor                    # validate the bundled skills
```

Layout: `skills/` (the canonical source, one directory per skill), `bin/sdd.mjs` (the CLI), `templates/` (what `sdd init` drops into a project), `docs/`, `tests/`.

## License

MIT

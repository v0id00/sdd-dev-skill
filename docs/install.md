# Install

Requires **Node ≥ 18**. The CLI has zero dependencies and touches nothing outside the paths you name.

## From npm (published package)

```bash
npx sdd-skills list                                   # no install, just run
npm install -g sdd-skills                             # optional global `sdd`
```

## From a clone (works before/without npm publish)

```bash
git clone https://github.com/v0id00/sdd-dev-skill.git
cd sdd-dev-skill
node bin/sdd.mjs install --all --global --dry-run      # preview
node bin/sdd.mjs install --all --global                # do it
npm link                                               # optional: `sdd` on PATH
```

Everywhere below, `sdd` means either `sdd` (installed) or `node /path/to/sdd-dev-skill/bin/sdd.mjs`.

## Scopes

| Scope | Flag | Meaning |
|---|---|---|
| Project | `--project` (default) | Skills are written into the current repo, so the whole team (and CI agents) get them. Commit them. |
| Global | `--global` | Skills are written into your home directory and load in every project on this machine. |

`--dir <path>` points the project scope at another directory. `--link` symlinks the skill directories back to the library instead of copying, so your edits are live — useful while developing the skills themselves. `--force` overwrites skills that already exist (a plain run **skips** them and tells you).

## Per tool

### Claude Code

```bash
sdd install --tool claude                 # <repo>/.claude/skills/sdd-*/SKILL.md
sdd install --tool claude --global        # ~/.claude/skills/sdd-*/SKILL.md
```

Invoke with `/sdd-init`, `/sdd-spec`, `/sdd-interview`, … or let Claude pick one by description. The directory name becomes the slash command, so the names are already portable (`sdd-<step>`).

Plugin route (no CLI, no files in your repo):

```bash
/plugin marketplace add v0id00/sdd-dev-skill
/plugin install sdd@sdd-dev-skill
```

### opencode

```bash
sdd install --tool opencode               # <repo>/.opencode/skills/
sdd install --tool opencode --global      # ~/.config/opencode/skills/
```

opencode also reads `.claude/skills/` and `.agents/skills/`, so installing for Claude or Codex covers it too. Skill names must match the directory name (they do) and it loads full content on demand. To hide a skill from an agent, use `permission.skill` in `opencode.json`.

### Codex CLI

```bash
sdd install --tool codex                  # <repo>/.agents/skills/
sdd install --tool codex --global         # ~/.agents/skills/
```

Invoke with `$sdd-init` or let Codex match the description. Codex scans `.agents/skills/` from the working directory up to the repo root, and caps the initial skill list at ~2% of the context window (8,000 chars when unknown) — that's why the descriptions in this library are short and trigger-first. `sdd doctor` prints the current budget usage.

### Hermes

```bash
sdd install --tool hermes --global        # ~/.hermes/skills/spec-driven-development/
```

Hermes has no project-local skills directory — project scope is not supported, and `sdd install --project` says so instead of writing somewhere useless. Invoke with `skill_view(name="sdd-init")`.

### Gemini CLI

```bash
sdd install --tool gemini                 # <repo>/.gemini/extensions/sdd/
gemini extensions link <repo>/.gemini/extensions/sdd
```

Gemini CLI bundles skills inside an extension, so the installer writes `gemini-extension.json`, a `GEMINI.md` context file and `skills/sdd-*/SKILL.md`. The `extensions link` command registers the local extension once.

### Cursor

```bash
sdd install --tool cursor                 # <repo>/.agents/skills/ + <repo>/.cursor/rules/sdd.mdc
```

Cursor's skill discovery is unstable across versions, so this is best-effort: the skills go to the portable `.agents/skills/` location and a `.cursor/rules/sdd.mdc` rule (always applied) tells the agent the hard rules and to read `.agents/skills/<name>/SKILL.md` when a trigger matches. The rule alone already enforces the workflow, since it repeats the status model.

## Then, in a project

```bash
cd your-project
sdd init
```

Creates:

```
specs/README.md    the rules and the exact spec format — the authority
specs/INDEX.md     generated index
AGENTS.md          one file every agent reads
CLAUDE.md
TODO.md            deferred items with their reasons
```

`init` never clobbers an existing `AGENTS.md` / `CLAUDE.md` — it reports them as kept. Use `sdd init --dry-run` first if you're unsure, and `--force` on the individual files you actually want replaced.

## Verify the install

```bash
sdd list          # the bundled skills and their triggers
sdd doctor        # frontmatter, name rules, description budget, detected tool installs
sdd install --tool claude --dry-run --json | jq .plan
```

## Uninstall

```bash
rm -rf <repo>/.claude/skills/sdd-*          # or the equivalent path for your tool
rm -rf ~/.claude/skills/sdd-*               # global installs
```

The skills never modify anything on their own; deleting the directories is a complete removal. `specs/` in your repos is yours to keep — that's the point.

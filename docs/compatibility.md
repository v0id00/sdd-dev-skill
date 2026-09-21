# Compatibility

Every skill in this library is a single `SKILL.md` with YAML frontmatter (`name`, `description`, and — where the tool allows it — `license`, `compatibility`, `metadata`). That shape is the **Agent Skills open standard**, which is why one canonical copy serves several tools.

## Matrix

| Tool | Project path | Global path | Frontmatter recognised | Status |
|---|---|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` | `name`, `description`, `license`, plus Claude extensions (`allowed-tools`, `disable-model-invocation`, `model`, …) | **Verified** |
| opencode | `.opencode/skills/<name>/SKILL.md` (also reads `.claude/skills/`, `.agents/skills/`) | `~/.config/opencode/skills/<name>/SKILL.md` | `name`, `description`, `license`, `compatibility`, `metadata` | **Verified** (opencode 1.18.12) |
| Codex CLI | `.agents/skills/<name>/SKILL.md` (scanned from cwd up to repo root) | `~/.agents/skills/<name>/SKILL.md`, `/etc/codex/skills/` | `name`, `description`; optional `agents/openai.yaml` | **Verified** |
| Hermes | — (user-global only) | `~/.hermes/skills/<category>/<name>/SKILL.md` | `name`, `description`, `version`, `license`, `platforms`, `metadata.hermes` | **Verified** (Hermes 0.21.3) |
| Gemini CLI | extension `skills/<name>/SKILL.md` + `gemini-extension.json` | `~/.gemini/extensions/<ext>/skills/<name>/SKILL.md` | extension manifest + skill file | **Best-effort** — requires `gemini extensions link` |
| Cursor | `.agents/skills/` + `.cursor/rules/sdd.mdc` | `~/.agents/skills/` + `~/.cursor/rules/sdd.mdc` | rules frontmatter (`description`, `globs`, `alwaysApply`) for the rule; skill support version-dependent | **Best-effort** |
| Anything else | point it at `.agents/skills/` | — | `name`, `description` | Portable fallback |

"Verified" means the format was read from that tool's own documentation and the installer was exercised against it. "Best-effort" means the layout is the documented one but discovery is not guaranteed on every version — the rule file exists exactly for that case.

## Name rules (portable subset)

The intersection of every tool's rules, which this library obeys:

- lowercase alphanumeric with single-hyphen separators: `^[a-z0-9]+(-[a-z0-9]+)*$`
- 1–64 characters, no leading/trailing hyphen, no `--`
- **the frontmatter `name` must equal the directory name** (opencode enforces this; the others behave better when it holds)
- `description` is 1–1024 characters; keep it short and trigger-first — Codex shortens descriptions first and may drop skills from the initial list when the budget overruns

`sdd doctor` checks all of the above for the bundled skills and prints the Codex skill-list budget (`name` + `description` + path overhead, cap ~8,000 chars for the whole installed set).

## Tool-specific frontmatter we deliberately do NOT use

Claude Code's extensions (`allowed-tools`, `model`, `context`, dynamic `!`cmd`` injection, `$ARGUMENTS`) are powerful and non-portable. Using them would make the skills work in exactly one tool, so this library uses plain markdown bodies and asks the agent to run commands itself. Unknown frontmatter fields are ignored by every tool listed above, so the shared fields are safe to carry everywhere.

## Where skills are loaded from (ambiguity note)

Tools search several locations, and a same-named skill can exist in more than one. Precedence differs per tool (Claude Code: enterprise > personal > project; opencode: first match wins and duplicates across locations are a problem). Practical advice: **install the library once per machine or once per repo, not both**, or you will be debugging which copy answered you.

## Sources

Documentation read while building this library:

- Claude Code — `code.claude.com/docs/en/skills`
- opencode — `opencode.ai/docs/skills/`
- Codex — `developers.openai.com/codex/skills/`
- Gemini CLI — `geminicli.com/docs/extensions/reference/` (Agent skills / extensions)
- Hermes — `hermes-agent.nousresearch.com/docs` and this machine's installed skills layout

Formats move. If a tool changes its layout, the fix is one line in the `TOOLS` table in `bin/sdd.mjs` — the skills themselves are standard markdown.

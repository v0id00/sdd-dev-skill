# CLAUDE.md

See [AGENTS.md](AGENTS.md) for the full contract. The short version:

- `specs/` is the source of truth. Read `specs/README.md` before writing anything.
- No implementation for a `Draft` spec. `Draft → Approved` is the user's call, never yours.
- Spec change comes first; code follows in the same commit.
- Acceptance criteria must be proven with real tool output.
- Retire specs with `Status: Superseded` — never delete one.

## Skills

If the SDD skill library is installed (`sdd install --tool claude`), use:

- `/sdd-init` — bootstrap specs/ in a new or existing repo
- `/sdd-discover` — reverse-engineer current behavior into draft specs
- `/sdd-spec` — author or update one spec
- `/sdd-interview` — structured question rounds before approving
- `/sdd-review` — review and approve/reject
- `/sdd-plan` — approved spec → tasks
- `/sdd-apply` — implement under an approved spec
- `/sdd-verify` — prove ACs, mark Implemented
- `/sdd-status` — counts, stale specs
- `/sdd-lint` — consistency check

## Commands

```bash
sdd lint          # before every commit that touches specs/
sdd index         # after any status or title change
sdd stats         # dashboard
```

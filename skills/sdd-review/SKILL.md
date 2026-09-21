---
name: sdd-review
description: "Use when a Draft spec needs approval, rejection, or retirement. Reviews it against the format and hard rules, then performs only the status flip the user decides."
license: MIT
compatibility: claude-code, opencode, codex, hermes, gemini-cli, cursor
metadata:
  sdd: "0.1.0"
  role: review
---

# Review, approve, reject, retire

You are the gate. Review one spec against the format and the hard rules, present a compact decision summary, and execute the status flip the USER decides.

## When to use

- A `Draft` spec looks finished and the user wants to start implementation.
- The user asks whether a spec is ready, correct, or complete.
- A spec must be rejected, or retired because a newer spec replaced it.
- A batch of Draft specs needs a fast readiness triage before a milestone.
- Another spec or a plan cites a Draft spec and the reference must be resolved.

## Inputs

- `specs/README.md` — rules and format. Read this first; if `specs/` is missing, run the sdd-init skill.
- The spec under review, read in full, plus every spec it references.
- `specs/INDEX.md`, and output of `sdd lint --verbose` and `sdd stats --json`.
- The current code only to judge blast radius — never to justify changing the spec.

## Procedure

1. Read the spec, `specs/README.md`, and every spec it references. Run `sdd lint --verbose` and `sdd stats --json` before forming an opinion.
2. Produce a review report with these rows, in this order: purpose in one line; each AC and whether it is testable and observable; out-of-scope clarity; contradictions with other specs (cite ids); blocking Open Questions; blast radius (which specs, code paths, and files this affects); a recommendation with the reasons behind it.
3. Ask for the decision as a single-select: **Approve** / **Approve with changes** / **Keep as Draft** / **Reject (with reason)**. Wait for the answer in this run.
4. On Approve: flip `- **Status:** Draft` to `Approved` in one mechanical pass across the spec header, then update every index/status reference that points at it, bump `- **Updated:**`, and append a `## Decision Log` row (date, "approved", the user's reason or "no changes requested").
5. On Approve with changes: apply the named changes to the spec, then repeat steps 2-4 on the changed spec. The user's approval must land after the changes, not before.
6. On Reject: set `Rejected` and write the `- **Rejected reason:**` line first, so the reason is never lost. Never delete the file or its content.
7. On Keep as Draft: record what is missing in `## Open Questions` and route to the sdd-interview skill.
8. When a spec replaces an older one, set `Superseded` plus `- **Superseded by:** NNNN` on the old spec and `- **Supersedes:** NNNN` on the new one, in the same pass. Retirement only after the replacement is approved.
9. Re-run `sdd lint --verbose` (expect 0 errors) and `sdd index`, then report the new counts from `sdd stats --json`.

Bulk mode: to review a directory of Draft specs, run steps 1-2 per spec and present one table — id, title, recommendation, blocking issue. Flip statuses only for the specs the user names, or when the user explicitly says "approve all of these listed". Statuses are never flipped in bulk implicitly.

## Outputs

- A review report (one compact table plus a recommendation) for each spec reviewed.
- The status flip the user chose, with an updated header, `Updated` date, and Decision Log row.
- For rejections and retirements: the `Rejected reason:` or `Superseded by:` line, and the paired `Supersedes:` line on the replacement.
- A regenerated `specs/INDEX.md` and the post-change counts from `sdd stats --json`.

## Guardrails

- The agent never approves its own draft. Approval requires an explicit user answer in this run — never an assumption, never "the user probably wants this".
- A spec with unanswered blocking Open Questions, or with untestable ACs, cannot be approved; name the exact line that blocks it.
- Never edit code here. This skill changes specs and their references only.
- Never delete a spec or an AC. Rejected and superseded specs keep their text and their reason.
- Never move `Draft -> Implemented` directly; `Implemented` requires every AC proven with real output.
- Never flip statuses in bulk without an explicit per-spec or explicit all-of-these instruction.

## Verify

- Run `sdd lint --verbose`: 0 errors after the flip; `Rejected` specs must show a reason, `Superseded` specs a `Superseded by:` link.
- Run `sdd index` and read the changed row: status, owner, and `Updated` must match what you wrote.
- Run `sdd stats --json` and confirm the counts moved by exactly the number of specs you flipped.
- Confirm both directions of every supersession pair exist, and that the replacement is `Approved` before the old spec became `Superseded`.
- Report the decision, the reason, and the counts back to the user verbatim.

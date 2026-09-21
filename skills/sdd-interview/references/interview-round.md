# Interview round template

Rounds of **≤5 decisions**. Recommendation first. The user answers a whole round in one compact batch, then you apply the answers *and their cascades* before asking the next round.

## Round N — <topic>

**A. <decision title>**
- A1. <option> — *recommended*
- A2. <option>
- A3. <option>
> <one line on why the recommendation wins>

**B. <decision title>**
- B1. <option> — *recommended*
- B2. <option>

**C. <decision title>**
- C1. <option> — *recommended*
- C2. <option>

### Critical (need a definite answer, they shape everything downstream)
- **B** — <why this one cannot be defaulted>

---

### Answering format (tell the user this)

```
A1, B2, C1, and for the critical one: <your call>
```

Shortcuts: `default` = take the recommendation for that item; `you decide` = the agent decides and records the reasoning in the spec's Decision Log.

### After the answers

1. Patch the spec (and templates/plans that cite it) in one pass.
2. **Cascade**: search for the phrases the decision invalidated — `grep -rn "<term>" specs/ AGENTS.md CLAUDE.md docs/ 2>/dev/null` (plain `grep`, so it works anywhere; add `-i` for case-insensitive).
3. Record each decision in the spec's Decision Log (date, decision, why).
4. Deferred items go to `TODO.md` with one line of context.
5. Only then open the next round. Never accumulate unapplied rounds.
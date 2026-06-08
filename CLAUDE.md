# CLAUDE.md — Entry point for Claude Code

Read these in order before making any changes:

1. `CORE_RULES.md` — engineering rules and scope guards
2. `AI_PROJECT_CORE.md` — product context, architecture, domain rules
3. `MEMORY.md` — current implementation state, pending steps, key decisions
4. `docs/HARNESS.md` — workflow, sensors, verification commands
5. Inspect relevant source files, then implement

See also:
- `docs/ai/CHANGELOG.md` — change history
- `docs/ai/DECISIONS.md` — durable decisions
- `docs/ai/HANDOVER.md` — session state
- `ROADMAP.md` — MVP phases and scope

---

## For UI tasks

Read `docs/ai/DESIGN_TASTE_GUIDE.md` before writing any frontend components.

## Verification

```bash
npm run typecheck
npm run build
git diff --check
```

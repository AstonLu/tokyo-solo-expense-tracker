# AI Workflow — Session Lifecycle

## Session Start

1. Read `CORE_RULES.md`
2. Read `AI_PROJECT_CORE.md`
3. Read `docs/HARNESS.md`
4. Read `docs/ai/HANDOVER.md` to understand current state
5. Read `docs/ai/CHANGELOG.md` for recent changes
6. Inspect relevant source files for the specific task

## Session Run

- Keep changes scoped to the request
- Run `npm run typecheck` after any TypeScript changes
- Update `HANDOVER.md` if state changes materially

## Session End

1. Run `npm run typecheck && npm run build`
2. Update `docs/ai/CHANGELOG.md` with what changed
3. Update `docs/ai/HANDOVER.md` with current state and what's next
4. Log session in `Memory/Daily_Logs/YYYY-MM-DD.md`

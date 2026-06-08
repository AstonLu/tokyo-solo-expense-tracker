# AGENTS.md — Entry point for Codex

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

## Security rules

- Never commit `.env.local` or any file containing API keys, tokens, or private keys
- Never log `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `GOOGLE_PRIVATE_KEY`, or full webhook payloads
- Always verify `TELEGRAM_WEBHOOK_SECRET` header before processing webhook updates
- Always check `TELEGRAM_ALLOWED_CHAT_IDS` before responding to messages
- Store Google credentials as env vars (email + private key), not as committed files

## For UI tasks

Read `docs/ai/DESIGN_TASTE_GUIDE.md` before writing any frontend components.
Apply the mobile-first rules, tabular-nums for amounts, and avoid generic AI design patterns.

## Verification

```bash
npm run typecheck
npm run build
git diff --check
```

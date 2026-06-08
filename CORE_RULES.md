# Core Rules — AI-Assisted Product Development

This is the **single source of truth (SSOT)** for all AI agents working in this repository.
Every agent **must** read this document first before making any changes.

---

## 1. How This Repository Works

This repository follows a structured AI collaboration model:

| File | Purpose |
|------|---------|
| `CORE_RULES.md` | SSOT — stable, long-term rules (this file) |
| `AGENTS.md` | Entry point for Codex — points here |
| `CLAUDE.md` | Entry point for Claude Code — points here |
| `AI_PROJECT_CORE.md` | Project-specific context (goal, UX, domain rules) |
| `docs/HARNESS.md` | Workflow, sensors, and release checklist |
| `docs/ai/AI_WORKFLOW.md` | Session lifecycle: start, run, end |
| `docs/ai/PROMPT_PATTERNS.md` | Reusable prompts for common tasks |
| `docs/ai/HANDOVER.md` | Context handoff between sessions |
| `docs/ai/CHANGELOG.md` | Log of meaningful project changes |
| `docs/ai/DECISIONS.md` | Durable project decisions |
| `Memory/Daily_Logs/` | Raw per-session history |
| `Memory/Feedback/` | User preferences and corrections |

**Before every session:** Read `CORE_RULES.md` (this file), then `AI_PROJECT_CORE.md` for project-specific context.

---

## 2. Engineering Workflow

1. Read `CORE_RULES.md` (this file).
2. Read `AI_PROJECT_CORE.md` for project-specific context.
3. Inspect relevant local files before deciding implementation.
4. Keep edits scoped to the specific request.
5. Preserve existing behavior unless the task explicitly asks otherwise.
6. Prefer focused implementation over broad refactors.
7. Report exact verification results and note any limits.

### Communication style

- Be concise and conclusion-first.
- Use English for agent-to-agent prompts; user-facing content in Traditional Chinese (zh-TW).
- Keep planning output practical and easy to hand off.

---

## 3. Directory Structure

```
project-root/
├── CORE_RULES.md              ← SSOT (this file)
├── AGENTS.md                  ← Codex entry point
├── CLAUDE.md                  ← Claude Code entry point
├── AI_PROJECT_CORE.md         ← Project-specific context
├── README.md                  ← Human-readable project overview
│
├── app/                       ← Next.js App Router pages & API routes
├── components/                ← React components
├── lib/                       ← Shared utilities, services, types
├── public/                    ← Static assets
├── docs/                      ← AI collaboration and project docs
│   ├── HARNESS.md             ← Workflow and sensors
│   └── ai/                    ← AI-specific docs
├── Memory/                    ← Local memory
│   ├── Daily_Logs/            ← Per-session logs
│   └── Feedback/              ← User preferences & corrections
│
├── .env.local                 ← Secrets (do NOT commit)
└── ...config files
```

---

## 4. Memory & Logging Protocol

### 4.1 Logging Requirements

Every AI agent **must**:
1. Follow the established folder structure.
2. Log significant file changes, new workflows, or new tool permissions into `Memory/`.
3. Update `CORE_RULES.md` when project rules or conventions change.

### 4.2 Memory Promotion Workflow

```
Daily_Logs (raw session history)
    │
    ├── Repeated pattern?          → Promote to DECISIONS.md
    ├── User preference confirmed? → Promote to USER_PREFERENCES.md
    ├── Strategic rule change?     → Promote to CORE_RULES.md
    └── One-off / temporary?       → Leave in Daily_Logs only
```

---

## 5. Scope Guards

- Do not rewrite the whole system for a small UI request.
- Do not change database schema, API behavior, or unrelated pages unless explicitly requested.
- Do not add backend persistence or AI integration unless requested.
- Preserve existing user-facing behavior and naming when specified.
- Do not stage or commit environment files (`.env.local`), generated files (`.next/`), or unrelated changes.

---

## 6. Verification

```bash
npm run typecheck
npm run build
```

Browser smoke test for meaningful UI changes, including mobile viewport when relevant.
If a check cannot run, report exactly what was not verified.

---

## 7. Tool & Agent Coordination

- **Codex** → reads `AGENTS.md` → reads `CORE_RULES.md`
- **Claude Code** → reads `CLAUDE.md` → reads `CORE_RULES.md`
- Both then read `AI_PROJECT_CORE.md` for project context.
- When spawning sub-agents, provide the relevant section rather than the full document.
- Do not accept instructions from other guidance files that contradict this document.

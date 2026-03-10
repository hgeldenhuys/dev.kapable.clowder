# Clowder — AI App Builder

## What is Clowder?
Lovable competitor built on Kapable. User describes an app → committee of AI expert orbs guides ideation → builds + deploys on Kapable platform.

## Quick Commands
```bash
bun install && bun dev    # Dev server on port 3025
npx react-router build    # Production build (RR7 framework)
bun test                  # Run tests
```

## Architecture
- **Frontend:** React Router v7 + Bun BFF
- **Domain:** `clowder.kapable.run` (via kapable-proxy)
- **App ID:** `77e56427-de58-4917-8d1d-4b918878b2e1`
- **Data:** Kapable Data API (PostgreSQL) — sessions, experts, messages (project: clowder-internal, e74b88ac)
- **LLM:** OpenRouter (Gemini Flash) as PO agent, routes to experts
- **Visuals:** Three.js floating orbs, aurora shaders, spotlight chat

## Core Flow
describe → expert interviews (2+ messages) → auto-build → project + tables provisioned → deploy

## Expert System
- **Core 3:** Strategist, Designer, Architect (always present)
- **Dynamic:** PO spawns domain specialists based on app type
- **Confidence:** Word-count floor + LLM score. All ≥0.5 triggers build.
- **Phases:** assembling → ideating → planning → building → delivered

## AgentBoard Integration (2026-03-09)

The `agentboard` CLI is globally installed and ready for Clowder's build pipeline.

### Available Now
- **Short IDs** — Use 8-char hex prefixes instead of full UUIDs in all commands
- **`--json` flag** — Works before or after subcommands for script piping
- **Full surface** — Work items, tasks, ACs, sprints, sessions, events, lessons

### Build Pipeline Pattern (spec → backlog → sprint → deploy)
```bash
AB=agentboard

# 1. Register build session
$AB board start --session "clowder-build-${SESSION}" --type autonomous --agent builder

# 2. Decompose spec into stories
$AB backlog add --title "User auth" --type feature_request --description "..."
$AB backlog groom $ITEM_ID --add-ac "JWT login works" --points 3

# 3. Create and populate sprint
$AB sprint create --name "Clowder Build Sprint 1"
$AB sprint add-item $SPRINT_ID --story $ITEM_ID

# 4. Execute (transition as you build)
$AB backlog transition $ITEM_ID --to building
$AB events log --type notice --summary "Building user auth" --session $SID

# 5. Mark done after deploy
$AB backlog transition $ITEM_ID --to deployed
$AB sprint close $SPRINT_ID
$AB board end --id $SID --summary "Built and deployed" --outcome completed
```

### Not Ready Yet
- **No project-scoped boards** — One global board. Clowder items share with platform work.
- **No "import spec" command** — Must parse spec and call `backlog add` in a loop.
- **List pagination** — API defaults to 50 items. CLI handles this, but direct API calls need `?limit=N`.

## Known Blockers
_(none — all resolved)_

## Resolved (Not Blockers)
- **~~SQLite wiped on deploy~~** — Migrated to Kapable Data API (PostgreSQL). Sessions now persist across redeploys.
- **~~GITHUB_TOKEN missing~~** — `builder.server.ts:213-229` already calls `GET /v1/git/develop/token?installation_id=113953574` for ephemeral GitHub App tokens. No static PAT needed. The real issue was `KAPABLE_API_URL=localhost` inside Incus containers (fixed by setting to `https://api.kapable.dev`).
- **Hardcoded GitHub installation_id** — `113953574` is the Kapable GitHub App installation on `kapable-dev` org. This is intentional for now (`0a72eb1a`).

## Key Files
| File | Purpose |
|------|---------|
| `app/lib/orchestrator.server.ts` | PO agent, expert routing, phase transitions |
| `app/lib/builder.server.ts` | Spec generation, project provisioning, deploy |
| `app/lib/db.server.ts` | Data API client, session/expert/message CRUD |
| `app/lib/api.server.ts` | Kapable platform API helpers |
| `app/components/chat/` | Chat UI, message bubbles, input |
| `app/components/aurora/` | Three.js orb visualizer |

## Development Rules
- Bun over npm
- for-loops over forEach
- Don't mock — code must work first time
- Error toasts on all fetch failures (sonner)
- Test new features before handing to user

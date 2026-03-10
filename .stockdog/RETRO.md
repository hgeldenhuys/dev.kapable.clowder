# Stockdog Retrospective

**Session:** stockdog-clowder-epic
**Date:** 2026-03-09
**Mission:** Clowder is production-ready
**Mission Met:** yes

## What Went Well
- Fast execution: 8 tasks in 8 cycles, ~75 minutes total
- 3 of 8 tasks were already implemented from prior sessions — good discovery
- Clean build/test pipeline: `bun build` + `bun test` both fast (<10s)
- API-level E2E verification worked well as browser fallback
- Friction logging caught real issues (env var persistence, container networking)

## What Caused Friction
| Category | Description | Impact | Suggestion |
|----------|-------------|--------|------------|
| unexpected | Pipeline overwrites .env — env vars lost on deploy | high | Set all required vars in platform env config via admin console UI |
| unexpected | localhost:3003 unreachable from Incus container | high | Document: use public URL or gateway IP (10.34.0.1) for container API access |
| context | No GITHUB_TOKEN for scaffold deploy | medium | Create org-level PAT or refactor builder to use GitHub App tokens |
| tooling | agentboard events log API returns 500 | low | Investigate events table/handler |
| tooling | agentboard transition decode error | low | Response format mismatch |

## Discoveries
- Clowder already had sonner toasts and purge script from prior sessions (lively-gazelle)
- Container .env is write-only from the pipeline — any manual additions are lost
- db.server.ts and vault.server.ts default to public URLs, which is correct for containers
- The `bun build` command in Clowder's CLAUDE.md is wrong — should be `npx react-router build`

## Recommendations
### For the Stockdog harness
- Add a pre-deploy checklist: verify env vars are in platform config, not just manual .env

### For the codebase
- Fix CLAUDE.md: `bun build` should be `npx react-router build` for Clowder
- builder.server.ts should use GitHub App installation tokens instead of plain PAT

### For the platform (Kapable product)
- Pipeline should merge env vars, not replace .env entirely
- Environment env_vars API endpoint needs testing (empty responses)
- Events log API returns 500 — needs investigation

## Generated Backlog Items
- `19040cad`: Container .env overwritten on deploy
- `4decf393`: KAPABLE_API_URL should use public URL, not localhost

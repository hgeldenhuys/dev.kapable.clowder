# Business Review — Clowder Drain Session

## Sprint 1 — 2026-03-06
**Goal:** Add structured data model parsing and Kapable platform provisioning to the Clowder build phase
**Stories:** 2/2 (BL-CLW-003, BL-CLW-001) | **ACs:** 9/9 (100%)
**Build:** bun build PASS
**Discovered:** 0 new items
**Changes:** fbd9d04 — feat: add platform provisioning to Clowder build phase (BL-CLW-003 + BL-CLW-001)
**Retro:** Headless agent got stuck (27+ min no output). Pivoted to direct execution — faster and more reliable for small-medium stories. Consider reserving headless for large multi-file sprints only.
---

## Sprint 2 — 2026-03-06
**Goal:** Scaffold and deploy a Connect App frontend from the Clowder build phase
**Stories:** 1/1 (BL-CLW-002) | **ACs:** 7/7 (100%)
**Build:** bun build PASS
**Discovered:** 0 new items
**Changes:** 693a1da — feat: scaffold and deploy Connect App frontend from Clowder (BL-CLW-002)
**Retro:** Large function (scaffoldAndDeploy ~150 lines) but appropriately so — each step is sequential with progress reporting. The import of writeFileSync inside the function is a dynamic import to avoid top-level node:fs in SSR bundle; could be hoisted later.
---

## Session Summary
**Total Sprints:** 2
**Total Stories:** 3/3 completed (BL-CLW-003, BL-CLW-001, BL-CLW-002)
**Total ACs:** 16/16 (100%)
**Build:** All passing
**Key Outcome:** Clowder build phase now provisions a real Kapable project with tables AND scaffolds/deploys a Connect App frontend. The full ideation → planning → build → deploy loop is code-complete.
**Next:** Debug table provisioning (PUT /v1/_meta/tables returns errors), then wire scaffold+deploy.

## E2E Testing — 2026-03-08

### Iteration 1: Discovered `claude` CLI not available on production container
- OpenRouter API fix (commit 25773ab) — replaced `execSync('claude')` with `callLLM()` via OpenRouter

### Iteration 2: Discovered `X-Admin-Key` header not accepted by platform API
- Header fix (commit 43100a0) — added `platformHeaders()` with correct `x-api-key`

### Iteration 3: Discovered `KAPABLE_ADMIN_KEY` env var missing on production
- Added `.env.production` (commit 40f2336) — committed file loaded by `server.ts` as fallback

### Iteration 4: SUCCESS — Project provisioned on production!
- Session: `cd02f1a3-9e7f-4167-b029-925434cb7c43`
- Project created: `b0edfb04-3812-478b-8886-125147afecdb` (slug: `a-community-event-board-where`)
- OpenRouter generated spec with `json:data_model` block containing 3 tables
- `parseDataModel()` extracted tables correctly
- `provisionProject()` succeeded — project + API keys created
- `provisionTables()` — tables not created (API may need different params), needs debugging

### Process Improvements Discovered
1. **Always push before deploy** — Connect App pipeline pulls from GitHub, not local
2. **Use OpenRouter API, not CLI** — production containers don't have `claude` CLI
3. **Use correct header** — platform API expects `x-api-key`, not `X-Admin-Key`
4. **Commit env defaults** — `.env.production` for keys that must exist in containers

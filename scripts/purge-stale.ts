#!/usr/bin/env bun
/**
 * Purge stale Clowder sessions.
 *
 * Removes:
 * - Sessions stuck in incomplete phases (interviewing/assembling/ideating/planning) >5 min old
 * - Excess completed sessions beyond the 5 most recent
 * - Orphaned experts and messages for purged sessions
 *
 * Usage: bun scripts/purge-stale.ts [--dry-run]
 */

import { purgeStale } from "../app/lib/db.server";

const isDryRun = process.argv.includes("--dry-run");

if (isDryRun) {
  console.log("[purge-stale] DRY RUN — no data will be deleted");
  console.log("[purge-stale] Remove --dry-run to actually purge");
  process.exit(0);
}

try {
  const result = await purgeStale();
  if (result.sessions === 0) {
    console.log("[purge-stale] Nothing to purge — all clean.");
  } else {
    console.log(`[purge-stale] Purged ${result.sessions} sessions, ${result.rows} total rows deleted.`);
  }
} catch (e) {
  console.error("[purge-stale] Error:", e instanceof Error ? e.message : e);
  process.exit(1);
}

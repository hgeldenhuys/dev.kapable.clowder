import { listSessions, listMessages } from "~/lib/db.server";

export async function loader() {
  const sessions = await listSessions(50);
  const delivered = sessions.filter((s) => s.phase === "delivered");
  const building = sessions.filter((s) => s.phase === "building");
  const failed = sessions.filter((s) => s.phase === "planning");

  // Extract build times from final messages of delivered sessions (last 5)
  const buildTimes: number[] = [];
  const tableCounts: number[] = [];
  for (const s of delivered.slice(0, 5)) {
    const msgs = await listMessages(s.id);
    for (const m of msgs) {
      const meta = typeof m.metadata === "string" ? JSON.parse(m.metadata) : m.metadata;
      if (meta?.build_time_ms) {
        buildTimes.push(meta.build_time_ms);
        if (meta.tables_created) tableCounts.push(meta.tables_created);
      }
    }
  }

  const avgBuildMs = buildTimes.length > 0
    ? Math.round(buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length)
    : null;
  const avgTables = tableCounts.length > 0
    ? Math.round(tableCounts.reduce((a, b) => a + b, 0) / tableCounts.length)
    : null;

  return Response.json({
    total_sessions: sessions.length,
    delivered: delivered.length,
    building: building.length,
    failed: failed.length,
    metrics: {
      avg_build_ms: avgBuildMs,
      avg_tables: avgTables,
      recent_build_times: buildTimes,
    },
    latest: sessions[0]
      ? { name: sessions[0].name, phase: sessions[0].phase, created_at: sessions[0].created_at }
      : null,
  });
}

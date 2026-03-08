import { listSessions } from "~/lib/db.server";

export async function loader() {
  const sessions = await listSessions(50);
  const delivered = sessions.filter((s) => s.phase === "delivered");
  const building = sessions.filter((s) => s.phase === "building");

  return Response.json({
    total_sessions: sessions.length,
    delivered: delivered.length,
    building: building.length,
    latest: sessions[0]
      ? { name: sessions[0].name, phase: sessions[0].phase, created_at: sessions[0].created_at }
      : null,
  });
}

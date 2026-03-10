import type { Route } from "./+types/api.clowder-session";
import { getClowderSession, renameClowderSession, deleteClowderSession } from "~/lib/api.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;
  const data = await getClowderSession(sessionId);
  return Response.json({ data });
}

export async function action({ params, request }: Route.ActionArgs) {
  const { sessionId } = params;

  if (request.method === "DELETE") {
    const ok = await deleteClowderSession(sessionId);
    if (!ok) return Response.json({ error: "Failed to delete session" }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (request.method === "PATCH") {
    const body = await request.json() as { name?: string };
    if (!body.name || body.name.trim().length === 0) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    await renameClowderSession(sessionId, body.name.trim());
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

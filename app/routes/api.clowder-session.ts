import type { Route } from "./+types/api.clowder-session";
import { getClowderSession } from "~/lib/api.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;
  const data = await getClowderSession(sessionId);
  return Response.json({ data });
}

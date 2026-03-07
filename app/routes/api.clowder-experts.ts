import type { Route } from "./+types/api.clowder-experts";
import { listClowderExperts } from "~/lib/api.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;
  const experts = await listClowderExperts(sessionId);
  return Response.json({ data: experts });
}

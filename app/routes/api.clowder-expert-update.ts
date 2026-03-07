import type { Route } from "./+types/api.clowder-expert-update";
import { updateClowderExpert } from "~/lib/api.server";

export async function action({ request, params }: Route.ActionArgs) {
  const { sessionId, expertId } = params;
  const body = await request.json() as {
    confidence?: number;
    status?: string;
    blockers?: string[];
  };
  const expert = await updateClowderExpert(sessionId, expertId, body);
  return Response.json({ data: expert });
}

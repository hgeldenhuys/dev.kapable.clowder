import type { Route } from "./+types/api.clowder-force-start";
import { forceStartBuild } from "~/lib/api.server";
import { runBuildPhase } from "~/lib/builder.server";

export async function action({ params }: Route.ActionArgs) {
  const { sessionId } = params;

  // Update phase to "planning" in DB
  await forceStartBuild(sessionId);

  // Trigger build phase orchestrator async (fire-and-forget)
  // Results arrive via SSE
  runBuildPhase(sessionId).catch((e) => {
    console.error("Build phase error:", e);
  });

  return Response.json({ ok: true });
}

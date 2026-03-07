import { redirect } from "react-router";
import type { Route } from "./+types/api.clowder-force-start";
import { forceStartBuild } from "~/lib/api.server";

export async function action({ params }: Route.ActionArgs) {
  const { sessionId } = params;
  await forceStartBuild(sessionId);
  return redirect(`/session/${sessionId}`);
}

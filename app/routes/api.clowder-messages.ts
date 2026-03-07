import { redirect } from "react-router";
import type { Route } from "./+types/api.clowder-messages";
import { sendClowderMessage } from "~/lib/api.server";

export async function action({ request, params }: Route.ActionArgs) {
  const { sessionId } = params;
  const formData = await request.formData();
  const content = String(formData.get("content") ?? "").trim();

  if (!content) {
    return Response.json({ error: "Content required" }, { status: 400 });
  }

  await sendClowderMessage(sessionId, { content, role: "user" });
  return redirect(`/session/${sessionId}`);
}

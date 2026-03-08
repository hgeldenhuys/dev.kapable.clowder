import { redirect } from "react-router";
import type { Route } from "./+types/api.clowder-sessions";
import { createClowderSession, sendClowderMessage } from "~/lib/api.server";
import { orchestrate } from "~/lib/orchestrator.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return Response.json({ error: "Description required" }, { status: 400 });
  }

  const session = await createClowderSession({ description });

  // Send the description as the first user message so experts respond immediately
  await sendClowderMessage(session.id, { content: description, role: "user" });
  orchestrate(session.id).catch((e) => {
    console.error("Orchestrator error on API session create:", e);
  });

  return redirect(`/session/${session.id}`);
}

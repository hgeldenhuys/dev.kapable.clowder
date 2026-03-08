import { redirect } from "react-router";
import type { Route } from "./+types/api.clowder-sessions";
import { createClowderSession, sendClowderMessage } from "~/lib/api.server";
import { orchestrate } from "~/lib/orchestrator.server";

export async function action({ request }: Route.ActionArgs) {
  let description: string;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json() as { description?: string };
    description = String(body.description ?? "").trim();
  } else {
    const formData = await request.formData();
    description = String(formData.get("description") ?? "").trim();
  }

  if (!description) {
    return Response.json({ error: "Description required" }, { status: 400 });
  }

  const session = await createClowderSession({ description });

  // Send the description as the first user message so experts respond immediately
  await sendClowderMessage(session.id, { content: description, role: "user" });
  orchestrate(session.id).catch((e) => {
    console.error("Orchestrator error on API session create:", e);
  });

  // JSON requests get JSON response; form submissions get redirect
  if (contentType.includes("application/json")) {
    return Response.json({ session });
  }

  return redirect(`/session/${session.id}`);
}

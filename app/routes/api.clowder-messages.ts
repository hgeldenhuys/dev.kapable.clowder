import type { Route } from "./+types/api.clowder-messages";
import { listClowderMessages, sendClowderMessage } from "~/lib/api.server";
import { orchestrate } from "~/lib/orchestrator.server";
import { appendVaultLine, sessionVaultPath } from "~/lib/vault.server";
import { buildInterviewLine } from "~/lib/context.server";

export async function loader({ params }: Route.LoaderArgs) {
  const messages = await listClowderMessages(params.sessionId);
  return Response.json({ data: messages });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { sessionId } = params;

  let content: string;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json() as { content?: string };
    content = String(body.content ?? "").trim();
  } else {
    const formData = await request.formData();
    content = String(formData.get("content") ?? "").trim();
  }

  if (!content) {
    return Response.json({ error: "Content required" }, { status: 400 });
  }

  // Save user message
  const userMessage = await sendClowderMessage(sessionId, { content, role: "user" });

  // Accumulate user message in Vault interviews log (best-effort)
  const interviewsPath = sessionVaultPath(sessionId, "interviews.jsonl");
  appendVaultLine(interviewsPath, buildInterviewLine("user", content, "user")).catch((e) =>
    console.error("Vault user interview append failed:", e),
  );

  // Trigger PO orchestrator async — don't await on the request path for snappier UX.
  // The expert response arrives via SSE. We fire-and-forget here.
  orchestrate(sessionId).catch((e) => {
    console.error("Orchestrator error:", e);
  });

  return Response.json({ data: userMessage });
}

/**
 * BFF route for Clowder typehead flow.
 *
 * POST /api/clowder-typehead — trigger typehead flow, return { runId, flowId }
 * GET  /api/clowder-typehead?runId=X&flowId=Y — proxy SSE from flow run stream
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { runTypehead } from "~/lib/typehead.server";

const API_BASE = process.env.KAPABLE_API_URL ?? "https://api.kapable.dev";
const API_KEY = process.env.CLOWDER_INTERNAL_API_KEY ?? "";

// POST — trigger typehead flow
export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json() as {
    name: string;
    description: string;
    file_summaries?: string[];
  };

  if (!body.name || !body.description) {
    return Response.json({ error: "name and description required" }, { status: 400 });
  }

  const result = await runTypehead({
    name: body.name,
    description: body.description,
    file_summaries: body.file_summaries,
  });

  if (!result) {
    return Response.json({ error: "Typehead flow not available" }, { status: 503 });
  }

  return Response.json({ runId: result.runId, flowId: result.flowId });
}

// GET — proxy SSE stream from flow run
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  const flowId = url.searchParams.get("flowId");

  if (!runId || !flowId) {
    return Response.json({ error: "runId and flowId required" }, { status: 400 });
  }

  // Proxy the SSE stream from the flow engine
  const streamUrl = `${API_BASE}/v1/flows/${flowId}/runs/${runId}/stream`;
  const upstream = await fetch(streamUrl, {
    headers: { "x-api-key": API_KEY },
    signal: request.signal,
  });

  if (!upstream.ok) {
    return Response.json(
      { error: `Flow stream failed (${upstream.status})` },
      { status: upstream.status },
    );
  }

  // Pass through the SSE stream
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

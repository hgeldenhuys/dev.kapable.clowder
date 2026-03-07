import type { Route } from "./+types/api.clowder-stream";
import { getApiBaseUrl, getAdminKey } from "~/lib/api.server";

/**
 * BFF SSE proxy — forwards the platform SSE stream to the browser.
 *
 * The browser cannot hit the platform API directly (CORS + auth).
 * This route proxies the SSE stream, adding auth headers server-side.
 *
 * Uses TransformStream to properly forward the SSE bytes without buffering.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const upstream = await fetch(
    `${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/sse`,
    {
      headers: {
        "X-Admin-Key": getAdminKey(),
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    }
  );

  if (!upstream.ok || !upstream.body) {
    return new Response("Failed to connect to upstream SSE", { status: 502 });
  }

  // Pipe upstream body through a TransformStream (never pipe directly).
  const { readable, writable } = new TransformStream();
  upstream.body.pipeTo(writable).catch(() => {
    // Upstream closed — browser will retry
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import type { Route } from "./+types/api.clowder-stream";
import { subscribe } from "~/lib/sse.server";

/**
 * BFF SSE endpoint — streams real-time Clowder events to the browser.
 *
 * Uses the local SSE emitter (no Rust API proxy).
 * Sends heartbeats every 15s to keep the connection alive.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval>;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      function write(eventType: string, data: string) {
        try {
          controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      }

      // Subscribe to session events
      unsubscribe = subscribe(sessionId, write);

      // Heartbeat every 15s
      heartbeat = setInterval(() => {
        write("heartbeat", JSON.stringify({ type: "heartbeat", session_id: sessionId }));
      }, 15000);

      // Send initial heartbeat
      write("heartbeat", JSON.stringify({ type: "heartbeat", session_id: sessionId }));

      // Clean up when client disconnects (request aborted)
      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      unsubscribe?.();
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

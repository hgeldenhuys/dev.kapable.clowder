import type { Route } from "./+types/api.clowder-stream";
import { subscribe } from "~/lib/sse.server";

/**
 * BFF SSE endpoint — streams real-time Clowder events to the browser.
 *
 * Uses the local SSE emitter (no Rust API proxy).
 * Sends heartbeats every 15s to keep the connection alive.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  function write(eventType: string, data: string) {
    try {
      writer.write(encoder.encode(`event: ${eventType}\ndata: ${data}\n\n`));
    } catch {
      // Stream closed
    }
  }

  // Subscribe to session events
  const unsubscribe = subscribe(sessionId, write);

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    write("heartbeat", JSON.stringify({ type: "heartbeat", session_id: sessionId }));
  }, 15000);

  // Send initial heartbeat
  write("heartbeat", JSON.stringify({ type: "heartbeat", session_id: sessionId }));

  // Clean up when the client disconnects
  readable.pipeTo(new WritableStream()).catch(() => {
    // Client disconnected
  }).finally(() => {
    unsubscribe();
    clearInterval(heartbeat);
    writer.close().catch(() => {});
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

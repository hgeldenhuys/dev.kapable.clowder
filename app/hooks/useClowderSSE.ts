"use client";

import { useEffect, useCallback } from "react";

export type ClowderSSEEvent =
  | { type: "session_created"; session_id: string }
  | { type: "phase_changed"; session_id: string; phase: string }
  | { type: "force_started"; session_id: string }
  | { type: "message"; session_id: string; message: {
      id: string;
      role: string;
      content: string;
      expert_id?: string;
      phase: string;
      created_at: string;
    } }
  | { type: "expert_updated"; session_id: string; expert: {
      id: string;
      name: string;
      confidence: number;
      status: string;
      blockers: unknown[];
    } }
  | { type: "heartbeat"; session_id: string };

interface UseClowderSSEOptions {
  sessionId: string;
  onEvent: (event: ClowderSSEEvent) => void;
  enabled?: boolean;
}

/**
 * Connects to the BFF SSE proxy at /api/clowder-session/:sessionId/sse
 * and dispatches typed events.
 *
 * Auto-reconnects on error with exponential backoff (max 30s).
 * Cleans up EventSource on unmount.
 */
export function useClowderSSE({ sessionId, onEvent, enabled = true }: UseClowderSSEOptions) {
  const handleEvent = useCallback(onEvent, [onEvent]);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    let es: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function connect() {
      if (!mounted) return;

      es = new EventSource(`/api/clowder-session/${sessionId}/sse`);

      // Listen for typed event types
      const eventTypes = [
        "session_created",
        "phase_changed",
        "force_started",
        "message",
        "expert_updated",
        "heartbeat",
      ] as const;

      for (const eventType of eventTypes) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as ClowderSSEEvent;
            handleEvent(data);
          } catch {
            // Malformed event — ignore
          }
        });
      }

      es.onerror = () => {
        es?.close();
        if (!mounted) return;
        // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };

      es.onopen = () => {
        // Reset backoff on successful connection
        retryDelay = 1000;
      };
    }

    connect();

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [sessionId, enabled, handleEvent]);
}

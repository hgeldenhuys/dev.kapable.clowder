import { useEffect, useRef } from "react";

export interface TypeheadSpecialist {
  type: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface TypeheadResult {
  specialists: TypeheadSpecialist[];
  complexity: string;
  estimated_tables: number;
  key_domains: string[];
}

interface UseTypeheadStreamOptions {
  runId: string | null;
  flowId: string | null;
  onSpecialistFound: (specialist: TypeheadSpecialist) => void;
  onComplete: (result: TypeheadResult) => void;
  onError: (error: string) => void;
}

/**
 * SSE hook that streams typehead flow results.
 * Connects to /api/clowder-typehead?runId=X&flowId=Y
 * Parses flow engine events and emits specialist predictions.
 */
export function useTypeheadStream({
  runId,
  flowId,
  onSpecialistFound,
  onComplete,
  onError,
}: UseTypeheadStreamOptions) {
  const callbacksRef = useRef({ onSpecialistFound, onComplete, onError });
  callbacksRef.current = { onSpecialistFound, onComplete, onError };

  useEffect(() => {
    if (!runId || !flowId) return;

    const controller = new AbortController();

    async function connect() {
      try {
        const res = await fetch(
          `/api/clowder-typehead?runId=${runId}&flowId=${flowId}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          callbacksRef.current.onError(`Stream failed (${res.status})`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          callbacksRef.current.onError("No response body");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const event = JSON.parse(data) as Record<string, unknown>;

              // Flow engine emits events with node completions
              // Look for the output node's result
              if (event.type === "node_complete" || event.event === "node_complete") {
                const outputJson = event.output_json as string | undefined;
                if (outputJson) {
                  try {
                    const parsed = JSON.parse(outputJson);
                    // Check if this looks like the final typehead result
                    if (parsed.specialists && Array.isArray(parsed.specialists)) {
                      const result = parsed as TypeheadResult;
                      // Emit each specialist progressively
                      for (const specialist of result.specialists) {
                        callbacksRef.current.onSpecialistFound(specialist);
                      }
                      callbacksRef.current.onComplete(result);
                    }
                  } catch {
                    // Not JSON output — skip
                  }
                }
              }

              // Handle run completion
              if (event.type === "run_complete" || event.event === "run_complete") {
                // Final result may be in event.output
                const output = event.output as string | undefined;
                if (output) {
                  try {
                    const result = JSON.parse(output) as TypeheadResult;
                    if (result.specialists) {
                      for (const specialist of result.specialists) {
                        callbacksRef.current.onSpecialistFound(specialist);
                      }
                      callbacksRef.current.onComplete(result);
                    }
                  } catch {
                    // Not parseable
                  }
                }
              }

              // Handle errors
              if (event.type === "error" || event.event === "error") {
                callbacksRef.current.onError(String(event.message ?? "Flow error"));
              }
            } catch {
              // Not JSON — skip
            }
          }
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          callbacksRef.current.onError(e instanceof Error ? e.message : "Stream error");
        }
      }
    }

    connect();

    return () => {
      controller.abort();
    };
  }, [runId, flowId]);
}

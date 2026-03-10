/**
 * BFF-native SSE emitter for Clowder.
 *
 * Uses an in-memory EventTarget pattern — no external dependencies.
 * Each session has its own set of listeners.
 */

type SSEListener = (event: string, data: string) => void;

const listeners = new Map<string, Set<SSEListener>>();

export function subscribe(sessionId: string, listener: SSEListener): () => void {
  if (!listeners.has(sessionId)) {
    listeners.set(sessionId, new Set());
  }
  listeners.get(sessionId)!.add(listener);

  return () => {
    const set = listeners.get(sessionId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) listeners.delete(sessionId);
    }
  };
}

export function emit(sessionId: string, eventType: string, data: Record<string, unknown>) {
  const set = listeners.get(sessionId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify({ type: eventType, session_id: sessionId, ...data });
  for (const listener of set) {
    try {
      listener(eventType, payload);
    } catch {
      // Listener error — ignore
    }
  }
}

// Convenience emitters
export function emitMessage(sessionId: string, message: Record<string, unknown>) {
  emit(sessionId, "message", { message });
}

export function emitExpertUpdated(sessionId: string, expert: Record<string, unknown>) {
  emit(sessionId, "expert_updated", { expert });
}

export function emitPhaseChanged(sessionId: string, phase: string, extra?: Record<string, unknown>) {
  emit(sessionId, "phase_changed", { phase, ...extra });
}

export function emitForceStarted(sessionId: string) {
  emit(sessionId, "force_started", {});
}

export function emitBuildProgress(sessionId: string, data: Record<string, unknown>) {
  emit(sessionId, "build_progress", data);
}

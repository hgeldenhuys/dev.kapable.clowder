"use client";

import { useState, useCallback } from "react";
import type { ClowderSession, ClowderExpert, ClowderMessage } from "~/lib/api.server";
import { useClowderSSE } from "./useClowderSSE";

interface UseClowderSessionOptions {
  initialSession: ClowderSession;
  initialExperts: ClowderExpert[];
  initialMessages: ClowderMessage[];
}

/**
 * Manages full Clowder session state on the client.
 *
 * - Starts with server-loaded data (SSR)
 * - Subscribes to SSE for real-time updates
 * - Provides send/forceStart actions via BFF routes
 */
export function useClowderSession({
  initialSession,
  initialExperts,
  initialMessages,
}: UseClowderSessionOptions) {
  const [session, setSession] = useState<ClowderSession>(initialSession);
  const [experts, setExperts] = useState<ClowderExpert[]>(initialExperts);
  const [messages, setMessages] = useState<ClowderMessage[]>(initialMessages);
  const [activeExpertId, setActiveExpertId] = useState<string | undefined>(
    initialExperts.find((e) => e.status === "on_stage")?.id
  );
  const [isSending, setIsSending] = useState(false);

  const handleSSEEvent = useCallback((event: import("./useClowderSSE").ClowderSSEEvent) => {
    switch (event.type) {
      case "phase_changed":
        setSession((s) => ({ ...s, phase: event.phase as ClowderSession["phase"] }));
        break;

      case "force_started":
        setSession((s) => ({ ...s, phase: "planning" }));
        break;

      case "message": {
        const msg = event.message;
        const newMessage: ClowderMessage = {
          id: msg.id,
          session_id: session.id,
          org_id: session.org_id,
          expert_id: msg.expert_id,
          role: msg.role as "user" | "expert" | "system",
          content: msg.content,
          phase: msg.phase,
          metadata: {},
          created_at: msg.created_at,
        };
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, newMessage];
        });
        break;
      }

      case "expert_updated": {
        const { expert } = event;
        setExperts((prev) =>
          prev.map((e) =>
            e.id === expert.id
              ? {
                  ...e,
                  confidence: expert.confidence,
                  status: expert.status as ClowderExpert["status"],
                  blockers: expert.blockers as string[],
                }
              : e
          )
        );
        // If expert came on stage, update active expert
        if (expert.status === "on_stage") {
          setActiveExpertId(expert.id);
        }
        break;
      }
    }
  }, [session.id, session.org_id]);

  useClowderSSE({
    sessionId: session.id,
    onEvent: handleSSEEvent,
  });

  const sendMessage = useCallback(async (content: string) => {
    if (isSending || !content.trim()) return;
    setIsSending(true);

    // Optimistic update
    const optimisticMsg: ClowderMessage = {
      id: `optimistic-${Date.now()}`,
      session_id: session.id,
      org_id: session.org_id,
      expert_id: undefined,
      role: "user",
      content: content.trim(),
      phase: session.phase,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const formData = new FormData();
      formData.set("content", content.trim());

      const res = await fetch(`/api/clowder-session/${session.id}/messages`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        console.error("Failed to send message");
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      console.error("Send error:", e);
    } finally {
      setIsSending(false);
    }
  }, [session.id, session.org_id, session.phase, isSending]);

  const forceStart = useCallback(async () => {
    try {
      await fetch(`/api/clowder-session/${session.id}/force-start`, { method: "POST" });
    } catch (e) {
      console.error("Force start error:", e);
    }
  }, [session.id]);

  const setActiveExpert = useCallback((id: string) => {
    setActiveExpertId(id);
  }, []);

  const activeExpert = experts.find((e) => e.id === activeExpertId);

  return {
    session,
    experts,
    messages,
    activeExpert,
    activeExpertId,
    isSending,
    sendMessage,
    forceStart,
    setActiveExpert,
  };
}

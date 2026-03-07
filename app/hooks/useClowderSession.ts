"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
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
    initialExperts.find((e) => e.status === "on_stage")?.id ?? initialExperts[0]?.id
  );
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForExpert, setIsWaitingForExpert] = useState(false);

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
          // Avoid duplicates (by real ID)
          if (prev.some((m) => m.id === msg.id)) return prev;
          // Replace optimistic message with real one (same role + content)
          if (msg.role === "user") {
            const optimisticIdx = prev.findIndex(
              (m) => m.id.startsWith("optimistic-") && m.content === msg.content
            );
            if (optimisticIdx !== -1) {
              const updated = [...prev];
              updated[optimisticIdx] = newMessage;
              return updated;
            }
          }
          return [...prev, newMessage];
        });
        // Clear typing indicator when expert responds
        if (msg.role === "expert") {
          setIsWaitingForExpert(false);
        }
        break;
      }

      case "expert_updated": {
        const { expert } = event;
        setExperts((prev) => {
          const existingIdx = prev.findIndex((e) => e.id === expert.id);
          if (existingIdx !== -1) {
            // Update existing expert
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              confidence: expert.confidence,
              status: expert.status as ClowderExpert["status"],
              blockers: expert.blockers as string[],
            };
            return updated;
          }
          // New expert — add to list
          return [...prev, {
            id: expert.id,
            session_id: session.id,
            org_id: session.org_id,
            name: expert.name,
            role: (expert as any).role ?? "core",
            domain: (expert as any).domain ?? expert.name.toLowerCase(),
            voice_id: undefined,
            confidence: expert.confidence,
            status: expert.status as ClowderExpert["status"],
            blockers: expert.blockers as string[],
            system_prompt: undefined,
            sort_order: prev.length,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }];
        });
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
    setIsWaitingForExpert(true);

    try {
      const formData = new FormData();
      formData.set("content", content.trim());

      const res = await fetch(`/api/clowder-session/${session.id}/messages`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setIsWaitingForExpert(false);
        toast.error("Failed to send message. Please try again.");
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setIsWaitingForExpert(false);
      toast.error("Connection error. Please check your network and try again.");
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
    isWaitingForExpert,
    sendMessage,
    forceStart,
    setActiveExpert,
  };
}

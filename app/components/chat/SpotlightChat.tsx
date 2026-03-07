"use client";

import { useEffect, useRef } from "react";
import type { ClowderMessage, ClowderExpert } from "~/lib/api.server";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

interface SpotlightChatProps {
  messages: ClowderMessage[];
  experts: ClowderExpert[];
  sessionId: string;
  activeExpert?: ClowderExpert;
  phase: string;
  isWaitingForExpert?: boolean;
  onSend: (content: string) => void;
  onForceStart: () => void;
}

/**
 * Spotlight chat panel — shows messages in a scrollable list.
 *
 * Displays who is "on stage" (the active expert) at the top.
 * Messages scroll to bottom automatically when new messages arrive.
 */
export function SpotlightChat({
  messages,
  experts,
  sessionId,
  activeExpert,
  phase,
  isWaitingForExpert,
  onSend,
  onForceStart,
}: SpotlightChatProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isBuilding = phase === "building" || phase === "delivered";

  // Auto-scroll to bottom when new messages arrive or typing indicator shows
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, isWaitingForExpert]);

  return (
    <div className="flex flex-col h-full">
      {/* Active expert header */}
      {activeExpert && (
        <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-primary text-primary-foreground"
          >
            {activeExpert.name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold">{activeExpert.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {activeExpert.domain} · {Math.round(activeExpert.confidence * 100)}% confident
            </p>
          </div>
          <div className="ml-auto">
            <PhaseChip phase={phase} />
          </div>
        </div>
      )}
      {!activeExpert && (
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm text-muted-foreground">
            {messages.length === 0 ? "Describe your app to begin" : "Committee discussion"}
          </p>
          <PhaseChip phase={phase} />
        </div>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground max-w-xs">
              <p className="text-4xl mb-3">🐱</p>
              <p className="text-sm font-medium">Your Clowder is assembled.</p>
              <p className="text-xs mt-1">
                Tell us about your app idea and the experts will ask questions to refine it.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} experts={experts} />
        ))}
        {isWaitingForExpert && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {activeExpert ? `${activeExpert.name} is thinking…` : "Experts are thinking…"}
            </span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-none border-t border-border p-4">
        <ChatInput
          sessionId={sessionId}
          isBuilding={isBuilding}
          onSend={onSend}
          onForceStart={phase !== "building" && phase !== "delivered" ? onForceStart : undefined}
        />
      </div>
    </div>
  );
}

function PhaseChip({ phase }: { phase: string }) {
  const phaseLabels: Record<string, { label: string; color: string }> = {
    assembling: { label: "Assembling", color: "text-yellow-400" },
    ideating: { label: "Ideating", color: "text-blue-400" },
    planning: { label: "Planning", color: "text-purple-400" },
    building: { label: "Building", color: "text-green-400" },
    delivered: { label: "Delivered", color: "text-emerald-400" },
  };
  const { label, color } = phaseLabels[phase] ?? { label: phase, color: "text-muted-foreground" };

  return (
    <span className={`text-xs font-medium uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

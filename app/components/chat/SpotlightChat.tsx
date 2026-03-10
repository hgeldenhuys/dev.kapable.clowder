"use client";

import { useEffect, useRef } from "react";
import type { ClowderMessage, ClowderExpert } from "~/lib/api.server";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ExpertAvatar } from "./ExpertAvatar";

interface SpotlightChatProps {
  messages: ClowderMessage[];
  experts: ClowderExpert[];
  sessionId: string;
  activeExpert?: ClowderExpert;
  phase: string;
  isWaitingForExpert?: boolean;
  onSend: (content: string) => void;
  onForceStart?: () => void;
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
        <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-border bg-card/30 backdrop-blur-sm">
          <ExpertAvatar
            domain={activeExpert.domain}
            name={activeExpert.name}
            size="md"
            className="ring-2 ring-primary/20"
          />
          <div>
            <p className="text-sm font-semibold">{activeExpert.name}</p>
            <p className="text-xs text-muted-foreground">
              <span className="capitalize">{activeExpert.domain.replace(/_/g, " ")}</span>
              <span className="mx-1.5 opacity-40">·</span>
              <span className={activeExpert.confidence >= 0.8 ? "text-emerald-400" : activeExpert.confidence >= 0.5 ? "text-amber-400" : "text-zinc-500"}>
                {Math.round(activeExpert.confidence * 100)}% confident
              </span>
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
            {messages.length === 0
              ? "Describe your app to begin"
              : phase === "interviewing"
                ? "Understanding your vision"
                : "Committee discussion"}
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
            <div className="text-center text-muted-foreground max-w-xs space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-blue-600/20 flex items-center justify-center border border-primary/10">
                <span className="text-3xl opacity-60">◈</span>
              </div>
              <p className="text-sm font-medium text-foreground/80">Your expert committee awaits</p>
              <p className="text-xs leading-relaxed">
                Describe your app idea and your team of AI experts will guide you from concept to deployed product.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} experts={experts} />
        ))}
        {/* Interview progress indicator */}
        {phase === "interviewing" && messages.length > 0 && (
          <InterviewProgress messages={messages} />
        )}
        {isWaitingForExpert && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {phase === "interviewing"
                ? "Understanding your vision…"
                : activeExpert ? `${activeExpert.name} is thinking…` : "Experts are thinking…"}
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

const INTERVIEW_STEPS = ["Your idea", "Who uses it", "Core actions", "Success scenario", "Scope"];

function InterviewProgress({ messages }: { messages: ClowderMessage[] }) {
  // Count user messages to determine progress
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const step = Math.min(userMsgCount, INTERVIEW_STEPS.length);

  return (
    <div className="flex items-center gap-1.5 px-4 py-2">
      {INTERVIEW_STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              i < step
                ? "bg-amber-400"
                : i === step
                  ? "bg-amber-400/50 animate-pulse"
                  : "bg-muted-foreground/20"
            }`}
          />
          <span
            className={`text-[10px] ${
              i < step
                ? "text-amber-400"
                : i === step
                  ? "text-amber-400/70"
                  : "text-muted-foreground/40"
            }`}
          >
            {label}
          </span>
          {i < INTERVIEW_STEPS.length - 1 && (
            <span className="text-muted-foreground/20 text-[10px]">›</span>
          )}
        </div>
      ))}
    </div>
  );
}

function PhaseChip({ phase }: { phase: string }) {
  const phaseLabels: Record<string, { label: string; color: string }> = {
    interviewing: { label: "Understanding", color: "text-amber-400" },
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

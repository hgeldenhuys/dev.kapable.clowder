"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  appUrl?: string;
  isWaitingForExpert?: boolean;
  onSend: (content: string) => void;
  onForceStart?: () => void;
  onRetryBuild?: () => void;
}

/**
 * Compute grouping info for messages.
 * Consecutive messages from the same expert are grouped:
 * - isFirstInGroup: show avatar + name
 * - isLastInGroup: full bottom margin
 * - isMiddle: reduced gap, no avatar
 */
interface GroupInfo {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

function computeGrouping(messages: ClowderMessage[]): GroupInfo[] {
  const result: GroupInfo[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;

    const sameAsPrev =
      prev !== null &&
      msg.role === prev.role &&
      msg.role !== "user" &&
      msg.expert_id === prev.expert_id &&
      msg.expert_id != null;

    const sameAsNext =
      next !== null &&
      msg.role === next.role &&
      msg.role !== "user" &&
      msg.expert_id === next.expert_id &&
      msg.expert_id != null;

    result.push({
      isFirstInGroup: !sameAsPrev,
      isLastInGroup: !sameAsNext,
    });
  }
  return result;
}

/**
 * Spotlight chat panel -- shows messages in a scrollable list.
 *
 * Displays who is "on stage" (the active expert) at the top.
 * Messages scroll to bottom automatically when new messages arrive.
 * A floating "scroll to bottom" button appears when user scrolls up.
 */
export function SpotlightChat({
  messages,
  experts,
  sessionId,
  activeExpert,
  phase,
  appUrl,
  isWaitingForExpert,
  onSend,
  onForceStart,
  onRetryBuild,
}: SpotlightChatProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isBuilding = phase === "building" || phase === "delivered";
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTo({
          top: listRef.current.scrollHeight,
          behavior,
        });
      }
    });
  }, []);

  // Track scroll position to show/hide scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 80;
    isNearBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if already near bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages.length, isWaitingForExpert, scrollToBottom]);

  // On initial mount, scroll to bottom instantly
  useEffect(() => {
    scrollToBottom("instant");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouping = computeGrouping(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Active expert header */}
      {activeExpert && (
        <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-[var(--shadow-sm)]">
          <ExpertAvatar
            domain={activeExpert.domain}
            name={activeExpert.name}
            size="md"
            className="ring-2 ring-primary/20"
          />
          <div>
            <p className="text-sm font-semibold">{activeExpert.name}</p>
            <p className="text-xs text-muted-foreground">
              <span className="capitalize hidden sm:inline">{activeExpert.domain.replace(/_/g, " ")}</span>
              <span className="mx-1.5 opacity-40 hidden sm:inline">·</span>
              <span
                className={`flex items-center gap-1 ${activeExpert.confidence >= 0.8 ? "text-accent" : activeExpert.confidence >= 0.5 ? "text-[color:var(--warning)]" : "text-muted-foreground"}`}
                title={`Confidence: ${Math.round(activeExpert.confidence * 100)}% — increases as you discuss requirements`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeExpert.confidence >= 0.8 ? "bg-accent" : activeExpert.confidence >= 0.5 ? "bg-[color:var(--warning)]" : "bg-muted-foreground/50"}`} />
                {activeExpert.confidence >= 0.8 ? "Ready to build" : activeExpert.confidence >= 0.5 ? "Getting aligned" : "Learning"}
              </span>
            </p>
          </div>
          <div className="ml-auto">
            <PhaseChip phase={phase} />
          </div>
        </div>
      )}
      {!activeExpert && (
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
          <p className="text-sm text-muted-foreground/70">
            {messages.length === 0
              ? "Describe your app to begin"
              : phase === "interviewing"
                ? "Understanding your vision"
                : phase === "ideating"
                  ? "Your experts are discussing your app"
                  : phase === "planning"
                    ? "Finalizing the build plan"
                    : "Expert discussion"}
          </p>
          <PhaseChip phase={phase} />
        </div>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={handleScroll}
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Scroll-to-bottom floating button */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="scroll-to-bottom-btn fixed z-30 right-6 bottom-24 w-9 h-9 rounded-full bg-card border border-border shadow-[var(--shadow-md)] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            aria-label="Scroll to bottom"
            title="Scroll to latest messages"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full animate-fade-in">
            <div className="text-center text-muted-foreground max-w-xs space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10 animate-pulse-glow animate-float-slow">
                <img src="/logo.png" alt="" className="w-8 h-8 opacity-60" />
              </div>
              <p className="text-sm font-semibold text-foreground/80">Your expert committee awaits</p>
              <p className="text-xs leading-relaxed text-muted-foreground/60">
                Describe your app idea and your team of AI experts will guide you from concept to deployed product.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isRecent = idx >= messages.length - 3;
          const group = grouping[idx];
          return (
            <div
              key={msg.id}
              className={isRecent ? "animate-fade-in-up" : ""}
              style={{
                ...(isRecent ? { animationDelay: `${(idx - (messages.length - 3)) * 0.05}s` } : {}),
                marginBottom: group.isLastInGroup ? "12px" : "3px",
              }}
            >
              <MessageBubble
                message={msg}
                experts={experts}
                isFirstInGroup={group.isFirstInGroup}
                isLastInGroup={group.isLastInGroup}
              />
            </div>
          );
        })}
        {/* Interview progress indicator */}
        {phase === "interviewing" && messages.length > 0 && (
          <InterviewProgress messages={messages} />
        )}
        {isWaitingForExpert && (
          <ThinkingIndicator phase={phase} activeExpert={activeExpert} experts={experts} />
        )}
      </div>

      {/* Input area */}
      <div className="flex-none border-t border-border p-4 bg-card/60">
        <ChatInput
          sessionId={sessionId}
          isBuilding={isBuilding}
          phase={phase}
          messages={messages}
          appUrl={appUrl}
          onSend={onSend}
          onForceStart={phase !== "building" && phase !== "delivered" ? onForceStart : undefined}
          onRetryBuild={onRetryBuild}
        />
      </div>
    </div>
  );
}

const INTERVIEW_STEPS = [
  { label: "Idea", icon: "idea", question: "What's your app idea?" },
  { label: "Users", icon: "users", question: "Who are your users?" },
  { label: "Actions", icon: "actions", question: "What can users do?" },
  { label: "Success", icon: "success", question: "What does success look like?" },
  { label: "Scope", icon: "scope", question: "What's in/out of scope?" },
];

function InterviewProgress({ messages }: { messages: ClowderMessage[] }) {
  // Count user messages to determine progress
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const step = Math.min(userMsgCount, INTERVIEW_STEPS.length);
  const currentStep = INTERVIEW_STEPS[step];

  return (
    <div className="my-3 rounded-xl bg-card/50 border border-border/50 p-3 space-y-2.5">
      {/* Progress bar */}
      <div className="flex items-center gap-0">
        {INTERVIEW_STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1 relative z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                  i < step
                    ? "bg-primary/10 border-2 border-primary text-primary"
                    : i === step
                      ? "bg-primary/5 border-2 border-primary/60 text-primary/80 animate-pulse"
                      : "bg-secondary border border-border text-muted-foreground/50"
                }`}
              >
                {i < step ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-[10px]">{i + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium whitespace-nowrap ${
                  i < step
                    ? "text-primary"
                    : i === step
                      ? "text-primary/60"
                      : "text-muted-foreground/50"
                }`}
              >
                {s.label}
              </span>
            </div>
            {/* Connecting line */}
            {i < INTERVIEW_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mt-[-14px] ${
                i < step ? "bg-primary/30" : "bg-border"
              }`} />
            )}
          </div>
        ))}
      </div>
      {/* Current question hint */}
      {currentStep && (
        <p className="text-[11px] text-center text-muted-foreground/60">
          Next: {currentStep.question}
        </p>
      )}
    </div>
  );
}

function ThinkingIndicator({
  phase,
  activeExpert,
  experts,
}: {
  phase: string;
  activeExpert?: ClowderExpert;
  experts: ClowderExpert[];
}) {
  const thinkingName = activeExpert
    ? activeExpert.name
    : experts.length > 0
      ? "Experts"
      : "Clowder";

  return (
    <div className="flex items-center gap-3 px-4 py-3 mx-3 rounded-xl glass-card animate-fade-in">
      <div className="flex gap-1.5">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
      <span className="text-xs text-muted-foreground" style={{ opacity: 0.6 }}>
        {thinkingName} is thinking...
      </span>
    </div>
  );
}

function PhaseChip({ phase }: { phase: string }) {
  const phaseLabels: Record<string, { label: string; color: string; bg: string }> = {
    interviewing: { label: "Understanding", color: "text-[#E8A838]", bg: "bg-[#E8A838]/10 border-[#E8A838]/20" },
    assembling: { label: "Assembling", color: "text-[#E8A838]", bg: "bg-[#E8A838]/10 border-[#E8A838]/20" },
    ideating: { label: "Ideating", color: "text-[#5B8FB9]", bg: "bg-[#5B8FB9]/10 border-[#5B8FB9]/20" },
    planning: { label: "Planning", color: "text-[#9B6B8E]", bg: "bg-[#9B6B8E]/10 border-[#9B6B8E]/20" },
    building: { label: "Building", color: "text-accent", bg: "bg-accent/10 border-accent/20" },
    delivered: { label: "Delivered", color: "text-accent", bg: "bg-accent/10 border-accent/20" },
  };
  const { label, color, bg } = phaseLabels[phase] ?? { label: phase, color: "text-muted-foreground", bg: "bg-zinc-400/10 border-zinc-400/20" };

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all duration-300 ${color} ${bg} ${phase === "delivered" ? "shadow-sm shadow-accent/20" : ""}`}>
      {label}
    </span>
  );
}

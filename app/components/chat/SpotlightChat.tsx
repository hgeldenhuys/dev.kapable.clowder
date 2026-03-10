"use client";

import { useEffect, useRef, useState } from "react";
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
  appUrl,
  isWaitingForExpert,
  onSend,
  onForceStart,
  onRetryBuild,
}: SpotlightChatProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isBuilding = phase === "building" || phase === "delivered";

  // Auto-scroll to bottom when new messages arrive or typing indicator shows
  useEffect(() => {
    // Use rAF to ensure DOM has updated before scrolling
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }
    });
  }, [messages.length, isWaitingForExpert]);

  return (
    <div className="flex flex-col h-full">
      {/* Active expert header */}
      {activeExpert && (
        <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-[#E8E5DF] bg-white/80 backdrop-blur-md">
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
              <span
                className={activeExpert.confidence >= 0.8 ? "text-[#81B29A]" : activeExpert.confidence >= 0.5 ? "text-[#E8A838]" : "text-[#6A6763]"}
                title={`Confidence: ${Math.round(activeExpert.confidence * 100)}% — increases as you discuss requirements`}
              >
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
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-[#E8E5DF] bg-white/60">
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
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full animate-fade-in">
            <div className="text-center text-muted-foreground max-w-xs space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E07A5F]/8 flex items-center justify-center border border-[#E07A5F]/10 animate-pulse-glow">
                <img src="/logo.png" alt="" className="w-8 h-8 opacity-60" />
              </div>
              <p className="text-sm font-semibold text-foreground/80">Your expert committee awaits</p>
              <p className="text-xs leading-relaxed text-muted-foreground/60">
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
          <ThinkingIndicator phase={phase} activeExpert={activeExpert} experts={experts} />
        )}
      </div>

      {/* Input area */}
      <div className="flex-none border-t border-[#E8E5DF] p-4 bg-white/60">
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
  { label: "Idea", icon: "💡", question: "What's your app idea?" },
  { label: "Users", icon: "👥", question: "Who are your users?" },
  { label: "Actions", icon: "⚡", question: "What can users do?" },
  { label: "Success", icon: "🎯", question: "What does success look like?" },
  { label: "Scope", icon: "📐", question: "What's in/out of scope?" },
];

function InterviewProgress({ messages }: { messages: ClowderMessage[] }) {
  // Count user messages to determine progress
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const step = Math.min(userMsgCount, INTERVIEW_STEPS.length);
  const currentStep = INTERVIEW_STEPS[step];

  return (
    <div className="mx-4 my-3 rounded-xl bg-card/50 border border-border/50 p-3 space-y-2.5">
      {/* Progress bar */}
      <div className="flex items-center gap-0">
        {INTERVIEW_STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1 relative z-10">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                  i < step
                    ? "bg-[#E07A5F]/10 border-2 border-[#E07A5F] text-[#E07A5F]"
                    : i === step
                      ? "bg-[#E07A5F]/5 border-2 border-[#E07A5F]/60 text-[#E07A5F]/80 animate-pulse"
                      : "bg-[#F4F1EB] border border-[#E8E5DF] text-muted-foreground/30"
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
                    ? "text-[#E07A5F]"
                    : i === step
                      ? "text-[#E07A5F]/60"
                      : "text-muted-foreground/30"
                }`}
              >
                {s.label}
              </span>
            </div>
            {/* Connecting line */}
            {i < INTERVIEW_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mt-[-14px] ${
                i < step ? "bg-[#E07A5F]/30" : "bg-[#E8E5DF]"
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

const THINKING_MESSAGES: Record<string, string[]> = {
  interviewing: [
    "Preparing your next question…",
    "Reviewing your responses…",
    "Refining the conversation…",
  ],
  ideating: [
    "Analyzing your requirements…",
    "Reviewing technical feasibility…",
    "Evaluating design patterns…",
    "Considering edge cases…",
    "Mapping user workflows…",
  ],
  planning: [
    "Drafting the build plan…",
    "Selecting optimal architecture…",
    "Planning database schema…",
  ],
};

function ThinkingIndicator({
  phase,
  activeExpert,
  experts,
}: {
  phase: string;
  activeExpert?: ClowderExpert;
  experts: ClowderExpert[];
}) {
  const [msgIndex, setMsgIndex] = useState(0);
  const pool = THINKING_MESSAGES[phase] ?? THINKING_MESSAGES.ideating;

  useEffect(() => {
    setMsgIndex(0);
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % pool.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [pool.length]);

  const prefix = activeExpert
    ? `${activeExpert.name}: `
    : experts.length > 0
      ? ""
      : "";

  const displayMsg = experts.length === 0
    ? "Assembling your expert team…"
    : `${prefix}${pool[msgIndex]}`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 mx-3 rounded-xl glass-card animate-fade-in">
      <div className="flex gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-xs text-muted-foreground/80 transition-opacity duration-500">
        {displayMsg}
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
    building: { label: "Building", color: "text-[#81B29A]", bg: "bg-[#81B29A]/10 border-[#81B29A]/20" },
    delivered: { label: "Delivered", color: "text-[#81B29A]", bg: "bg-[#81B29A]/10 border-[#81B29A]/20" },
  };
  const { label, color, bg } = phaseLabels[phase] ?? { label: phase, color: "text-muted-foreground", bg: "bg-zinc-400/10 border-zinc-400/20" };

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${color} ${bg}`}>
      {label}
    </span>
  );
}

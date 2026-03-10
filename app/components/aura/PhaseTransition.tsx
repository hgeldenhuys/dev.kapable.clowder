"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Phase transition overlay — shows a brief animated banner when the session phase changes.
 * Provides visual feedback that something important happened (T8).
 */

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  assembling: {
    label: "Assembling your expert team",
    color: "text-[#E8A838]",
    bg: "from-[#E8A838]/15 via-transparent to-transparent",
    icon: "⚡",
  },
  ideating: {
    label: "Experts are discussing your idea",
    color: "text-[#5B8FB9]",
    bg: "from-[#5B8FB9]/15 via-transparent to-transparent",
    icon: "💭",
  },
  planning: {
    label: "Creating your app plan",
    color: "text-[#9B6B8E]",
    bg: "from-[#9B6B8E]/15 via-transparent to-transparent",
    icon: "📋",
  },
  building: {
    label: "Building your app",
    color: "text-accent",
    bg: "from-accent/15 via-transparent to-transparent",
    icon: "🔨",
  },
  delivered: {
    label: "Your app is live!",
    color: "text-accent",
    bg: "from-accent/20 via-accent/8 to-transparent",
    icon: "🎉",
  },
};

interface PhaseTransitionProps {
  phase: string;
}

export function PhaseTransition({ phase }: PhaseTransitionProps) {
  const [visible, setVisible] = useState(false);
  const [displayPhase, setDisplayPhase] = useState("");
  const prevPhaseRef = useRef(phase);
  const initialRender = useRef(true);

  useEffect(() => {
    // Don't animate on initial render
    if (initialRender.current) {
      initialRender.current = false;
      prevPhaseRef.current = phase;
      return;
    }

    // Only animate when phase actually changes
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;

    setDisplayPhase(phase);
    setVisible(true);

    // Delivered gets a longer celebration moment
    const duration = phase === "delivered" ? 5000 : 2500;
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [phase]);

  const config = PHASE_CONFIG[displayPhase];
  if (!config || !visible) return null;

  const isDelivered = displayPhase === "delivered";

  return (
    <div
      className={`absolute inset-x-0 top-0 z-20 pointer-events-none transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className={`bg-gradient-to-b ${config.bg} py-3 px-4 text-center relative overflow-hidden`}>
        {/* Celebration glow burst for delivered */}
        {isDelivered && (
          <div className="absolute inset-0 animate-pulse-glow">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/8 to-transparent" />
          </div>
        )}
        <div className="flex items-center justify-center gap-2 relative z-10">
          <span className={isDelivered ? "text-2xl animate-bounce" : "text-lg"}>{config.icon}</span>
          <span className={`${isDelivered ? "text-base font-bold" : "text-sm font-medium"} ${config.color}`}>
            {config.label}
          </span>
          {isDelivered && <span className="text-2xl animate-bounce" style={{ animationDelay: "200ms" }}>🚀</span>}
        </div>
      </div>
    </div>
  );
}

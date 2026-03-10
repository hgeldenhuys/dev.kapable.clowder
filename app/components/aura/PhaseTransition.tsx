"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Phase transition overlay — shows a brief animated banner when the session phase changes.
 * Provides visual feedback that something important happened (T8).
 */

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  assembling: {
    label: "Assembling your expert team",
    color: "text-yellow-300",
    bg: "from-yellow-500/20 via-transparent to-transparent",
    icon: "⚡",
  },
  ideating: {
    label: "Experts are discussing your idea",
    color: "text-blue-300",
    bg: "from-blue-500/20 via-transparent to-transparent",
    icon: "💭",
  },
  planning: {
    label: "Creating your app plan",
    color: "text-purple-300",
    bg: "from-purple-500/20 via-transparent to-transparent",
    icon: "📋",
  },
  building: {
    label: "Building your app",
    color: "text-green-300",
    bg: "from-green-500/20 via-transparent to-transparent",
    icon: "🔨",
  },
  delivered: {
    label: "Your app is live!",
    color: "text-emerald-300",
    bg: "from-emerald-500/30 via-transparent to-transparent",
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

    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [phase]);

  const config = PHASE_CONFIG[displayPhase];
  if (!config || !visible) return null;

  return (
    <div
      className={`absolute inset-x-0 top-0 z-20 pointer-events-none transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className={`bg-gradient-to-b ${config.bg} py-3 px-4 text-center`}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>
    </div>
  );
}

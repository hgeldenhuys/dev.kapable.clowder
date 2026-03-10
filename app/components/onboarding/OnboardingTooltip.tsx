"use client";

import { useState, useEffect } from "react";

const ONBOARDING_KEY = "clowder_onboarding_seen";

const STEPS = [
  {
    title: "Describe your app",
    description: "Tell your expert team what you want to build. Be as detailed or as vague as you like.",
    icon: "💡",
  },
  {
    title: "Meet your experts",
    description: "AI specialists interview you to understand your vision — strategy, design, architecture.",
    icon: "👥",
  },
  {
    title: "Watch it build",
    description: "Your team synthesizes a plan, provisions infrastructure, and deploys your app live.",
    icon: "🚀",
  },
];

/**
 * First-time onboarding tooltip — shows a 3-step tour on the home page.
 * Stores completion in localStorage so it only appears once.
 */
export function OnboardingTooltip() {
  const [step, setStep] = useState(-1); // -1 = not started / already seen

  useEffect(() => {
    // Only show on client, only if not seen
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      // Delay slightly so page content loads first
      const timer = setTimeout(() => setStep(0), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  if (step < 0 || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function advance() {
    if (isLast) {
      localStorage.setItem(ONBOARDING_KEY, "true");
      setStep(-1);
    } else {
      setStep(step + 1);
    }
  }

  function dismiss() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setStep(-1);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 max-w-[85vw] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl bg-card border border-border shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-4 pt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors ${
                i <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{current.icon}</span>
            <h3 className="text-sm font-semibold text-foreground">{current.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button
            type="button"
            onClick={dismiss}
            className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={advance}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20"
          >
            {isLast ? "Got it!" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

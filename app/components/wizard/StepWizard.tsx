import { useEffect, useState } from "react";
import { StepIndicator } from "./StepIndicator";

interface StepWizardProps {
  step: 1 | 2 | 3;
  onNext: () => void;
  onBack: () => void;
  children: React.ReactNode;
  canProceed?: boolean;
  nextLabel?: string;
}

export function StepWizard({
  step,
  onNext,
  onBack,
  children,
  canProceed = true,
  nextLabel,
}: StepWizardProps) {
  const labels: [string, string, string] = [
    "Describe",
    "Assemble",
    "Build",
  ];

  const defaultNextLabel = step === 1 ? "Continue →" : step === 2 ? "Start Building →" : "";

  // Detect Mac vs other platform (client-only to avoid hydration mismatch)
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac/.test(navigator.userAgent));
  }, []);

  // Cmd/Ctrl+Enter keyboard shortcut to proceed
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canProceed && step < 3) {
        e.preventDefault();
        onNext();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onNext, canProceed, step]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <StepIndicator currentStep={step} labels={labels} />
      <div className="relative overflow-hidden">
        <div
          className="transition-all duration-400 ease-in-out"
          style={{
            opacity: 1,
          }}
        >
          {children}
        </div>
      </div>
      {step < 3 && (
        <div className="flex items-center justify-between mt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 text-sm font-medium text-muted-foreground/60 hover:text-foreground transition-colors rounded-xl hover:bg-card/40"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={onNext}
              disabled={!canProceed}
              className="hero-cta px-7 py-3 font-semibold text-base text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-95 hover:scale-[1.02] active:scale-[0.98]"
            >
              {nextLabel || defaultNextLabel}
            </button>
            <span className="text-[10px] text-muted-foreground/40">
              {isMac ? "⌘" : "Ctrl"}+Enter
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

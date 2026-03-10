import { useEffect, useState } from "react";
import { StepIndicator } from "./StepIndicator";
import { Button } from "~/components/ui/button";

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

  const defaultNextLabel = step === 1 ? "Build my team \u2192" : step === 2 ? "Start Building \u2192" : "";

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
        <div className={`flex items-center mt-5 ${step > 1 ? 'justify-between' : 'justify-center'}`}>
          {step > 1 && (
            <Button variant="ghost" onClick={onBack}>
              ← Back
            </Button>
          )}
          <div className="flex flex-col items-center gap-1.5">
            <Button
              size="lg"
              onClick={canProceed ? onNext : undefined}
              disabled={!canProceed}
              className={canProceed
                ? "hero-cta px-8 py-3.5 font-bold text-lg text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] animate-slide-in-cta"
                : "hero-cta px-8 py-3.5 font-bold text-lg text-white cursor-not-allowed transition-all duration-300 grayscale opacity-50 shadow-md"
              }
              title={!canProceed ? "Enter a name and 20+ word description to continue" : undefined}
            >
              {nextLabel || defaultNextLabel}
            </Button>
            <span className="text-[11px] text-stone-500 font-medium">
              {canProceed
                ? <span className="hidden sm:inline">{isMac ? "⌘" : "Ctrl"}+Enter</span>
                : <span>Enter a name and 20+ word description to get started</span>
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

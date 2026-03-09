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
        <div className="flex items-center justify-between mt-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {nextLabel || defaultNextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

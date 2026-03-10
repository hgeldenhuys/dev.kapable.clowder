interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  labels: [string, string, string];
}

const STEP_ICONS = ["✦", "⚡", "🚀"];

export function StepIndicator({ currentStep, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-5">
      {labels.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <div className="w-16 h-px mx-1">
                <div
                  className={`h-full transition-all duration-500 ${
                    isCompleted
                      ? "bg-gradient-to-r from-accent/40 to-primary/40"
                      : "bg-border"
                  }`}
                />
              </div>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : isActive
                      ? "bg-primary/15 text-primary border border-primary/40 shadow-lg shadow-primary/15 animate-pulse-glow"
                      : "bg-secondary text-muted-foreground/50 border border-border"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-xs">{STEP_ICONS[i]}</span>
                )}
              </div>
              <span
                className={`text-[11px] font-semibold tracking-wide transition-colors duration-300 ${
                  isCompleted
                    ? "text-accent"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground/40"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

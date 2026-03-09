interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  labels: [string, string, string];
}

export function StepIndicator({ currentStep, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {labels.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;
        const isUpcoming = step > currentStep;

        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-12 h-0.5 transition-colors duration-300 ${
                  isCompleted ? "bg-green-500" : "bg-zinc-700"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? "bg-green-500/20 text-green-400 border border-green-500/40"
                    : isActive
                      ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                }`}
              >
                {isCompleted ? "✓" : step}
              </div>
              <span
                className={`text-sm font-medium transition-colors duration-300 ${
                  isCompleted
                    ? "text-green-400"
                    : isActive
                      ? "text-indigo-400"
                      : "text-zinc-500"
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

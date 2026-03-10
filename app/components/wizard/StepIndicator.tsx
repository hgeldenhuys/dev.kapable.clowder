interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  labels: [string, string, string];
}

const STEP_SUBTITLES = [
  "Tell us your idea",
  "AI experts form your team",
  "Deploy in minutes",
];

const STEP_ICONS = [
  <svg key="describe" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  <svg key="assemble" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  <svg key="build" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
];

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
              <div className="w-16 h-0.5 mx-1 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isCompleted
                      ? "bg-gradient-to-r from-accent to-primary w-full"
                      : "w-0"
                  }`}
                />
              </div>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? "bg-accent/20 text-accent border-2 border-accent/50 shadow-sm shadow-accent/10"
                    : isActive
                      ? "bg-primary/20 text-primary border-2 border-primary/60 shadow-lg shadow-primary/20 animate-pulse-glow"
                      : "bg-secondary text-muted-foreground/50 border border-border"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  STEP_ICONS[i]
                )}
              </div>
              <span
                className={`text-xs font-semibold tracking-wide transition-colors duration-300 ${
                  isCompleted
                    ? "text-accent"
                    : isActive
                      ? "text-primary font-bold"
                      : "text-muted-foreground/60"
                }`}
              >
                {label}
              </span>
              <span className="hidden sm:block text-[10px] text-muted-foreground/60 leading-tight">{STEP_SUBTITLES[i]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

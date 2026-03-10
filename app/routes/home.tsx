import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Link, redirect, useSubmit } from "react-router";
import type { Route } from "./+types/home";
import { createClowderSession, listClowderSessions, sendClowderMessage } from "~/lib/api.server";
import { orchestrate } from "~/lib/orchestrator.server";
import { writeVaultFile, sessionVaultPath } from "~/lib/vault.server";
import { buildContextMarkdown } from "~/lib/context.server";
import type { ContextTeamMember } from "~/lib/context.server";
import { StepWizard } from "~/components/wizard/StepWizard";
import { Step1Context, isStep1Valid } from "~/components/wizard/Step1Context";
import type { Step1Data } from "~/components/wizard/Step1Context";
import { Step2Assembly } from "~/components/wizard/Step2Assembly";
import type { Specialist } from "~/components/wizard/Step2Assembly";
import { useTypeheadStream } from "~/hooks/useTypeheadStream";
import { Card, CardContent } from "~/components/ui/card";
import { NavBar } from "~/components/nav/NavBar";
// OnboardingTooltip removed — page is self-explanatory, tooltip was redundant

export async function loader() {
  const sessions = await listClowderSessions();
  return { sessions };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return { error: "Please describe your app idea" };
  }

  // Parse specialist team from form data (JSON array)
  const specialistsJson = String(formData.get("specialists") ?? "[]");
  let specialists: Array<{ type: string; name: string; confidence: number; reason?: string }> = [];
  try {
    specialists = JSON.parse(specialistsJson);
  } catch {
    // Invalid JSON — proceed with empty specialists
  }

  const session = await createClowderSession({ name: name || undefined, description });

  // Build team for context document
  const team: ContextTeamMember[] = [
    { name: "Strategist", role: "core" },
    { name: "Designer", role: "core" },
    { name: "Architect", role: "core" },
  ];
  for (const s of specialists) {
    team.push({
      name: s.name || s.type,
      role: "specialist",
      confidence: s.confidence,
      reason: s.reason,
    });
  }

  // Create initial context document in Vault (best-effort, non-blocking)
  const contextMd = buildContextMarkdown({
    appName: name || "Untitled App",
    description,
    files: [],
    team,
    interviews: [],
  });
  writeVaultFile(sessionVaultPath(session.id, "context.md"), contextMd).catch((e) => {
    console.error("Failed to create initial context doc:", e);
  });

  // Auto-send the description as the first user message so experts respond immediately
  await sendClowderMessage(session.id, { content: description, role: "user" });
  orchestrate(session.id).catch((e) => {
    console.error("Orchestrator error on session create:", e);
  });

  return redirect(`/session/${session.id}`);
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const phaseColors: Record<string, string> = {
  assembling: "text-[#E8A838]",
  ideating: "text-[#5B8FB9]",
  planning: "text-[#9B6B8E]",
  building: "text-accent",
  delivered: "text-accent",
};

const phaseBorderColors: Record<string, string> = {
  assembling: "var(--phase-assembling)",
  ideating: "var(--phase-ideating)",
  planning: "var(--phase-planning)",
  building: "var(--phase-building)",
  delivered: "var(--phase-delivered)",
};

const phaseLabels: Record<string, string> = {
  assembling: "Assembling",
  ideating: "Ideating",
  planning: "Planning",
  building: "Building",
  delivered: "Delivered",
};

interface PredictedSpecialist {
  domain: string;
  confidence: number;
  reason: string;
}

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { sessions } = loaderData;
  const submit = useSubmit();
  const wizardRef = useRef<HTMLDivElement>(null);

  const scrollToWizard = useCallback(() => {
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Step wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [step1Data, setStep1Data] = useState<Step1Data>({
    appName: "",
    description: "",
    files: [],
  });

  // Specialist prediction state (used in both Step 1 preview + Step 2)
  const [specialists, setSpecialists] = useState<PredictedSpecialist[]>([]);
  const [predicting, setPredicting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWordCountRef = useRef(0);

  // Step 2 specialists (confirmed team, derived from predictions + typehead)
  const [step2Specialists, setStep2Specialists] = useState<Specialist[]>([]);
  const [typeheadRunId, setTypeheadRunId] = useState<string | null>(null);
  const [typeheadFlowId, setTypeheadFlowId] = useState<string | null>(null);
  const [typeheadLoading, setTypeheadLoading] = useState(false);
  const [typeheadTimedOut, setTypeheadTimedOut] = useState(false);
  const typeheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance timer for Step 2
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const autoAdvanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelAutoAdvance = useCallback(() => {
    setAutoAdvanceCountdown(null);
    if (autoAdvanceIntervalRef.current) {
      clearInterval(autoAdvanceIntervalRef.current);
      autoAdvanceIntervalRef.current = null;
    }
  }, []);

  // Typehead SSE stream
  useTypeheadStream({
    runId: typeheadRunId,
    flowId: typeheadFlowId,
    onSpecialistFound: useCallback((specialist) => {
      setStep2Specialists((prev) => {
        // Don't add duplicates
        if (prev.some((s) => s.type === specialist.type)) return prev;
        return [...prev, specialist];
      });
    }, []),
    onComplete: useCallback(() => {
      setTypeheadLoading(false);
      if (typeheadTimeoutRef.current) clearTimeout(typeheadTimeoutRef.current);
    }, []),
    onError: useCallback((error: string) => {
      console.error("Typehead stream error:", error);
      setTypeheadLoading(false);
      toast.error("Team analysis failed. Proceeding with suggested team.");
    }, []),
  });

  // Start auto-advance countdown when typehead loading finishes on Step 2
  const handleConfirmTeamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (currentStep === 2 && !typeheadLoading && autoAdvanceCountdown === null && !autoAdvanceIntervalRef.current) {
      setAutoAdvanceCountdown(5);
      autoAdvanceIntervalRef.current = setInterval(() => {
        setAutoAdvanceCountdown((prev) => {
          if (prev === null || prev <= 1) {
            // Timer reached 0 — auto-advance
            if (autoAdvanceIntervalRef.current) {
              clearInterval(autoAdvanceIntervalRef.current);
              autoAdvanceIntervalRef.current = null;
            }
            // Use a timeout to call handleConfirmTeam outside the setState
            setTimeout(() => {
              handleConfirmTeamRef.current?.();
            }, 0);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    // Cancel auto-advance if user navigates away from step 2
    if (currentStep !== 2) {
      cancelAutoAdvance();
    }
  }, [currentStep, typeheadLoading, cancelAutoAdvance, autoAdvanceCountdown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      if (typeheadTimeoutRef.current) clearTimeout(typeheadTimeoutRef.current);
      if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
    };
  }, []);

  const predictExperts = useCallback(async (text: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPredicting(true);
    try {
      const res = await fetch("/api/predict-experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        toast.error("Expert prediction failed. Try adding more detail.");
        return;
      }
      const data = await res.json() as { specialists: PredictedSpecialist[] };
      if (!controller.signal.aborted) {
        setSpecialists(data.specialists ?? []);
      }
    } catch (e) {
      // Aborted requests are expected — only toast on real errors
      if (!controller.signal.aborted) {
        toast.error("Could not reach expert prediction service.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setPredicting(false);
      }
    }
  }, []);

  // Trigger predict-experts on description changes
  const handleStep1Change = useCallback(
    (data: Step1Data) => {
      setStep1Data(data);

      const words = data.description.trim().split(/\s+/).filter(Boolean).length;
      const wordBoundary = Math.floor(words / 3);
      const lastBoundary = Math.floor(lastWordCountRef.current / 3);
      lastWordCountRef.current = words;

      if (wordBoundary > lastBoundary && words >= 3) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          predictExperts(data.description);
        }, 300);
      }

      if (words < 3) {
        setSpecialists([]);
      }
    },
    [predictExperts],
  );

  // Advance to Step 2 — seed specialists from predict-experts and trigger typehead flow
  const handleGoToStep2 = useCallback(async () => {
    // Seed with predict-experts results first (instant)
    const seeded = specialists.map((s) => ({
      type: s.domain,
      name: s.domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Specialist",
      confidence: s.confidence,
      reason: s.reason,
    }));
    setStep2Specialists(seeded);

    // Auto-skip Step 2 if no specialists found and description is rich enough (>= 200 words)
    const wordCount = step1Data.description.trim().split(/\s+/).filter(Boolean).length;
    if (specialists.length === 0 && wordCount >= 200) {
      // No specialists to review — skip straight to session creation
      handleConfirmTeam();
      return;
    }

    setCurrentStep(2);

    // Trigger typehead flow for more accurate specialist prediction
    setTypeheadLoading(true);
    setTypeheadTimedOut(false);

    // 30s timeout — proceed with current team if typehead doesn't complete
    typeheadTimeoutRef.current = setTimeout(() => {
      setTypeheadLoading(false);
      setTypeheadTimedOut(true);
    }, 30000);

    try {
      const res = await fetch("/api/clowder-typehead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: step1Data.appName,
          description: step1Data.description,
          file_summaries: step1Data.files
            .filter((f) => f.status === "done" && f.type === "text")
            .map((f) => f.name),
        }),
      });

      if (res.ok) {
        const data = await res.json() as { runId: string; flowId: string };
        setTypeheadRunId(data.runId);
        setTypeheadFlowId(data.flowId);
      } else {
        // Typehead unavailable — auto-skip Step 2 and proceed directly to session creation.
        // The seeded specialists from predict-experts are sufficient.
        setTypeheadLoading(false);
        if (typeheadTimeoutRef.current) clearTimeout(typeheadTimeoutRef.current);
        const formData = new FormData();
        formData.set("name", step1Data.appName);
        formData.set("description", step1Data.description);
        formData.set("specialists", JSON.stringify(seeded));
        submit(formData, { method: "post", action: "?index" });
        return;
      }
    } catch {
      // Typehead fetch failed — auto-skip Step 2 and proceed directly to session creation.
      // The seeded specialists from predict-experts are sufficient.
      setTypeheadLoading(false);
      if (typeheadTimeoutRef.current) clearTimeout(typeheadTimeoutRef.current);
      const formData = new FormData();
      formData.set("name", step1Data.appName);
      formData.set("description", step1Data.description);
      formData.set("specialists", JSON.stringify(seeded));
      submit(formData, { method: "post", action: "?index" });
      return;
    }
  }, [specialists, step1Data, submit]);

  // Remove a specialist from Step 2
  const handleRemoveSpecialist = useCallback((type: string) => {
    setStep2Specialists((prev) => prev.filter((s) => s.type !== type));
  }, []);

  // Step 2 confirm → create session via form submit (includes specialist team)
  const handleConfirmTeam = useCallback(() => {
    cancelAutoAdvance();
    const formData = new FormData();
    formData.set("name", step1Data.appName);
    formData.set("description", step1Data.description);
    formData.set("specialists", JSON.stringify(step2Specialists));
    submit(formData, { method: "post", action: "?index" });
  }, [step1Data, step2Specialists, submit, cancelAutoAdvance]);

  // Keep ref in sync for auto-advance timer callback
  useEffect(() => {
    handleConfirmTeamRef.current = handleConfirmTeam;
  }, [handleConfirmTeam]);

  return (
    <main className="min-h-screen flex flex-col overflow-x-hidden">
      <NavBar />
      {/* Hero + Wizard — combined for zero-scroll-to-input */}
      <section ref={wizardRef} className="relative flex flex-col items-center px-6 sm:px-8 pt-6 sm:pt-10 pb-8 overflow-hidden">
        {/* Animated gradient background */}
        <div className="hero-gradient absolute inset-0 -z-10" />

        {/* Floating orb accents — warm palette */}
        <div className="absolute top-20 left-[15%] w-32 h-32 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-24 right-[10%] w-40 h-40 rounded-full bg-accent/5 blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 right-[25%] w-24 h-24 rounded-full bg-[#E8A838]/5 blur-2xl animate-float-slow" />

        {/* Branding — compact */}
        <div className="text-center space-y-3 max-w-3xl mx-auto mb-6 animate-fade-in">
          <div className="flex items-center justify-center gap-2.5">
            <img
              src="/logo.png"
              alt="Clowder"
              className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-lg"
            />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <span className="bg-gradient-to-r from-[#E07A5F] via-[#D16B50] to-[#C25D43] bg-clip-text text-transparent animate-gradient">
                Clowder
              </span>
            </h1>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground leading-tight max-w-lg mx-auto">
            Describe your app.{" "}
            <span className="bg-gradient-to-r from-[#E07A5F] to-[#5B9A7F] bg-clip-text text-transparent">We'll build it.</span>
          </h2>

          <div className="flex items-center justify-center flex-wrap gap-3 gap-y-1 text-sm text-stone-500">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-accent" />
              No signup
            </span>
            <span className="opacity-60">·</span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Free to use
            </span>
            <span className="opacity-60">·</span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Deploys in minutes
            </span>
          </div>
        </div>

        {/* Wizard — immediately below branding */}
        <div className="w-full max-w-4xl px-4 sm:px-0 text-center space-y-6 sm:space-y-8 relative z-10">

        <Card className="glass-card rounded-3xl border-border/50 shadow-xl"><CardContent className="p-6 sm:p-8">
        <StepWizard
          step={currentStep}
          onNext={currentStep === 1 ? handleGoToStep2 : handleConfirmTeam}
          onBack={() => { cancelAutoAdvance(); setCurrentStep(1); }}
          canProceed={
            currentStep === 1
              ? isStep1Valid(step1Data)
              : !typeheadLoading
          }
        >
          {currentStep === 1 && (
            <Step1Context
              data={step1Data}
              onChange={handleStep1Change}
            >
              {/* Specialist preview chips */}
              {specialists.length > 0 && (
                <div className="space-y-3 mt-6 p-4 rounded-2xl bg-card/60 border border-border/40 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-[11px] text-stone-500 text-center font-medium">
                    Your AI team is forming — confirmed in next step
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {specialists.map((s, index) => (
                      <span
                        key={s.domain}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border bg-orange-50 text-orange-700 border-orange-200 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards"
                        style={{ opacity: Math.max(0.5, s.confidence), animationDelay: `${index * 80}ms` }}
                        title={s.reason}
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400" />
                        {s.domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    ))}
                    {predicting && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-[11px] text-stone-400 animate-pulse">
                        <span className="w-1 h-1 rounded-full bg-orange-400" />
                        analyzing...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Step1Context>
          )}

          {currentStep === 2 && (
            <>
              <Step2Assembly
                appName={step1Data.appName}
                specialists={step2Specialists}
                loading={typeheadLoading}
                onRemoveSpecialist={handleRemoveSpecialist}
              />
              {typeheadTimedOut && (
                <p className="text-xs text-[color:var(--warning)] text-center mt-2">
                  Team prediction timed out. Proceeding with current team.
                </p>
              )}
              {autoAdvanceCountdown !== null && (
                <button
                  type="button"
                  onClick={cancelAutoAdvance}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs text-stone-500 hover:text-foreground bg-card/60 hover:bg-card/80 border border-border/40 hover:border-border/50 transition-all duration-200 mx-auto block cursor-pointer"
                >
                  Auto-starting in {autoAdvanceCountdown}s... (click to review team)
                </button>
              )}
            </>
          )}
        </StepWizard>

        {/* Powered by badge */}
        <div className="flex items-center justify-center gap-2 mt-4 opacity-85 hover:opacity-100 transition-opacity">
          <span className="text-xs text-stone-500">Powered by</span>
          <a href="https://kapable.dev" target="_blank" rel="noopener noreferrer" className="text-[10px] text-stone-500 font-semibold hover:text-primary transition-colors">
            Kapable
          </a>
        </div>
        </CardContent></Card>

        {/* How it works — 3-step explainer */}
        <div id="how-it-works" className="mt-12 mb-4 scroll-mt-20 w-full">
          <h3 className="text-sm font-semibold text-stone-600 text-center mb-8 uppercase tracking-wider">
            How it works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E07A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-stone-700">Describe your idea</p>
              <p className="text-xs text-stone-500 leading-relaxed max-w-[200px]">
                Tell us what you want to build in plain English. No technical knowledge needed.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E07A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-stone-700">AI experts refine it</p>
              <p className="text-xs text-stone-500 leading-relaxed max-w-[200px]">
                A team of specialist agents interviews you, asks smart questions, and shapes the spec.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E07A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-stone-700">App deploys live</p>
              <p className="text-xs text-stone-500 leading-relaxed max-w-[200px]">
                Your app is built, deployed, and accessible at its own URL — in minutes, not months.
              </p>
            </div>
          </div>
        </div>

        {/* Section divider — community area */}
        {sessions.length > 0 && (
          <div id="community" className="flex items-center gap-4 mt-10 mb-2 scroll-mt-16">
            <div className="flex-1 h-px bg-border/30" />
            <span className="text-xs text-stone-500 uppercase tracking-widest font-medium">Community</span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
        )}

        {/* Social proof — always visible */}
        {sessions.length > 0 && (
          <div className="space-y-4 mt-4 mb-4">
            {/* Stats row — only show when volume is impressive */}
            {sessions.length >= 50 && (
              <div className="flex items-center justify-center gap-6 sm:gap-8">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{sessions.length}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Apps Built</p>
                </div>
                <div className="w-px h-10 bg-border/40" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{sessions.filter(s => s.phase === 'delivered').length}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Deployed</p>
                </div>
              </div>
            )}
            {/* Pulse showcase link */}
            <a
              href="https://pulse.kapable.run"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/60 border border-border/40 shadow-lg hover:bg-orange-50 hover:border-orange-300 hover:shadow-xl transition-all group mx-auto max-w-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs font-semibold text-stone-600 group-hover:text-foreground transition-colors">
                  See Pulse — built in 10 minutes
                </p>
                <p className="text-[10px] text-stone-500 leading-snug">
                  A real-time feedback app, built and deployed by Clowder
                </p>
              </div>
              <span className="text-stone-400 group-hover:text-primary/60 transition-colors ml-auto flex-none">&#8599;</span>
            </a>
          </div>
        )}

        {/* Recent Sessions */}
        <div className="mt-8 text-left space-y-5">
          {sessions.length > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-stone-600 tracking-tight">
                  Your Apps
                </h2>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[11px] text-stone-500 font-medium">{sessions.length} apps</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
                {sessions.slice(0, 6).map((s) => (
                  <Link
                    key={s.id}
                    to={`/session/${s.id}`}
                    className="session-card block p-3 sm:p-4 rounded-2xl border border-border/40 bg-card hover:bg-orange-50 hover:border-orange-300 shadow-lg hover:shadow-xl hover:-translate-y-1.5 cursor-pointer transition-all duration-300 group border-l-3"
                    style={{ borderLeftColor: phaseBorderColors[s.phase] ?? "#9B9B9B" }}
                  >
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <span className="text-sm font-medium text-stone-600 group-hover:text-foreground transition-colors min-w-0 line-clamp-2">
                        {s.name}
                      </span>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-none">
                        {s.phase === "delivered" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary/8 text-primary/70 border border-primary/15">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                            AI Built
                          </span>
                        )}
                        <span className={`text-[11px] font-bold uppercase tracking-wider whitespace-nowrap px-2.5 py-1 rounded-full border ${
                          s.phase === "delivered"
                            ? "bg-accent/10 text-accent border-accent/20"
                            : s.phase === "building"
                              ? "bg-accent/10 text-accent border-accent/20 animate-pulse"
                              : s.phase === "planning"
                                ? "bg-[#9B6B8E]/10 text-[#9B6B8E] border-[#9B6B8E]/20"
                                : s.phase === "ideating"
                                  ? "bg-[#5B8FB9]/10 text-[#5B8FB9] border-[#5B8FB9]/20"
                                  : "bg-[#E8A838]/10 text-[#E8A838] border-[#E8A838]/20"
                        }`}>
                          {phaseLabels[s.phase] ?? s.phase}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-stone-500" suppressHydrationWarning>
                        {relativeTime(s.created_at)}
                      </p>
                      {s.app_url && (
                        <a
                          href={s.app_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-accent/60 hover:text-accent hover:underline font-medium transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open app &#8599;
                        </a>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-60">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.636 5.636l2.121 2.121M16.243 16.243l2.121 2.121M5.636 18.364l2.121-2.121M16.243 7.757l2.121-2.121"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
              <p className="text-sm text-stone-500 font-medium">No apps yet</p>
              <p className="text-xs text-stone-400 mt-1">Describe your first idea above to get started</p>
            </div>
          )}
        </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10 px-6 sm:px-8 mt-auto bg-secondary/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Clowder" className="w-5 h-5 opacity-60" />
              <span className="text-[11px] text-stone-500">
                Clowder by{" "}
                <a href="https://kapable.dev" target="_blank" rel="noopener noreferrer" className="hover:text-primary/70 transition-colors underline-offset-2 hover:underline">
                  Kapable
                </a>{" "}
                · &copy; 2026
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-[11px] text-stone-500">
              <a href="https://kapable.dev" target="_blank" rel="noopener noreferrer" className="py-3 sm:py-0 hover:text-stone-700 hover:underline transition-colors">About Kapable</a>
              <a href="https://kapable.dev/privacy" target="_blank" rel="noopener noreferrer" className="py-3 sm:py-0 hover:text-stone-700 hover:underline transition-colors">Privacy</a>
              <a href="https://kapable.dev/terms" target="_blank" rel="noopener noreferrer" className="py-3 sm:py-0 hover:text-stone-700 hover:underline transition-colors">Terms</a>
              <div className="flex items-center gap-4 mt-2 sm:mt-0">
                <a href="https://x.com/kapabledev" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="Twitter/X">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://github.com/kapable-dev" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="GitHub">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                </a>
                <a href="https://discord.gg/kapable" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="Discord">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                </a>
              </div>
            </div>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="text-[11px] text-primary hover:underline transition-colors font-medium"
            >
              Build something &#8594;
            </a>
          </div>
        </div>
      </footer>

    </main>
  );
}

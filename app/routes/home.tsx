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

const phaseColors: Record<string, string> = {
  assembling: "text-amber-400",
  ideating: "text-blue-400",
  planning: "text-purple-400",
  building: "text-green-400",
  delivered: "text-emerald-400",
};

const phaseBorderColors: Record<string, string> = {
  assembling: "oklch(0.78 0.16 75)",    // amber
  ideating: "oklch(0.68 0.14 230)",     // blue
  planning: "oklch(0.68 0.18 290)",     // purple
  building: "oklch(0.72 0.17 155)",     // green
  delivered: "oklch(0.72 0.17 165)",    // emerald
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      if (typeheadTimeoutRef.current) clearTimeout(typeheadTimeoutRef.current);
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
        // Typehead not available — proceed with predict-experts results
        setTypeheadLoading(false);
        if (typeheadTimeoutRef.current) clearTimeout(typeheadTimeoutRef.current);
      }
    } catch {
      setTypeheadLoading(false);
      if (typeheadTimeoutRef.current) clearTimeout(typeheadTimeoutRef.current);
    }
  }, [specialists, step1Data]);

  // Remove a specialist from Step 2
  const handleRemoveSpecialist = useCallback((type: string) => {
    setStep2Specialists((prev) => prev.filter((s) => s.type !== type));
  }, []);

  // Step 2 confirm → create session via form submit (includes specialist team)
  const handleConfirmTeam = useCallback(() => {
    const formData = new FormData();
    formData.set("name", step1Data.appName);
    formData.set("description", step1Data.description);
    formData.set("specialists", JSON.stringify(step2Specialists));
    submit(formData, { method: "post", action: "?index" });
  }, [step1Data, step2Specialists, submit]);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero + Wizard — combined for zero-scroll-to-input */}
      <section ref={wizardRef} className="relative flex flex-col items-center px-6 sm:px-8 pt-6 pb-6 overflow-hidden">
        {/* Animated gradient background */}
        <div className="hero-gradient absolute inset-0 -z-10" />

        {/* Floating orb accents — warm palette */}
        <div className="absolute top-20 left-[15%] w-32 h-32 rounded-full bg-primary/8 blur-3xl animate-float" />
        <div className="absolute bottom-24 right-[10%] w-40 h-40 rounded-full bg-amber-500/6 blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 right-[25%] w-24 h-24 rounded-full bg-rose-500/6 blur-2xl animate-float-slow" />

        {/* Branding — compact */}
        <div className="text-center space-y-2.5 max-w-3xl mx-auto mb-4 animate-fade-in">
          <div className="flex items-center justify-center gap-2.5">
            <img
              src="/logo.png"
              alt="Clowder"
              className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-lg"
            />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-purple-300 via-primary to-amber-300 bg-clip-text text-transparent">
                Clowder
              </span>
            </h1>
          </div>

          <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-tight max-w-lg mx-auto">
            Describe your app.{" "}
            <span className="bg-gradient-to-r from-primary via-violet-300 to-amber-300 bg-clip-text text-transparent">We'll build it.</span>
          </h2>

          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/45">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
              No signup
            </span>
            <span className="opacity-20">·</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
              Free to use
            </span>
            <span className="opacity-20">·</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
              Deploys in minutes
            </span>
          </div>
        </div>

        {/* Wizard — immediately below branding */}
        <div className="w-full max-w-2xl text-center space-y-8 relative z-10">

        <StepWizard
          step={currentStep}
          onNext={currentStep === 1 ? handleGoToStep2 : handleConfirmTeam}
          onBack={() => setCurrentStep(1)}
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
                <div className="space-y-3 mt-6 p-4 rounded-2xl bg-card/20 border border-border/10">
                  <p className="text-[11px] text-muted-foreground/50 text-center font-medium">
                    Your AI team is forming — confirmed in next step
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {specialists.map((s) => (
                      <span
                        key={s.domain}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border bg-primary/5 text-primary/80 border-primary/15"
                        style={{ opacity: Math.max(0.5, s.confidence) }}
                        title={s.reason}
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                        {s.domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    ))}
                    {predicting && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-[11px] text-muted-foreground/40 animate-pulse">
                        <span className="w-1 h-1 rounded-full bg-primary/30" />
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
                <p className="text-xs text-yellow-500 text-center mt-2">
                  Team prediction timed out. Proceeding with current team.
                </p>
              )}
            </>
          )}
        </StepWizard>

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div className="mt-12 text-left space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                Your Sessions
              </h2>
              <div className="flex-1 h-px bg-border/20" />
              <span className="text-[10px] text-muted-foreground/30">{sessions.length} total</span>
            </div>
            <div className="space-y-2.5 stagger-children">
              {sessions.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  to={`/session/${s.id}`}
                  className="block p-4 rounded-2xl border border-border/20 bg-card/30 hover:bg-card/50 hover:border-border/40 transition-all duration-300 group border-l-2"
                  style={{ borderLeftColor: phaseBorderColors[s.phase] ?? "oklch(0.4 0.02 285)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors min-w-0 line-clamp-1">
                      {s.name}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider flex-none px-2 py-0.5 rounded-full border ${
                      s.phase === "delivered"
                        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                        : s.phase === "building"
                          ? "bg-green-400/10 text-green-400 border-green-400/20 animate-pulse"
                          : s.phase === "planning"
                            ? "bg-purple-400/10 text-purple-400 border-purple-400/20"
                            : s.phase === "ideating"
                              ? "bg-blue-400/10 text-blue-400 border-blue-400/20"
                              : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                    }`}>
                      {phaseLabels[s.phase] ?? s.phase}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-muted-foreground/40" suppressHydrationWarning>
                      {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {s.app_url && (
                      <span
                        className="text-[11px] text-emerald-400/60 hover:text-emerald-400 font-medium transition-colors"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(s.app_url, "_blank"); }}
                      >
                        Open app ↗
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/5 py-12 px-6 sm:px-8 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Clowder" className="w-5 h-5 opacity-30" />
            <span className="text-[11px] text-muted-foreground/30">
              Clowder by{" "}
              <a href="https://kapable.dev" target="_blank" rel="noopener noreferrer" className="hover:text-primary/60 transition-colors underline-offset-2 hover:underline">
                Kapable
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-muted-foreground/40">
            <a href="https://kapable.dev/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground/50 transition-colors">Privacy</a>
            <a href="https://kapable.dev/terms" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground/50 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

    </main>
  );
}

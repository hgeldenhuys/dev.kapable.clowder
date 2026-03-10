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
  assembling: "text-yellow-400",
  ideating: "text-blue-400",
  planning: "text-purple-400",
  building: "text-green-400",
  delivered: "text-emerald-400",
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
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[70vh] px-8 py-16 overflow-hidden">
        {/* Animated gradient background */}
        <div className="hero-gradient absolute inset-0 -z-10" />

        {/* Floating orb accents */}
        <div className="absolute top-20 left-[15%] w-32 h-32 rounded-full bg-purple-500/10 blur-2xl animate-float" />
        <div className="absolute bottom-24 right-[10%] w-40 h-40 rounded-full bg-blue-500/10 blur-2xl animate-float-delayed" />
        <div className="absolute top-1/2 right-[25%] w-24 h-24 rounded-full bg-primary/10 blur-xl animate-float-slow" />

        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-4">
            <img
              src="/logo.png"
              alt="Clowder"
              className="w-16 h-16 drop-shadow-lg"
            />
            <h1 className="text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-purple-300 via-primary to-blue-400 bg-clip-text text-transparent">
                Clowder
              </span>
            </h1>
          </div>

          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight max-w-xl mx-auto">
            Describe your app.{" "}
            <span className="text-primary">We'll build it.</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed animate-fade-in-up">
            A committee of AI experts designs, builds, and deploys a full-stack web app with database, API, and real-time features.
          </p>

          <div className="flex flex-col items-center gap-4 pt-4">
            <button
              type="button"
              onClick={scrollToWizard}
              className="hero-cta px-8 py-4 rounded-2xl font-semibold text-lg text-white transition-all hover:scale-105"
            >
              Start Building →
            </button>

            <p className="text-sm text-muted-foreground animate-fade-in-up">
              No signup required · Free to use · Deploys in minutes
            </p>
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="flex flex-col items-center px-8 py-12 border-t border-border/20">
        <div className="max-w-4xl w-full space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Built with Clowder</h3>
            <p className="text-sm text-muted-foreground">Real apps, described in plain English, deployed in minutes</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Pulse", desc: "Live feedback board with real-time voting", url: "https://pulse.kapable.run", phase: "delivered" },
              { name: "Event Board", desc: "Community event listing with RSVP tracking", phase: "delivered" },
              { name: "Tool Library", desc: "Neighborhood tool sharing and lending tracker", phase: "delivered" },
            ].map((app) => (
              <div key={app.name} className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-2 hover:bg-card/50 transition-colors">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">{app.name}</h4>
                  <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wide">Live</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{app.desc}</p>
                {app.url && (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-block mt-1"
                  >
                    Visit app →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wizard Section */}
      <section ref={wizardRef} className="flex flex-col items-center px-8 py-12">
        <div className="w-full max-w-2xl text-center space-y-8">

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
                <div className="space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground text-center">
                    Suggested specialists — confirmed in next step
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {specialists.map((s) => (
                      <span
                        key={s.domain}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-zinc-800/50 text-zinc-400 border-zinc-700"
                        style={{ opacity: Math.max(0.4, s.confidence) }}
                        title={s.reason}
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                        {s.domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    ))}
                    {predicting && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground animate-pulse">
                        ...
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
          <div className="mt-8 text-left space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Sessions
            </h2>
            <div className="space-y-2">
              {sessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
                >
                  <Link to={`/session/${s.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">
                        {s.name}
                      </span>
                      <span className={`text-xs font-medium uppercase tracking-wide ${phaseColors[s.phase] ?? "text-muted-foreground"}`}>
                        {s.phase}
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {s.app_url && (
                      <a
                        href={s.app_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Visit app →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 py-8 px-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Clowder" className="w-5 h-5 opacity-60" />
            <span className="text-xs text-muted-foreground/50">
              Clowder by <a href="https://kapable.dev" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Kapable</a>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://kapable.dev/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">Privacy</a>
            <a href="https://kapable.dev/terms" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">Terms</a>
            <span className="text-xs text-muted-foreground/30">Your apps are hosted on Kapable infrastructure</span>
          </div>
        </div>
      </footer>

    </main>
  );
}

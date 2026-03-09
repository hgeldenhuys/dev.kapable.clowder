import { useState, useRef, useCallback, useEffect } from "react";
import { Link, redirect, useSubmit } from "react-router";
import type { Route } from "./+types/home";
import { createClowderSession, listClowderSessions, sendClowderMessage } from "~/lib/api.server";
import { orchestrate } from "~/lib/orchestrator.server";
import { StepWizard } from "~/components/wizard/StepWizard";
import { Step1Context, isStep1Valid } from "~/components/wizard/Step1Context";
import type { Step1Data } from "~/components/wizard/Step1Context";
import { Step2Assembly } from "~/components/wizard/Step2Assembly";
import type { Specialist } from "~/components/wizard/Step2Assembly";

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

  const session = await createClowderSession({ name: name || undefined, description });

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

  // Step wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [step1Data, setStep1Data] = useState<Step1Data>({
    appName: "",
    description: "",
  });

  // Specialist prediction state (used in both Step 1 preview + Step 2)
  const [specialists, setSpecialists] = useState<PredictedSpecialist[]>([]);
  const [predicting, setPredicting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWordCountRef = useRef(0);

  // Step 2 specialists (confirmed team, derived from predictions)
  const [step2Specialists, setStep2Specialists] = useState<Specialist[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
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
      if (!res.ok) return;
      const data = await res.json() as { specialists: PredictedSpecialist[] };
      if (!controller.signal.aborted) {
        setSpecialists(data.specialists ?? []);
      }
    } catch {
      // Aborted or network error — ignore
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

  // Advance to Step 2 — seed step2 specialists from predictions
  const handleGoToStep2 = useCallback(() => {
    setStep2Specialists(
      specialists.map((s) => ({
        type: s.domain,
        name: s.domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Specialist",
        confidence: s.confidence,
        reason: s.reason,
      })),
    );
    setCurrentStep(2);
  }, [specialists]);

  // Remove a specialist from Step 2
  const handleRemoveSpecialist = useCallback((type: string) => {
    setStep2Specialists((prev) => prev.filter((s) => s.type !== type));
  }, []);

  // Step 2 confirm → create session via form submit
  const handleConfirmTeam = useCallback(() => {
    const formData = new FormData();
    formData.set("name", step1Data.appName);
    formData.set("description", step1Data.description);
    submit(formData, { method: "post", action: "?index" });
  }, [step1Data, submit]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-primary">Clowder</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            A committee of AI experts will guide you from concept to deployed product.
          </p>
        </div>

        <StepWizard
          step={currentStep}
          onNext={currentStep === 1 ? handleGoToStep2 : handleConfirmTeam}
          onBack={() => setCurrentStep(1)}
          canProceed={
            currentStep === 1
              ? isStep1Valid(step1Data)
              : !predicting
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
            <Step2Assembly
              appName={step1Data.appName}
              specialists={step2Specialists}
              loading={false}
              onRemoveSpecialist={handleRemoveSpecialist}
            />
          )}
        </StepWizard>

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div className="mt-8 text-left space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Sessions
            </h2>
            <div className="space-y-2">
              {sessions.map((s) => (
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

        <p className="text-sm text-muted-foreground">
          A clowder is a group of cats — and a team of expert AI agents that will
          build your app together.
        </p>
      </div>
    </main>
  );
}

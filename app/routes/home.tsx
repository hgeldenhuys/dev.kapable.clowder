import { useState, useRef, useCallback, useEffect } from "react";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/home";
import { createClowderSession, listClowderSessions, sendClowderMessage } from "~/lib/api.server";
import { orchestrate } from "~/lib/orchestrator.server";

export async function loader() {
  const sessions = await listClowderSessions();
  return { sessions };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return { error: "Please describe your app idea" };
  }

  const session = await createClowderSession({ description });

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

// Domain display config — colors and labels for specialist chips
const domainConfig: Record<string, { label: string; color: string }> = {
  commerce: { label: "Commerce", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  compliance: { label: "Compliance", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  growth: { label: "Growth", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  analytics: { label: "Analytics", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  security: { label: "Security", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  iot: { label: "IoT", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  content: { label: "Content", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  ai_ml: { label: "AI/ML", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  realtime: { label: "Realtime", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  mapping: { label: "Mapping", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  social: { label: "Social", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  scheduling: { label: "Scheduling", color: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  logistics: { label: "Logistics", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  healthcare: { label: "Healthcare", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  education: { label: "Education", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  finance: { label: "Finance", color: "bg-lime-500/20 text-lime-300 border-lime-500/30" },
  media: { label: "Media", color: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30" },
};

const defaultChipColor = "bg-gray-500/20 text-gray-300 border-gray-500/30";

interface PredictedSpecialist {
  domain: string;
  confidence: number;
  reason: string;
}

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { sessions } = loaderData;
  const [wordCount, setWordCount] = useState(0);
  const [specialists, setSpecialists] = useState<PredictedSpecialist[]>([]);
  const [predicting, setPredicting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWordCountRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const predictExperts = useCallback(async (text: string) => {
    // Cancel any in-flight request
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

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);

    // Trigger prediction every 3 words (on word-count boundaries)
    const wordBoundary = Math.floor(words / 3);
    const lastBoundary = Math.floor(lastWordCountRef.current / 3);
    lastWordCountRef.current = words;

    if (wordBoundary > lastBoundary && words >= 3) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        predictExperts(text);
      }, 300);
    }

    // Clear predictions if text is too short
    if (words < 3) {
      setSpecialists([]);
    }
  }, [predictExperts]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-primary">Clowder</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Describe your app idea. A committee of AI experts will guide you from
            concept to deployed product.
          </p>
        </div>

        <form method="post" action="?index" className="space-y-4">
          <div className="relative">
            <textarea
              name="description"
              placeholder="Describe your app idea in detail — who are the users, what do they do, what data is needed? (200+ words triggers instant auto-build)"
              className="w-full min-h-[140px] p-4 pb-8 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-base"
              required
              onChange={handleTextChange}
            />
            <span className={`absolute bottom-2 right-3 text-xs ${wordCount >= 200 ? "text-green-400" : "text-muted-foreground"}`}>
              {wordCount} word{wordCount !== 1 ? "s" : ""}{wordCount >= 200 ? " — instant build!" : ""}
            </span>
          </div>

          {/* Predicted specialist chips */}
          {specialists.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {/* Always-present core experts */}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/20 text-primary border-primary/30">
                Strategist
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/20 text-primary border-primary/30">
                Designer
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/20 text-primary border-primary/30">
                Architect
              </span>
              {/* Predicted specialists */}
              {specialists.map((s) => {
                const config = domainConfig[s.domain];
                const label = config?.label ?? s.domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const colorClass = config?.color ?? defaultChipColor;
                return (
                  <span
                    key={s.domain}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity duration-300 ${colorClass}`}
                    style={{ opacity: Math.max(0.4, s.confidence) }}
                    title={s.reason}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                    {label}
                  </span>
                );
              })}
              {predicting && (
                <span className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground animate-pulse">
                  ...
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Assemble Your Clowder
          </button>
        </form>

        <p className="text-sm text-muted-foreground">
          A clowder is a group of cats — and a team of expert AI agents that will
          build your app together.
        </p>

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
      </div>
    </main>
  );
}

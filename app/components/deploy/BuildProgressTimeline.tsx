import { Link } from "react-router";
import type { ClowderMessage } from "~/lib/api.server";
import { useState, useEffect } from "react";

/**
 * Build stage definitions — matched against system message content/metadata.
 * Order matters: stages are shown top-to-bottom in the timeline.
 */
const BUILD_STAGES = [
  { id: "plan", label: "Synthesizing app plan", match: (m: ClowderMessage) => m.metadata?.phase === "planning" },
  { id: "provision", label: "Creating project on Kapable", match: (m: ClowderMessage) => m.content.includes("Creating your app on the Kapable platform") },
  { id: "tables", label: "Setting up database tables", match: (m: ClowderMessage) => m.content.includes("setting up") && m.content.includes("table") || m.content.includes("Tables created") },
  { id: "codegen", label: "Generating app code", match: (m: ClowderMessage) => m.content.includes("Generating your app code") },
  { id: "github", label: "Pushing to GitHub", match: (m: ClowderMessage) => m.content.includes("Pushing to GitHub") || m.content.includes("Generated") && m.content.includes("files") },
  { id: "register", label: "Registering app", match: (m: ClowderMessage) => m.content.includes("Registering app") },
  { id: "deploy", label: "Deploying to Kapable", match: (m: ClowderMessage) => m.content.includes("Deploying your app") },
  { id: "flow", label: "Build pipeline running", match: (m: ClowderMessage) => m.content.includes("Build pipeline started") || m.metadata?.flow_run_id != null },
  { id: "done", label: "App is live!", match: (m: ClowderMessage) => m.content.includes("Your app is live") || m.metadata?.deployed === true },
] as const;

/** Detect error messages from the builder */
function detectBuildError(messages: ClowderMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "system") continue;
    const c = m.content.toLowerCase();
    if (c.includes("error") || c.includes("failed") || c.includes("encountered an error")) {
      return m.content;
    }
  }
  return null;
}

interface BuildProgressTimelineProps {
  messages: ClowderMessage[];
  phase: string;
  appUrl?: string;
  onRetry?: () => void;
}

/**
 * Vertical timeline showing build progress.
 * Parses system messages from the builder to determine which stages are complete.
 * Shows error state with retry button (T10) and collapsible build log (T9).
 */
export function BuildProgressTimeline({ messages, phase, appUrl, onRetry }: BuildProgressTimelineProps) {
  const [showLog, setShowLog] = useState(false);

  // Only show system messages (builder sends them)
  const systemMessages = messages.filter((m) => m.role === "system");

  // Determine which stages are reached
  const reachedStages = new Set<string>();
  for (const msg of systemMessages) {
    for (const stage of BUILD_STAGES) {
      if (stage.match(msg)) {
        reachedStages.add(stage.id);
      }
    }
  }

  // Find the highest reached stage index
  let highestReachedIndex = -1;
  for (let i = BUILD_STAGES.length - 1; i >= 0; i--) {
    if (reachedStages.has(BUILD_STAGES[i].id)) {
      highestReachedIndex = i;
      break;
    }
  }

  const isBuilding = phase === "building";
  const isDelivered = phase === "delivered";

  // T10: Detect build errors
  const buildError = isBuilding ? detectBuildError(systemMessages) : null;

  // Get the most recent system message for context
  const lastSystemMsg = systemMessages[systemMessages.length - 1];
  const lastContent = lastSystemMsg?.content ?? "";

  // Calculate elapsed time: use fixed duration for delivered, live timer for building
  const buildStartMsg = systemMessages.find(
    (m) => m.metadata?.phase === "planning" || m.metadata?.phase === "building"
  );
  let buildEndMsg: ClowderMessage | null = null;
  if (isDelivered && systemMessages.length > 0) {
    for (let i = systemMessages.length - 1; i >= 0; i--) {
      const m = systemMessages[i];
      if (m.metadata?.deployed === true || m.metadata?.phase === "delivered" || m.content.includes("Your app is live")) {
        buildEndMsg = m;
        break;
      }
    }
    if (!buildEndMsg) {
      buildEndMsg = systemMessages[systemMessages.length - 1];
    }
  }
  // Use a client-only timer for live elapsed time (avoids hydration mismatch from Date.now())
  const [now, setNow] = useState(() => 0);
  useEffect(() => {
    setNow(Date.now());
    if (!isBuilding) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isBuilding]);

  const startTime = buildStartMsg ? new Date(buildStartMsg.created_at).getTime() : 0;
  const endTime = buildEndMsg ? new Date(buildEndMsg.created_at).getTime() : now;
  const elapsedMs = startTime && endTime ? endTime - startTime : 0;
  const elapsedSec = Math.round(elapsedMs / 1000);
  const elapsedStr = elapsedSec >= 60
    ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
    : `${elapsedSec}s`;

  // T9: Build log entries (system messages during build)
  const logEntries = systemMessages.filter(
    (m) => m.metadata?.phase === "building" || m.metadata?.phase === "planning" || m.metadata?.source === "flow"
  );

  return (
    <div className="space-y-1 py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-xs font-medium text-foreground">Build Progress</span>
        <div className="flex items-center gap-2">
          {logEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showLog ? "Hide log" : "Show log"}
            </button>
          )}
          {elapsedMs > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums" suppressHydrationWarning>{elapsedStr}</span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {BUILD_STAGES.map((stage, i) => {
          const isDone = i <= highestReachedIndex || (isDelivered && stage.id === "done");
          const isActive = !isDone && i === highestReachedIndex + 1 && isBuilding && !buildError;
          const isErrorStage = !isDone && i === highestReachedIndex + 1 && !!buildError;

          // Skip flow stage if not using flow-based build
          if (stage.id === "flow" && !reachedStages.has("flow")) {
            return null;
          }
          // Skip individual scaffold stages if using flow
          if (reachedStages.has("flow") && ["codegen", "github", "register"].includes(stage.id)) {
            return null;
          }

          return (
            <div key={stage.id} className="flex items-start gap-3 relative">
              {/* Vertical line connector */}
              {i < BUILD_STAGES.length - 1 && (
                <div
                  className={`absolute left-[9px] top-5 w-px h-full ${
                    isDone ? "bg-accent/40" : isErrorStage ? "bg-destructive/40" : "bg-border/30"
                  }`}
                />
              )}

              {/* Status dot */}
              <div className="relative z-10 flex-none mt-0.5">
                {isDone ? (
                  <div className="w-[18px] h-[18px] rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isErrorStage ? (
                  <div className="w-[18px] h-[18px] rounded-full bg-destructive/20 border border-destructive/50 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-[18px] h-[18px] rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                ) : (
                  <div className="w-[18px] h-[18px] rounded-full bg-secondary border border-border" />
                )}
              </div>

              {/* Label */}
              <div className="pb-4 min-w-0">
                <span
                  className={`text-xs leading-[18px] ${
                    isDone
                      ? "text-accent/80"
                      : isErrorStage
                        ? "text-destructive font-medium"
                        : isActive
                          ? "text-foreground font-medium"
                          : "text-muted-foreground/40"
                  }`}
                >
                  {isErrorStage
                      ? `${stage.label} — failed`
                      : stage.label}
                </span>
                {isActive && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground animate-pulse">
                    in progress…
                  </span>
                )}
                {/* Celebration CTA for delivered apps */}
                {isDelivered && stage.id === "done" && appUrl && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <a
                      href={appUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent text-white text-xs font-semibold transition-all shadow-lg shadow-accent/20 hover:scale-[1.02]"
                    >
                      Open your app →
                    </a>
                    <Link
                      to="/"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/30 text-muted-foreground/60 hover:text-foreground hover:border-border/50 text-xs font-medium transition-all"
                    >
                      Build another
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* T10: Error state with retry */}
      {buildError && (
        <div className="mt-2 mx-1 p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
          <p className="text-xs text-destructive/90 leading-relaxed">
            {buildError.length > 200 ? buildError.slice(0, 200) + "…" : buildError}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-medium text-destructive hover:text-destructive/80 bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 rounded-md transition-colors"
            >
              Retry build
            </button>
          )}
        </div>
      )}

      {/* Latest status message (when no error) */}
      {lastContent && isBuilding && !buildError && (
        <div className="mt-2 px-1">
          <p className="text-[11px] text-muted-foreground/60 truncate" title={lastContent}>
            {lastContent.length > 80 ? lastContent.slice(0, 80) + "…" : lastContent}
          </p>
        </div>
      )}

      {/* T9: Collapsible build log */}
      {showLog && logEntries.length > 0 && (
        <div className="mt-3 mx-1 rounded-lg bg-secondary border border-border overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border/20 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Build Log</span>
          </div>
          <div className="max-h-40 overflow-y-auto p-2 space-y-1 font-mono">
            {logEntries.map((entry) => (
              <div key={entry.id} className="flex gap-2 text-[10px] leading-relaxed">
                <span className="text-muted-foreground/60 flex-none tabular-nums" suppressHydrationWarning>
                  {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={
                  entry.content.toLowerCase().includes("error") || entry.content.toLowerCase().includes("failed")
                    ? "text-destructive"
                    : entry.content.includes("created") || entry.content.includes("completed")
                      ? "text-accent"
                      : "text-foreground/80"
                }>
                  {entry.content.length > 120 ? entry.content.slice(0, 120) + "…" : entry.content}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

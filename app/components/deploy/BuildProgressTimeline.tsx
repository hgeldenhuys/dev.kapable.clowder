import type { ClowderMessage } from "~/lib/api.server";

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

interface BuildProgressTimelineProps {
  messages: ClowderMessage[];
  phase: string;
  appUrl?: string;
}

/**
 * Vertical timeline showing build progress.
 * Parses system messages from the builder to determine which stages are complete.
 * Replaces the static "Your experts are building your app..." message.
 */
export function BuildProgressTimeline({ messages, phase, appUrl }: BuildProgressTimelineProps) {
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

  // All stages up to and including the highest reached are "done"
  // The next one is "active" (if building phase)
  const isBuilding = phase === "building";
  const isDelivered = phase === "delivered";

  // Get the most recent system message for context
  const lastSystemMsg = systemMessages[systemMessages.length - 1];
  const lastContent = lastSystemMsg?.content ?? "";

  // Calculate elapsed time: use fixed duration for delivered, live timer for building
  const buildStartMsg = systemMessages.find(
    (m) => m.metadata?.phase === "planning" || m.metadata?.phase === "building"
  );
  // For delivered apps, use the last system message as end time (fallback for flow-based builds
  // where there's no explicit "deployed" marker message)
  let buildEndMsg: ClowderMessage | null = null;
  if (isDelivered && systemMessages.length > 0) {
    // Walk backwards to find a deploy/complete marker, or fall back to last system msg
    for (let i = systemMessages.length - 1; i >= 0; i--) {
      const m = systemMessages[i];
      if (m.metadata?.deployed === true || m.metadata?.phase === "delivered" || m.content.includes("Your app is live")) {
        buildEndMsg = m;
        break;
      }
    }
    // If no explicit marker, use the last system message
    if (!buildEndMsg) {
      buildEndMsg = systemMessages[systemMessages.length - 1];
    }
  }
  const startTime = buildStartMsg ? new Date(buildStartMsg.created_at).getTime() : 0;
  const endTime = buildEndMsg ? new Date(buildEndMsg.created_at).getTime() : Date.now();
  const elapsedMs = startTime ? endTime - startTime : 0;
  const elapsedSec = Math.round(elapsedMs / 1000);
  const elapsedStr = elapsedSec >= 60
    ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
    : `${elapsedSec}s`;

  return (
    <div className="space-y-1 py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-xs font-medium text-foreground/80">Build Progress</span>
        {elapsedMs > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">{elapsedStr}</span>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {BUILD_STAGES.map((stage, i) => {
          const isDone = i <= highestReachedIndex;
          const isActive = !isDone && i === highestReachedIndex + 1 && isBuilding;
          const isFuture = !isDone && !isActive;

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
                    isDone ? "bg-emerald-500/40" : "bg-border/30"
                  }`}
                />
              )}

              {/* Status dot */}
              <div className="relative z-10 flex-none mt-0.5">
                {isDone ? (
                  <div className="w-[18px] h-[18px] rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-[18px] h-[18px] rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                ) : (
                  <div className="w-[18px] h-[18px] rounded-full bg-zinc-800 border border-border/40" />
                )}
              </div>

              {/* Label */}
              <div className="pb-4 min-w-0">
                <span
                  className={`text-xs leading-[18px] ${
                    isDone
                      ? "text-emerald-400/80"
                      : isActive
                        ? "text-foreground font-medium"
                        : "text-muted-foreground/40"
                  }`}
                >
                  {isDelivered && stage.id === "done" && appUrl
                    ? "App is live!"
                    : stage.label}
                </span>
                {isActive && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground animate-pulse">
                    in progress…
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Latest status message */}
      {lastContent && isBuilding && (
        <div className="mt-2 px-1">
          <p className="text-[11px] text-muted-foreground/60 truncate" title={lastContent}>
            {lastContent.length > 80 ? lastContent.slice(0, 80) + "…" : lastContent}
          </p>
        </div>
      )}
    </div>
  );
}

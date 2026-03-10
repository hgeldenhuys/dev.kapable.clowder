import { Link } from "react-router";
import { useState, useCallback, useMemo } from "react";
import type { Route } from "./+types/session";
import { getClowderSession, listClowderMessages, listClowderSessions } from "~/lib/api.server";
import { MultiOrbVisualizer } from "~/components/aura/MultiOrbVisualizer";
import { SpotlightChat } from "~/components/chat/SpotlightChat";
import { DeployedPreview } from "~/components/deploy/DeployedPreview";
import { PhaseTransition } from "~/components/aura/PhaseTransition";
import { SessionSidebar } from "~/components/sidebar/SessionSidebar";
import { KeyboardShortcuts } from "~/components/shortcuts/KeyboardShortcuts";
import { useClowderSession } from "~/hooks/useClowderSession";
import type { OrbData } from "~/components/orbs/types";

const PHASE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  interviewing: { label: "Understanding", color: "#E8A838", bg: "rgba(232,168,56,0.1)" },
  assembling: { label: "Assembling", color: "#E8A838", bg: "rgba(232,168,56,0.1)" },
  ideating: { label: "Ideating", color: "#5B8FB9", bg: "rgba(91,143,185,0.1)" },
  planning: { label: "Planning", color: "#9B6B8E", bg: "rgba(155,107,142,0.1)" },
  building: { label: "Building", color: "#81B29A", bg: "rgba(129,178,154,0.1)" },
  delivered: { label: "Delivered", color: "#81B29A", bg: "rgba(129,178,154,0.1)" },
};

export function meta({ data }: Route.MetaArgs) {
  const name = data?.session?.name ?? "Session";
  const phase = data?.session?.phase ?? "";
  const title = `${name} — Clowder`;
  const description = phase === "delivered"
    ? `${name} — built and deployed by Clowder AI experts`
    : `${name} — being built by Clowder AI experts`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;
  const [{ session, experts }, messages, allSessions] = await Promise.all([
    getClowderSession(sessionId),
    listClowderMessages(sessionId),
    listClowderSessions(),
  ]);
  return { session, experts, messages, allSessions };
}

export default function SessionPage({ loaderData }: Route.ComponentProps) {
  const { session: initialSession, experts: initialExperts, messages: initialMessages, allSessions } = loaderData;

  const {
    session,
    experts,
    messages,
    activeExpert,
    activeExpertId,
    isWaitingForExpert,
    sendMessage,
    forceStart,
    setActiveExpert,
  } = useClowderSession({
    initialSession,
    initialExperts,
    initialMessages,
  });

  const orbs: OrbData[] = experts.map((expert) => ({
    id: expert.id,
    name: expert.name,
    domain: expert.domain,
    confidence: expert.confidence,
    status: expert.status,
    isActive: expert.id === activeExpertId,
  }));

  const [showPreview, setShowPreview] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const isDelivered = session.phase === "delivered" && session.app_url;

  const [shareCopied, setShareCopied] = useState(false);

  const handleCopyUrl = useCallback(() => {
    if (session.app_url) {
      navigator.clipboard.writeText(session.app_url);
    }
  }, [session.app_url]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, []);

  const shortcutActions = useMemo(() => {
    const actions = [
      { key: "sidebar", label: "Toggle sessions", shortcut: "Cmd+B", action: () => setShowSidebar((v) => !v) },
      { key: "home", label: "New session", shortcut: "Cmd+N", action: () => window.location.assign("/") },
    ];
    if (isDelivered && session.app_url) {
      actions.push(
        { key: "preview", label: "Toggle preview", shortcut: "Cmd+P", action: () => setShowPreview((v) => !v) },
        { key: "copy", label: "Copy app URL", shortcut: "Cmd+C", action: handleCopyUrl },
      );
    }
    if (session.phase === "ideating" && forceStart) {
      actions.push({ key: "build", label: "Start building", shortcut: "Cmd+Enter", action: forceStart });
    }
    return actions;
  }, [isDelivered, session.app_url, session.phase, forceStart, handleCopyUrl]);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* Phase transition overlay */}
      <PhaseTransition phase={session.phase} />

      {/* Top: Orb scene */}
      <div
        className="flex-none relative overflow-hidden"
        style={{
          height: isDelivered ? "56px" : experts.length === 0 ? "56px" : "200px",
          background: "var(--secondary)",
          boxShadow: "inset 0 -1px 0 var(--border)",
          zIndex: 0,
          transition: "height 0.4s ease-in-out",
        }}
      >
        <div className="h-full flex flex-col">
          <div className="flex flex-nowrap items-center gap-2 md:gap-3 px-3 md:px-4 pt-2.5 pb-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setShowSidebar((v) => !v)}
              className="flex items-center text-muted-foreground/50 hover:text-foreground transition-colors text-sm flex-none p-1 rounded-lg hover:bg-secondary"
              title="Toggle sessions (Cmd+B)"
              aria-label="Toggle sessions sidebar"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Breadcrumb: Clowder > Session Name */}
            <nav className="flex items-center gap-1.5 min-w-0 flex-1" aria-label="Breadcrumb">
              <Link
                to="/"
                className="flex items-center gap-1.5 flex-none text-muted-foreground hover:text-foreground transition-colors"
              >
                <img src="/logo.png" alt="" className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs font-medium hidden sm:inline">Clowder</span>
              </Link>
              <svg className="w-3 h-3 text-muted-foreground/40 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <h1 className="text-xs sm:text-sm font-semibold text-foreground truncate min-w-0">
                {session.name}
              </h1>
              {/* Phase pill */}
              {(() => {
                const ps = PHASE_STYLES[session.phase];
                if (!ps) return null;
                return (
                  <span
                    className="flex-none text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                    style={{
                      color: ps.color,
                      backgroundColor: ps.bg,
                      borderColor: `${ps.color}33`,
                    }}
                  >
                    {ps.label}
                  </span>
                );
              })()}
            </nav>
            {/* Right side actions */}
            <div className="flex items-center gap-2 flex-none ml-auto">
              {/* Share button */}
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary border border-transparent hover:border-border"
                title="Copy session link"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {shareCopied ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  )}
                </svg>
                <span className="hidden sm:inline">{shareCopied ? "Copied" : "Share"}</span>
              </button>
              {session.app_url && (
                <a
                  href={session.app_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex-none hidden md:inline"
                >
                  Open app
                </a>
              )}
              {isDelivered && (
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPreview ? "Hide preview" : "Show preview"}
                </button>
              )}
            </div>
          </div>
          {!isDelivered && (
            <div className="flex-1 min-h-0">
              <MultiOrbVisualizer
                orbs={orbs}
                activeOrbId={activeExpertId}
                onOrbClick={setActiveExpert}
                isWaitingForExpert={isWaitingForExpert}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row" style={{ zIndex: 1, transform: "translateZ(0)" }}>
        {/* Session sidebar — overlay on mobile, inline on md+ */}
        {showSidebar && (
          <>
            <div
              className="fixed inset-0 top-[56px] z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setShowSidebar(false)}
              onKeyDown={() => {}}
              role="presentation"
            />
            <div className="fixed inset-y-0 left-0 z-50 md:relative md:z-auto">
              <SessionSidebar
                sessions={allSessions}
                currentSessionId={session.id}
                onClose={() => setShowSidebar(false)}
              />
            </div>
          </>
        )}

        {/* Chat panel */}
        <div className={isDelivered && showPreview ? "w-full md:w-[420px] lg:w-[480px] md:flex-none md:border-r border-border flex-1 md:flex-initial" : "flex-1"}>
          <SpotlightChat
            messages={messages}
            experts={experts}
            sessionId={session.id}
            activeExpert={activeExpert}
            phase={session.phase}
            appUrl={session.app_url}
            isWaitingForExpert={isWaitingForExpert}
            onSend={sendMessage}
            onForceStart={session.phase === "ideating" ? forceStart : undefined}
            onRetryBuild={session.phase === "building" ? forceStart : undefined}
          />
        </div>

        {/* Deployed app preview — hidden on mobile, shown on md+ */}
        {isDelivered && showPreview && session.app_url && (
          <div className="hidden md:block flex-1">
            <DeployedPreview
              appUrl={session.app_url}
              appName={session.name}
              onCopyUrl={handleCopyUrl}
            />
          </div>
        )}
      </div>

      {/* Keyboard shortcuts palette */}
      <KeyboardShortcuts actions={shortcutActions} />
    </div>
  );
}

import { Link } from "react-router";
import type { Route } from "./+types/session";
import { getClowderSession, listClowderMessages } from "~/lib/api.server";
import { MultiOrbVisualizer } from "~/components/aura/MultiOrbVisualizer";
import { SpotlightChat } from "~/components/chat/SpotlightChat";
import { useClowderSession } from "~/hooks/useClowderSession";
import type { OrbData } from "~/components/orbs/types";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;
  const [{ session, experts }, messages] = await Promise.all([
    getClowderSession(sessionId),
    listClowderMessages(sessionId),
  ]);
  return { session, experts, messages };
}

export default function SessionPage({ loaderData }: Route.ComponentProps) {
  const { session: initialSession, experts: initialExperts, messages: initialMessages } = loaderData;

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top: Orb scene */}
      <div
        className="flex-none relative overflow-hidden"
        style={{
          height: "220px",
          background: "oklch(0.06 0.01 270)",
          borderBottom: "1px solid oklch(0.22 0.01 270)",
          zIndex: 0,
        }}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-3 px-4 pt-3 pb-1">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              ← Back
            </Link>
            <span className="text-xs text-muted-foreground">·</span>
            <h1 className="text-sm font-semibold text-foreground truncate">
              {session.name}
            </h1>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground capitalize">{session.phase}</span>
          </div>
          <div className="flex-1 min-h-0">
            <MultiOrbVisualizer
              orbs={orbs}
              activeOrbId={activeExpertId}
              onOrbClick={setActiveExpert}
              isWaitingForExpert={isWaitingForExpert}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Chat — transform forces GPU layer so WebGL canvas doesn't bleed through */}
      <div className="flex-1 overflow-hidden relative" style={{ zIndex: 1, transform: "translateZ(0)" }}>
        <SpotlightChat
          messages={messages}
          experts={experts}
          sessionId={session.id}
          activeExpert={activeExpert}
          phase={session.phase}
          isWaitingForExpert={isWaitingForExpert}
          onSend={sendMessage}
          onForceStart={session.phase === "ideating" ? forceStart : undefined}
        />
      </div>
    </div>
  );
}

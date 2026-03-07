import type { Route } from "./+types/session";
import { getClowderSession, listClowderMessages } from "~/lib/api.server";
import { OrbScene } from "~/components/orbs/OrbScene";
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
        className="flex-none"
        style={{
          height: "220px",
          background: "oklch(0.06 0.01 270)",
          borderBottom: "1px solid oklch(0.22 0.01 270)",
        }}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-3 px-4 pt-3 pb-1">
            <h1 className="text-sm font-semibold text-foreground truncate">
              {session.name}
            </h1>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground capitalize">{session.phase}</span>
          </div>
          <div className="flex-1">
            <OrbScene
              orbs={orbs}
              activeOrbId={activeExpertId}
              onOrbClick={setActiveExpert}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Chat */}
      <div className="flex-1 overflow-hidden">
        <SpotlightChat
          messages={messages}
          experts={experts}
          sessionId={session.id}
          activeExpert={activeExpert}
          phase={session.phase}
          onSend={sendMessage}
          onForceStart={forceStart}
        />
      </div>
    </div>
  );
}

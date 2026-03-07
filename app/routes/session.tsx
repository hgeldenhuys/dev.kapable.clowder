import type { Route } from "./+types/session";
import { getClowderSession, listClowderMessages } from "~/lib/api.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;
  const [{ session, experts }, messages] = await Promise.all([
    getClowderSession(sessionId),
    listClowderMessages(sessionId),
  ]);
  return { session, experts, messages };
}

export default function SessionPage({ loaderData }: Route.ComponentProps) {
  const { session, experts, messages } = loaderData;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Orb scene placeholder */}
      <div
        className="flex-none h-64 flex items-center justify-center border-b border-border"
        style={{ background: "oklch(0.06 0.01 270)" }}
      >
        <div className="flex gap-8">
          {experts.map((expert) => (
            <div key={expert.id} className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold transition-all"
                style={{
                  background: getOrbColor(expert.confidence),
                  boxShadow: `0 0 20px ${getOrbColor(expert.confidence)}66`,
                }}
              >
                {expert.name[0]}
              </div>
              <span className="text-xs text-muted-foreground">{expert.name}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {Math.round(expert.confidence * 100)}%
              </span>
            </div>
          ))}
          {experts.length === 0 && (
            <p className="text-muted-foreground text-sm animate-pulse">
              Assembling your expert committee…
            </p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border"
                }`}
              >
                {msg.role !== "user" && (
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    {experts.find((e) => e.id === msg.expert_id)?.name ?? "System"}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg mb-2">Your expert committee is ready.</p>
              <p className="text-sm">
                Describe your app idea and they&apos;ll ask questions to refine it.
              </p>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border pt-4">
          <form method="post" action={`/api/clowder-session/${session.id}/messages`} className="flex gap-3">
            <input
              name="content"
              type="text"
              placeholder="Reply to your expert committee…"
              className="flex-1 px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Send
            </button>
          </form>
          <div className="flex gap-3 mt-2">
            <form method="post" action={`/api/clowder-session/${session.id}/force-start`}>
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Force start build →
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function getOrbColor(confidence: number): string {
  if (confidence < 0.2) return "oklch(0.55 0.22 25)";   // red
  if (confidence < 0.5) return "oklch(0.65 0.18 50)";   // orange
  if (confidence < 0.7) return "oklch(0.75 0.17 95)";   // yellow
  if (confidence < 0.9) return "oklch(0.65 0.2 145)";   // green
  return "oklch(0.6 0.2 245)";                            // blue
}

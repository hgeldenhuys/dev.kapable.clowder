import { useState } from "react";
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

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { sessions } = loaderData;
  const [wordCount, setWordCount] = useState(0);

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
              onChange={(e) => {
                const words = e.target.value.trim().split(/\s+/).filter(Boolean).length;
                setWordCount(words);
              }}
            />
            <span className={`absolute bottom-2 right-3 text-xs ${wordCount >= 200 ? "text-green-400" : "text-muted-foreground"}`}>
              {wordCount} word{wordCount !== 1 ? "s" : ""}{wordCount >= 200 ? " — instant build!" : ""}
            </span>
          </div>
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
                <Link
                  key={s.id}
                  to={`/session/${s.id}`}
                  className="block p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {s.name}
                    </span>
                    <span className={`text-xs font-medium uppercase tracking-wide ${phaseColors[s.phase] ?? "text-muted-foreground"}`}>
                      {s.phase}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

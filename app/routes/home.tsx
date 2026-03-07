import { redirect } from "react-router";
import type { Route } from "./+types/home";
import { createClowderSession } from "~/lib/api.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return { error: "Please describe your app idea" };
  }

  const session = await createClowderSession({ description });
  return redirect(`/session/${session.id}`);
}

export default function HomePage() {
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

        <form method="post" className="space-y-4">
          <textarea
            name="description"
            placeholder="Describe your app idea… (e.g. 'A marketplace for freelance accountants where clients post jobs and accountants bid on them')"
            className="w-full min-h-[140px] p-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-base"
            required
          />
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
      </div>
    </main>
  );
}

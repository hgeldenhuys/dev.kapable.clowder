import { redirect } from "react-router";
import type { Route } from "./+types/api.clowder-sessions";
import { createClowderSession } from "~/lib/api.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return Response.json({ error: "Description required" }, { status: 400 });
  }

  const session = await createClowderSession({ description });
  return redirect(`/session/${session.id}`);
}

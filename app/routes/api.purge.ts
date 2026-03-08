import { purgeStale } from "~/lib/db.server";

export async function action() {
  const result = await purgeStale();
  return Response.json(result);
}

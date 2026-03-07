import { createCookieSessionStorage, redirect } from "react-router";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set in environment variables");
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__kapable_clowder_session",
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function commitSession(session: ReturnType<typeof sessionStorage.getSession> extends Promise<infer T> ? T : never) {
  return sessionStorage.commitSession(await Promise.resolve(session));
}

export async function getAdminKey(request: Request): Promise<string | null> {
  // For Clowder, we use the platform admin key from env (BFF pattern)
  // In production, this would be a per-org key from the session
  return process.env.KAPABLE_ADMIN_KEY ?? null;
}

export async function requireAuth(request: Request): Promise<string> {
  const key = await getAdminKey(request);
  if (!key) {
    throw redirect("/");
  }
  return key;
}

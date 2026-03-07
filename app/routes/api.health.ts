export function loader() {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  return Response.json({
    status: "ok",
    openrouter: hasOpenRouter,
    env_keys: Object.keys(process.env).filter(k => k.startsWith("OPEN") || k.startsWith("KAPABLE") || k === "NODE_ENV"),
  });
}

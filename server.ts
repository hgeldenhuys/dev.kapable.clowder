/**
 * Production Bun server for Clowder — AI App Builder.
 *
 * Serves the pre-built React Router 7 app (SSR) on a single port.
 */

import { readFileSync, writeFileSync } from "node:fs";

// Load env files (systemd services may not trigger Bun's auto-load)
// Try .env first (local overrides), then .env.production (committed defaults)
for (const envFile of [".env", ".env.production"]) {
  try {
    const envContent = readFileSync(envFile, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch { /* env file not found — continue */ }
}

const BUILD_DIR = "./build";
const PORT = Number(process.env.PORT) || 3025;

let handler: ((req: Request) => Promise<Response>) | null = null;
let startupError: string | null = null;

// Try loading the SSR handler — log errors but still start the server
try {
  const { createRequestHandler } = await import("react-router");
  const build = await import(`${BUILD_DIR}/server/index.js`);
  handler = createRequestHandler(build as any);
} catch (err: any) {
  startupError = `SSR init failed: ${err?.message || err}\n${err?.stack || ""}`;
  console.error(startupError);
  try { writeFileSync("/tmp/clowder-startup-error.log", startupError); } catch {}
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  idleTimeout: 120,

  async fetch(req) {
    const url = new URL(req.url);

    // Health check — always respond even if SSR failed
    if (url.pathname === "/health") {
      return new Response(startupError ? `degraded: ${startupError}` : "ok", {
        status: 200,
      });
    }

    // Debug endpoint
    if (url.pathname === "/_debug") {
      return new Response(JSON.stringify({
        port: PORT,
        env_port: process.env.PORT,
        cwd: process.cwd(),
        startup_error: startupError,
        build_exists: await Bun.file(`${BUILD_DIR}/server/index.js`).exists(),
        env_file_exists: await Bun.file(".env").exists(),
        has_openrouter_key: !!process.env.OPENROUTER_API_KEY,
        has_admin_key: !!process.env.KAPABLE_ADMIN_KEY,
        env_keys: Object.keys(process.env).filter(k => !k.startsWith("_") && !k.startsWith("npm")),
      }, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    if (!handler) {
      return new Response(`Server starting up or SSR failed: ${startupError}`, { status: 503 });
    }

    // Static assets from build/client
    const staticPath = `${BUILD_DIR}/client${url.pathname}`;
    const file = Bun.file(staticPath);
    if (await file.exists()) {
      return new Response(file);
    }

    // React Router SSR
    return handler(req);
  },
});

console.log(`Clowder server running at http://localhost:${server.port} (PORT env: ${process.env.PORT || "unset"})`);

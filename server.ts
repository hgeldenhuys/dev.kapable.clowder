/**
 * Production Bun server for Clowder — AI App Builder.
 *
 * Serves the pre-built React Router 7 app (SSR) on a single port.
 */

import { createRequestHandler } from "react-router";
import { readFileSync } from "node:fs";

// Explicitly load .env (systemd services may not trigger Bun's auto-load)
try {
  const envContent = readFileSync(".env", "utf-8");
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
} catch { /* no .env file — use defaults */ }

const BUILD_DIR = "./build";
const PORT = Number(process.env.PORT) || 3025;

const build = await import(`${BUILD_DIR}/server/index.js`);
const handler = createRequestHandler(build as any);

const server = Bun.serve({
  port: PORT,
  idleTimeout: 120,

  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
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

console.log(`Clowder server running at http://localhost:${server.port}`);

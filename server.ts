/**
 * Production Bun server for Clowder — AI App Builder.
 *
 * Serves the pre-built React Router 7 app (SSR) on a single port.
 */

import { createRequestHandler } from "react-router";

const BUILD_DIR = "./build";
const PORT = Number(process.env.PORT) || 3011;

const build = await import(`${BUILD_DIR}/server/index.js`);
const handler = createRequestHandler(build as any);

const server = Bun.serve({
  port: PORT,
  idleTimeout: 120,

  async fetch(req) {
    return handler(req);
  },
});

console.log(`Clowder server running at http://localhost:${server.port}`);

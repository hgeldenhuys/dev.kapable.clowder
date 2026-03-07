// Minimal test server — no SSR, no imports, just HTTP
const PORT = Number(Bun.env.PORT || process.env.PORT) || 3025;

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req) {
    return new Response(`ok from port ${PORT}`, { status: 200 });
  },
});

console.log(`Minimal server on port ${server.port}`);

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("session/:sessionId", "routes/session.tsx"),
  route("api/clowder-session/:sessionId", "routes/api.clowder-session.ts"),
  route("api/clowder-session/:sessionId/messages", "routes/api.clowder-messages.ts"),
  route("api/clowder-session/:sessionId/experts", "routes/api.clowder-experts.ts"),
  route("api/clowder-session/:sessionId/experts/:expertId", "routes/api.clowder-expert-update.ts"),
  route("api/clowder-session/:sessionId/sse", "routes/api.clowder-stream.ts"),
  route("api/clowder-session/:sessionId/force-start", "routes/api.clowder-force-start.ts"),
  route("api/clowder-sessions", "routes/api.clowder-sessions.ts"),
  route("health", "routes/api.health.ts"),
  route("api/purge", "routes/api.purge.ts"),
] satisfies RouteConfig;

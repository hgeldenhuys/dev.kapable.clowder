/**
 * BFF API layer for Clowder.
 *
 * All operations use the Kapable Data API (db.server.ts) for persistent
 * storage that survives container deploys.
 * SSE events are emitted via sse.server.ts for real-time updates.
 */

import {
  createSession,
  getSession,
  listSessions,
  listExperts,
  createExpert,
  updateExpert,
  listMessages,
  createMessage,
  setForceStarted,
  updateSessionPhase as dbUpdateSessionPhase,
  renameSession as dbRenameSession,
  deleteSession as dbDeleteSession,
  sessionToApi,
  expertToApi,
  messageToApi,
} from "./db.server";
import { emitMessage, emitExpertUpdated, emitPhaseChanged, emitForceStarted } from "./sse.server";

// Legacy helpers (used by builder.server.ts for vault calls)
export function getApiBaseUrl(): string {
  return process.env.KAPABLE_API_URL ?? "http://localhost:3003";
}

export function getAdminKey(): string {
  return process.env.KAPABLE_ADMIN_KEY ?? "";
}

export function buildHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Admin-Key": getAdminKey(),
  };
}

// Re-export types for consumers
export type { SessionRow as ClowderSessionRow } from "./db.server";
export type { ExpertRow as ClowderExpertRow } from "./db.server";
export type { MessageRow as ClowderMessageRow } from "./db.server";

// ---------------------------------------------------------------------------
// Shared types (kept for compatibility with existing components)
// ---------------------------------------------------------------------------

export interface ClowderSession {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  phase: "assembling" | "ideating" | "planning" | "building" | "delivered";
  input_type: string;
  app_id?: string;
  app_url?: string;
  force_started_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ClowderExpert {
  id: string;
  session_id: string;
  org_id: string;
  name: string;
  role: "core" | "specialist";
  domain: string;
  voice_id?: string;
  confidence: number;
  status: "unclear" | "progressing" | "ready" | "on_stage" | "building" | "done";
  blockers: string[];
  system_prompt?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClowderMessage {
  id: string;
  session_id: string;
  org_id: string;
  expert_id?: string;
  role: "user" | "expert" | "system";
  content: string;
  phase: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export async function createClowderSession(body: {
  name?: string;
  description: string;
  input_type?: string;
}): Promise<ClowderSession> {
  const row = await createSession(body);
  return sessionToApi(row) as ClowderSession;
}

export async function listClowderSessions(): Promise<ClowderSession[]> {
  const rows = await listSessions();
  return rows.map(sessionToApi) as ClowderSession[];
}

export async function updateSessionPhase(sessionId: string, phase: ClowderSession["phase"], extra?: Record<string, unknown>): Promise<void> {
  await dbUpdateSessionPhase(sessionId, phase);
  emitPhaseChanged(sessionId, phase, extra);
}

export async function getClowderSession(sessionId: string): Promise<{
  session: ClowderSession;
  experts: ClowderExpert[];
}> {
  const row = await getSession(sessionId);
  if (!row) throw new Error(`Session not found: ${sessionId}`);
  const expertRows = await listExperts(sessionId);
  return {
    session: sessionToApi(row) as ClowderSession,
    experts: expertRows.map(expertToApi) as ClowderExpert[],
  };
}

export async function listClowderMessages(sessionId: string): Promise<ClowderMessage[]> {
  const rows = await listMessages(sessionId);
  return rows.map(messageToApi) as ClowderMessage[];
}

export async function sendClowderMessage(
  sessionId: string,
  body: {
    content: string;
    expert_id?: string;
    role?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<ClowderMessage> {
  const row = await createMessage(sessionId, body);
  const msg = messageToApi(row) as ClowderMessage;

  // Emit SSE event
  emitMessage(sessionId, {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    expert_id: msg.expert_id,
    phase: msg.phase,
    created_at: msg.created_at,
  });

  return msg;
}

export async function listClowderExperts(sessionId: string): Promise<ClowderExpert[]> {
  const rows = await listExperts(sessionId);
  return rows.map(expertToApi) as ClowderExpert[];
}

export async function createClowderExpert(
  sessionId: string,
  body: {
    name: string;
    role: string;
    domain: string;
    voice_id?: string;
    system_prompt?: string;
    sort_order?: number;
  }
): Promise<ClowderExpert> {
  const row = await createExpert(sessionId, body);
  const expert = expertToApi(row) as ClowderExpert;

  // Emit SSE event (include domain/role so client can add new experts)
  emitExpertUpdated(sessionId, {
    id: expert.id,
    name: expert.name,
    domain: expert.domain,
    role: expert.role,
    confidence: expert.confidence,
    status: expert.status,
    blockers: expert.blockers,
  });

  return expert;
}

export async function updateClowderExpert(
  sessionId: string,
  expertId: string,
  body: {
    confidence?: number;
    status?: string;
    blockers?: string[];
    system_prompt?: string;
  }
): Promise<ClowderExpert> {
  const row = await updateExpert(expertId, body);
  const expert = expertToApi(row) as ClowderExpert;

  // Emit SSE event (include domain/role so client can add new experts)
  emitExpertUpdated(sessionId, {
    id: expert.id,
    name: expert.name,
    domain: expert.domain,
    role: expert.role,
    confidence: expert.confidence,
    status: expert.status,
    blockers: expert.blockers,
  });

  return expert;
}

export async function renameClowderSession(sessionId: string, name: string): Promise<void> {
  await dbRenameSession(sessionId, name);
}

export async function deleteClowderSession(sessionId: string): Promise<boolean> {
  return dbDeleteSession(sessionId);
}

export async function forceStartBuild(sessionId: string): Promise<ClowderSession> {
  await setForceStarted(sessionId);
  const row = await getSession(sessionId);
  if (!row) throw new Error(`Session not found: ${sessionId}`);

  // Emit SSE events
  emitForceStarted(sessionId);
  emitPhaseChanged(sessionId, "planning");

  return sessionToApi(row) as ClowderSession;
}

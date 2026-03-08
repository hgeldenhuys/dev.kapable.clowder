/**
 * Clowder data layer — Kapable Data API backend.
 *
 * Uses the platform's Data API (PostgreSQL) for persistent storage that
 * survives container deploys. Replaces the previous SQLite implementation.
 *
 * Project: clowder-internal (e74b88ac-1bdc-4bf7-ad7a-9ae1a444f1af)
 * Tables: clowder_sessions, clowder_experts, clowder_messages
 */

const API_BASE = process.env.KAPABLE_API_URL ?? "https://api.kapable.dev";
const API_KEY = process.env.CLOWDER_INTERNAL_API_KEY ?? "";

function headers(): Record<string, string> {
  return {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  };
}

async function apiPost(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/v1/data?table=${table}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Data API POST ${table} failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function apiGet(table: string, id: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${API_BASE}/v1/data/${id}?table=${table}`, {
    headers: headers(),
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

async function apiPatch(table: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/v1/data/${id}?table=${table}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Data API PATCH ${table}/${id} failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function apiDelete(table: string, id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/v1/data/${id}?table=${table}`, {
    method: "DELETE",
    headers: headers(),
  });
  return res.ok;
}

async function apiList(table: string, limit = 300): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API_BASE}/v1/data?table=${table}&limit=${limit}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const data = await res.json() as { data?: Record<string, unknown>[] };
  // jsonb mode stores all tables in a single pool — filter by _type discriminator
  return (data.data ?? []).filter((r) => r._type === table);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  phase: string;
  input_type: string;
  app_id: string | null;
  app_url: string | null;
  force_started_at: string | null;
  created_at: string;
  updated_at: string;
}

function toSessionRow(raw: Record<string, unknown>): SessionRow {
  return {
    id: String(raw.id ?? ""),
    org_id: String(raw.org_id ?? "default"),
    name: String(raw.name ?? ""),
    description: raw.description != null ? String(raw.description) : null,
    phase: String(raw.phase ?? "assembling"),
    input_type: String(raw.input_type ?? "text"),
    app_id: raw.app_id != null ? String(raw.app_id) : null,
    app_url: raw.app_url != null ? String(raw.app_url) : null,
    force_started_at: raw.force_started_at != null ? String(raw.force_started_at) : null,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? new Date().toISOString()),
  };
}

export async function createSession(body: {
  name?: string;
  description: string;
  input_type?: string;
}): Promise<SessionRow> {
  let name = body.name || body.description;
  if (name.length > 60) {
    const cut = name.lastIndexOf(" ", 60);
    name = cut > 20 ? name.slice(0, cut) : name.slice(0, 60);
    name = name.replace(/[,;:\-–—]+$/, "").trimEnd();
  }

  const raw = await apiPost("clowder_sessions", {
    _type: "clowder_sessions",
    org_id: "default",
    name,
    description: body.description,
    phase: "assembling",
    input_type: body.input_type ?? "text",
  });
  return toSessionRow(raw);
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const raw = await apiGet("clowder_sessions", id);
  return raw ? toSessionRow(raw) : null;
}

export async function updateSessionPhase(id: string, phase: string): Promise<void> {
  await apiPatch("clowder_sessions", id, { phase });
}

export async function listSessions(limit = 10): Promise<SessionRow[]> {
  // Shared jsonb pool requires over-fetching then filtering by _type
  const rows = await apiList("clowder_sessions");
  return rows.map(toSessionRow)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function updateSessionApp(id: string, appId: string, appUrl: string): Promise<void> {
  await apiPatch("clowder_sessions", id, { app_id: appId, app_url: appUrl });
}

export async function setForceStarted(id: string): Promise<void> {
  await apiPatch("clowder_sessions", id, {
    force_started_at: new Date().toISOString(),
    phase: "planning",
  });
}

// ---------------------------------------------------------------------------
// Experts
// ---------------------------------------------------------------------------

export interface ExpertRow {
  id: string;
  session_id: string;
  org_id: string;
  name: string;
  role: string;
  domain: string;
  voice_id: string | null;
  confidence: number;
  status: string;
  blockers: string; // JSON string — kept for API compat with expertToApi()
  system_prompt: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toExpertRow(raw: Record<string, unknown>): ExpertRow {
  const blockers = raw.blockers;
  return {
    id: String(raw.id ?? ""),
    session_id: String(raw.session_id ?? ""),
    org_id: String(raw.org_id ?? "default"),
    name: String(raw.name ?? ""),
    role: String(raw.role ?? "core"),
    domain: String(raw.domain ?? ""),
    voice_id: raw.voice_id != null ? String(raw.voice_id) : null,
    confidence: Number(raw.confidence ?? 0),
    status: String(raw.status ?? "unclear"),
    blockers: typeof blockers === "string" ? blockers : JSON.stringify(blockers ?? []),
    system_prompt: raw.system_prompt != null ? String(raw.system_prompt) : null,
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? new Date().toISOString()),
  };
}

export async function createExpert(
  sessionId: string,
  body: {
    name: string;
    role: string;
    domain: string;
    voice_id?: string;
    system_prompt?: string;
    sort_order?: number;
  }
): Promise<ExpertRow> {
  const raw = await apiPost("clowder_experts", {
    _type: "clowder_experts",
    session_id: sessionId,
    org_id: "default",
    name: body.name,
    role: body.role,
    domain: body.domain,
    voice_id: body.voice_id ?? null,
    confidence: 0,
    status: "unclear",
    blockers: [],
    system_prompt: body.system_prompt ?? null,
    sort_order: body.sort_order ?? 0,
  });
  return toExpertRow(raw);
}

export async function getExpert(id: string): Promise<ExpertRow | null> {
  const raw = await apiGet("clowder_experts", id);
  return raw ? toExpertRow(raw) : null;
}

export async function listExperts(sessionId: string): Promise<ExpertRow[]> {
  // Data API jsonb mode doesn't support column filtering — fetch all and filter client-side.
  // Clowder has at most ~50 experts across all sessions, so this is fine.
  const rows = await apiList("clowder_experts");
  return rows
    .filter((r) => r.session_id === sessionId)
    .map(toExpertRow)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function updateExpert(
  id: string,
  body: {
    confidence?: number;
    status?: string;
    blockers?: string[];
    system_prompt?: string;
  }
): Promise<ExpertRow> {
  const patch: Record<string, unknown> = {};
  if (body.confidence !== undefined) patch.confidence = body.confidence;
  if (body.status !== undefined) patch.status = body.status;
  if (body.blockers !== undefined) patch.blockers = body.blockers;
  if (body.system_prompt !== undefined) patch.system_prompt = body.system_prompt;

  if (Object.keys(patch).length > 0) {
    const raw = await apiPatch("clowder_experts", id, patch);
    return toExpertRow(raw);
  }
  const raw = await apiGet("clowder_experts", id);
  return toExpertRow(raw ?? {});
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface MessageRow {
  id: string;
  session_id: string;
  org_id: string;
  expert_id: string | null;
  role: string;
  content: string;
  phase: string;
  metadata: string; // JSON string — kept for API compat with messageToApi()
  created_at: string;
}

function toMessageRow(raw: Record<string, unknown>): MessageRow {
  const metadata = raw.metadata;
  return {
    id: String(raw.id ?? ""),
    session_id: String(raw.session_id ?? ""),
    org_id: String(raw.org_id ?? "default"),
    expert_id: raw.expert_id != null ? String(raw.expert_id) : null,
    role: String(raw.role ?? "user"),
    content: String(raw.content ?? ""),
    phase: String(raw.phase ?? "assembling"),
    metadata: typeof metadata === "string" ? metadata : JSON.stringify(metadata ?? {}),
    created_at: String(raw.created_at ?? new Date().toISOString()),
  };
}

export async function createMessage(
  sessionId: string,
  body: {
    content: string;
    expert_id?: string;
    role?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<MessageRow> {
  const session = await getSession(sessionId);

  const raw = await apiPost("clowder_messages", {
    _type: "clowder_messages",
    session_id: sessionId,
    org_id: "default",
    expert_id: body.expert_id ?? null,
    role: body.role ?? "user",
    content: body.content,
    phase: session?.phase ?? "assembling",
    metadata: body.metadata ?? {},
  });
  return toMessageRow(raw);
}

export async function getMessage(id: string): Promise<MessageRow | null> {
  const raw = await apiGet("clowder_messages", id);
  return raw ? toMessageRow(raw) : null;
}

export async function listMessages(sessionId: string): Promise<MessageRow[]> {
  // Client-side filtering — message count per session is typically <50
  const rows = await apiList("clowder_messages");
  return rows
    .filter((r) => r.session_id === sessionId)
    .map(toMessageRow)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// ---------------------------------------------------------------------------
// Purge stale sessions (pool maintenance)
// ---------------------------------------------------------------------------

export async function purgeStale(): Promise<{ sessions: number; rows: number }> {
  const allRows = await apiList("clowder_sessions");

  // Always purge stuck sessions (incomplete phases)
  const stuckPhases = new Set(["assembling", "ideating", "planning"]);
  const stuckSessions = allRows.filter((r) => stuckPhases.has(String(r.phase ?? "")));

  // Keep only the 5 most recent delivered/building sessions, purge the rest
  const completedSessions = allRows
    .filter((r) => r.phase === "delivered" || r.phase === "building")
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const excessCompleted = completedSessions.slice(5);

  const staleSessions = [...stuckSessions, ...excessCompleted];
  const staleIds = new Set(staleSessions.map((r) => String(r.id)));

  if (staleIds.size === 0) return { sessions: 0, rows: 0 };

  // Delete orphaned experts and messages for stale sessions
  let deletedRows = 0;
  const experts = await apiList("clowder_experts");
  for (const e of experts) {
    if (staleIds.has(String(e.session_id))) {
      if (await apiDelete("clowder_experts", String(e.id))) deletedRows++;
    }
  }
  const messages = await apiList("clowder_messages");
  for (const m of messages) {
    if (staleIds.has(String(m.session_id))) {
      if (await apiDelete("clowder_messages", String(m.id))) deletedRows++;
    }
  }

  // Delete the sessions themselves
  for (const id of staleIds) {
    if (await apiDelete("clowder_sessions", id)) deletedRows++;
  }

  return { sessions: staleIds.size, rows: deletedRows };
}

// ---------------------------------------------------------------------------
// Row → API type converters (unchanged interface)
// ---------------------------------------------------------------------------

export function sessionToApi(row: SessionRow) {
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    description: row.description,
    phase: row.phase,
    input_type: row.input_type,
    app_id: row.app_id,
    app_url: row.app_url,
    force_started_at: row.force_started_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function expertToApi(row: ExpertRow) {
  return {
    id: row.id,
    session_id: row.session_id,
    org_id: row.org_id,
    name: row.name,
    role: row.role,
    domain: row.domain,
    voice_id: row.voice_id,
    confidence: row.confidence,
    status: row.status,
    blockers: typeof row.blockers === "string" ? JSON.parse(row.blockers) : row.blockers,
    system_prompt: row.system_prompt,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function messageToApi(row: MessageRow) {
  return {
    id: row.id,
    session_id: row.session_id,
    org_id: row.org_id,
    expert_id: row.expert_id,
    role: row.role,
    content: row.content,
    phase: row.phase,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
    created_at: row.created_at,
  };
}

/**
 * BFF API helpers for Clowder.
 *
 * All calls go through here — adds auth header, handles errors.
 */

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

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export async function createClowderSession(body: {
  name?: string;
  description: string;
  input_type?: string;
}): Promise<ClowderSession> {
  const res = await fetch(`${getApiBaseUrl()}/v1/clowder/sessions`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session: ${text}`);
  }
  const json = await res.json();
  return json.data as ClowderSession;
}

export async function getClowderSession(sessionId: string): Promise<{
  session: ClowderSession;
  experts: ClowderExpert[];
}> {
  const res = await fetch(`${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}`, {
    headers: buildHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const json = await res.json();
  return json.data as { session: ClowderSession; experts: ClowderExpert[] };
}

export async function listClowderMessages(sessionId: string): Promise<ClowderMessage[]> {
  const res = await fetch(
    `${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/messages`,
    { headers: buildHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Failed to list messages`);
  }
  const json = await res.json();
  return json.data as ClowderMessage[];
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
  const res = await fetch(
    `${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to send message`);
  }
  const json = await res.json();
  return json.data as ClowderMessage;
}

export async function listClowderExperts(sessionId: string): Promise<ClowderExpert[]> {
  const res = await fetch(
    `${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/experts`,
    { headers: buildHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Failed to list experts`);
  }
  const json = await res.json();
  return json.data as ClowderExpert[];
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
  const res = await fetch(
    `${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/experts`,
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to create expert`);
  }
  const json = await res.json();
  return json.data as ClowderExpert;
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
  const res = await fetch(
    `${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/experts/${expertId}`,
    {
      method: "PATCH",
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to update expert`);
  }
  const json = await res.json();
  return json.data as ClowderExpert;
}

export async function forceStartBuild(sessionId: string): Promise<ClowderSession> {
  const res = await fetch(
    `${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/force-start`,
    {
      method: "POST",
      headers: buildHeaders(),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to force start`);
  }
  const json = await res.json();
  return json.data as ClowderSession;
}

// ---------------------------------------------------------------------------
// Shared types
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

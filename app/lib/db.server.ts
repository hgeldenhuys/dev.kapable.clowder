/**
 * Clowder BFF-local SQLite database.
 *
 * Stores sessions, experts, and messages locally — no Rust API dependency.
 * Uses Bun's built-in SQLite (bun:sqlite) for zero-dependency persistence.
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

// Store DB in /app/data for container persistence, fallback to local dir
const DB_PATH = process.env.CLOWDER_DB_PATH ?? "./clowder.db";

let _db: Database | null = null;

function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH, { create: true });
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clowder_sessions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL DEFAULT '',
      description TEXT,
      phase TEXT NOT NULL DEFAULT 'assembling',
      input_type TEXT NOT NULL DEFAULT 'text',
      app_id TEXT,
      app_url TEXT,
      force_started_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clowder_experts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES clowder_sessions(id),
      org_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'core',
      domain TEXT NOT NULL,
      voice_id TEXT,
      confidence REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'unclear',
      blockers TEXT NOT NULL DEFAULT '[]',
      system_prompt TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clowder_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES clowder_sessions(id),
      org_id TEXT NOT NULL DEFAULT 'default',
      expert_id TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      content TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'assembling',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
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

export function createSession(body: {
  name?: string;
  description: string;
  input_type?: string;
}): SessionRow {
  const db = getDb();
  const id = randomUUID();
  let name = body.name || body.description;
  if (name.length > 60) {
    const cut = name.lastIndexOf(" ", 60);
    name = cut > 20 ? name.slice(0, cut) : name.slice(0, 60);
  }
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO clowder_sessions (id, name, description, input_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, body.description, body.input_type ?? "text", now, now);

  return getSession(id)!;
}

export function getSession(id: string): SessionRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM clowder_sessions WHERE id = ?").get(id) as SessionRow | null;
}

export function updateSessionPhase(id: string, phase: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE clowder_sessions SET phase = ?, updated_at = ? WHERE id = ?").run(phase, now, id);
}

export function listSessions(limit = 10): SessionRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM clowder_sessions ORDER BY created_at DESC LIMIT ?").all(limit) as SessionRow[];
}

export function setForceStarted(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE clowder_sessions SET force_started_at = ?, phase = 'planning', updated_at = ? WHERE id = ?"
  ).run(now, now, id);
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
  blockers: string; // JSON string
  system_prompt: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function createExpert(
  sessionId: string,
  body: {
    name: string;
    role: string;
    domain: string;
    voice_id?: string;
    system_prompt?: string;
    sort_order?: number;
  }
): ExpertRow {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO clowder_experts (id, session_id, name, role, domain, voice_id, system_prompt, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, body.name, body.role, body.domain, body.voice_id ?? null, body.system_prompt ?? null, body.sort_order ?? 0, now, now);

  return getExpert(id)!;
}

export function getExpert(id: string): ExpertRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM clowder_experts WHERE id = ?").get(id) as ExpertRow | null;
}

export function listExperts(sessionId: string): ExpertRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM clowder_experts WHERE session_id = ? ORDER BY sort_order").all(sessionId) as ExpertRow[];
}

export function updateExpert(
  id: string,
  body: {
    confidence?: number;
    status?: string;
    blockers?: string[];
    system_prompt?: string;
  }
): ExpertRow {
  const db = getDb();
  const parts: string[] = [];
  const values: unknown[] = [];

  if (body.confidence !== undefined) {
    parts.push("confidence = ?");
    values.push(body.confidence);
  }
  if (body.status !== undefined) {
    parts.push("status = ?");
    values.push(body.status);
  }
  if (body.blockers !== undefined) {
    parts.push("blockers = ?");
    values.push(JSON.stringify(body.blockers));
  }
  if (body.system_prompt !== undefined) {
    parts.push("system_prompt = ?");
    values.push(body.system_prompt);
  }

  if (parts.length > 0) {
    parts.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);
    db.prepare(`UPDATE clowder_experts SET ${parts.join(", ")} WHERE id = ?`).run(...values);
  }

  return getExpert(id)!;
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
  metadata: string; // JSON string
  created_at: string;
}

export function createMessage(
  sessionId: string,
  body: {
    content: string;
    expert_id?: string;
    role?: string;
    metadata?: Record<string, unknown>;
  }
): MessageRow {
  const db = getDb();
  const id = randomUUID();
  const session = getSession(sessionId);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO clowder_messages (id, session_id, expert_id, role, content, phase, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sessionId,
    body.expert_id ?? null,
    body.role ?? "user",
    body.content,
    session?.phase ?? "assembling",
    JSON.stringify(body.metadata ?? {}),
    now
  );

  return getMessage(id)!;
}

export function getMessage(id: string): MessageRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM clowder_messages WHERE id = ?").get(id) as MessageRow | null;
}

export function listMessages(sessionId: string): MessageRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM clowder_messages WHERE session_id = ? ORDER BY created_at").all(sessionId) as MessageRow[];
}

// ---------------------------------------------------------------------------
// Row → API type converters
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
    blockers: JSON.parse(row.blockers),
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
    metadata: JSON.parse(row.metadata),
    created_at: row.created_at,
  };
}

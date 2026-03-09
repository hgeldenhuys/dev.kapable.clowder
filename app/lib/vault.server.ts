/**
 * Vault client for Clowder context document storage.
 *
 * Uses the Kapable Vault API (git-backed document system) to store
 * context documents, interview logs, and uploaded text files.
 *
 * Vault paths: clowder/{sessionId}/context.md, interviews.jsonl, etc.
 */

const VAULT_BASE = process.env.KAPABLE_API_URL ?? "https://api.kapable.dev";
const API_KEY = process.env.CLOWDER_INTERNAL_API_KEY ?? "";

function vaultHeaders(contentType = "text/plain"): Record<string, string> {
  return {
    "x-api-key": API_KEY,
    "Content-Type": contentType,
  };
}

/**
 * Write a file to the org vault.
 */
export async function writeVaultFile(path: string, content: string): Promise<void> {
  const contentType = path.endsWith(".json") || path.endsWith(".jsonl")
    ? "application/json"
    : path.endsWith(".md")
      ? "text/markdown"
      : "text/plain";

  const res = await fetch(`${VAULT_BASE}/v1/vault/files/${path}`, {
    method: "PUT",
    headers: vaultHeaders(contentType),
    body: content,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`Vault write failed for ${path} (${res.status}): ${err.slice(0, 200)}`);
    // Don't throw — vault writes are best-effort, session still works without them
  }
}

/**
 * Read a file from the org vault.
 * Returns null if not found.
 */
export async function readVaultFile(path: string): Promise<string | null> {
  const res = await fetch(`${VAULT_BASE}/v1/vault/files/${path}`, {
    headers: { "x-api-key": API_KEY },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`Vault read failed for ${path} (${res.status})`);
    return null;
  }

  return res.text();
}

/**
 * Append a line to a vault file (for JSONL accumulation).
 * Reads existing content, appends the line, writes back.
 */
export async function appendVaultLine(path: string, line: string): Promise<void> {
  const existing = await readVaultFile(path);
  const newContent = existing ? `${existing.trimEnd()}\n${line}\n` : `${line}\n`;
  await writeVaultFile(path, newContent);
}

/**
 * Build the vault path for a session file.
 */
export function sessionVaultPath(sessionId: string, filename: string): string {
  return `clowder/${sessionId}/${filename}`;
}

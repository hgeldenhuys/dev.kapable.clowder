/**
 * File upload utilities for Clowder.
 *
 * Binary files → S3 via presigned URL (client-side upload)
 * Text files → Vault direct write (server-side)
 */

const API_BASE = process.env.KAPABLE_API_URL ?? "https://api.kapable.dev";
const API_KEY = process.env.CLOWDER_INTERNAL_API_KEY ?? "";

const TEXT_EXTENSIONS = new Set([
  "md", "txt", "json", "jsonl", "csv", "yaml", "yml",
  "ts", "tsx", "js", "jsx", "html", "css", "py", "rs",
  "toml", "xml", "svg", "sql", "sh", "env", "gitignore",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * Get a presigned URL for uploading a binary file to S3.
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const res = await fetch(`${API_BASE}/v1/storage/presign/upload`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      content_type: contentType,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Presign upload failed (${res.status}): ${err.slice(0, 200)}`);
  }

  return res.json() as Promise<{ url: string; key: string }>;
}

export interface UploadedFile {
  name: string;
  size: number;
  type: "text" | "binary";
  url: string;
  status: "uploading" | "done" | "error";
}

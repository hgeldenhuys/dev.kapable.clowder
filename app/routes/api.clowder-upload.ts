/**
 * BFF route for Clowder file uploads.
 *
 * POST /api/clowder-upload
 * Body: multipart form with { sessionId, file }
 *
 * Text files → written directly to Vault
 * Binary files → returns presigned S3 URL for client-side upload
 */

import type { Route } from "./+types/api.clowder-upload";
import { isTextFile, validateFileSize, getPresignedUploadUrl } from "~/lib/uploads.server";
import { writeVaultFile, sessionVaultPath } from "~/lib/vault.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const sessionId = String(formData.get("sessionId") ?? "");
  const file = formData.get("file") as File | null;

  if (!sessionId || !file) {
    return Response.json({ error: "sessionId and file are required" }, { status: 400 });
  }

  if (!validateFileSize(file.size)) {
    return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const filename = file.name;

  if (isTextFile(filename)) {
    // Text → write to Vault
    const content = await file.text();
    const vaultPath = sessionVaultPath(sessionId, filename);
    await writeVaultFile(vaultPath, content);

    return Response.json({
      filename,
      type: "text" as const,
      url: `/v1/vault/files/${vaultPath}`,
      size: file.size,
    });
  }

  // Binary → get presigned URL for client-side upload
  const contentType = file.type || "application/octet-stream";
  const { url, key } = await getPresignedUploadUrl(filename, contentType);

  return Response.json({
    filename,
    type: "binary" as const,
    uploadUrl: url,
    key,
    size: file.size,
  });
}

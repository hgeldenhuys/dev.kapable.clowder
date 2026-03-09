import { useState, useCallback, useRef } from "react";
import type { UploadedFile } from "~/lib/uploads.server";

interface FileDropZoneProps {
  sessionId?: string;
  files: UploadedFile[];
  onFileAdded: (file: UploadedFile) => void;
  onFileRemoved: (filename: string) => void;
  disabled?: boolean;
}

const MAX_FILES = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function FileDropZone({
  sessionId,
  files,
  onFileAdded,
  onFileRemoved,
  disabled = false,
}: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (files.length >= MAX_FILES) return;
      if (!sessionId) return;

      // Add as uploading immediately for UI feedback
      const placeholder: UploadedFile = {
        name: file.name,
        size: file.size,
        type: "text", // will be corrected by server response
        url: "",
        status: "uploading",
      };
      onFileAdded(placeholder);

      try {
        const formData = new FormData();
        formData.set("sessionId", sessionId);
        formData.set("file", file);

        const res = await fetch("/api/clowder-upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
          // Update file status to error
          onFileAdded({
            name: file.name,
            size: file.size,
            type: "text",
            url: "",
            status: "error",
          });
          console.error("Upload failed:", err.error);
          return;
        }

        const data = await res.json() as {
          filename: string;
          type: "text" | "binary";
          url?: string;
          uploadUrl?: string;
          key?: string;
          size: number;
        };

        if (data.type === "binary" && data.uploadUrl) {
          // Binary: upload to S3 via presigned URL
          const uploadRes = await fetch(data.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });

          if (!uploadRes.ok) {
            onFileAdded({
              name: file.name,
              size: file.size,
              type: "binary",
              url: "",
              status: "error",
            });
            return;
          }

          onFileAdded({
            name: data.filename,
            size: data.size,
            type: "binary",
            url: data.uploadUrl.split("?")[0], // clean URL without query params
            status: "done",
          });
        } else {
          // Text: already stored in Vault by the server
          onFileAdded({
            name: data.filename,
            size: data.size,
            type: "text",
            url: data.url ?? "",
            status: "done",
          });
        }
      } catch (e) {
        console.error("Upload error:", e);
        onFileAdded({
          name: file.name,
          size: file.size,
          type: "text",
          url: "",
          status: "error",
        });
      }
    },
    [sessionId, files.length, onFileAdded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || !sessionId) return;
      const droppedFiles = Array.from(e.dataTransfer.files);
      for (const file of droppedFiles) {
        uploadFile(file);
      }
    },
    [disabled, sessionId, uploadFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const selectedFiles = Array.from(e.target.files);
      for (const file of selectedFiles) {
        uploadFile(file);
      }
      // Reset input
      if (inputRef.current) inputRef.current.value = "";
    },
    [uploadFile],
  );

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-indigo-500 bg-indigo-500/10"
            : disabled
              ? "border-zinc-800 bg-zinc-900/50 cursor-not-allowed"
              : "border-zinc-700 hover:border-zinc-600"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled}
        />
        <p className="text-sm text-zinc-500">
          {disabled
            ? "Session ID needed to upload files — continue to step 2 first"
            : files.length >= MAX_FILES
              ? `Maximum ${MAX_FILES} files reached`
              : "Drop files here or click to browse (max 10 files, 10MB each)"
          }
        </p>
      </div>

      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <span
              key={f.name}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                f.status === "error"
                  ? "bg-red-500/20 text-red-300 border-red-500/30"
                  : f.status === "uploading"
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse"
                    : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}
            >
              {f.type === "text" ? "📄" : "📎"} {f.name}
              <span className="text-zinc-500">({formatFileSize(f.size)})</span>
              {f.status === "done" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemoved(f.name);
                  }}
                  className="ml-0.5 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              )}
              {f.status === "uploading" && (
                <span className="text-yellow-400">uploading...</span>
              )}
              {f.status === "error" && (
                <span className="text-red-400">failed</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

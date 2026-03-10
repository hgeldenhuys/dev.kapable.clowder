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
            ? "border-[#E07A5F] bg-[#E07A5F]/10"
            : disabled
              ? "border-[#E8E5DF] bg-[#F4F1EB]/50 cursor-not-allowed"
              : "border-[#E8E5DF] hover:border-[#6A6763]/40"
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
        <p className="text-sm text-[#6A6763]">
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
                  ? "bg-[#D94F4F]/15 text-[#D94F4F] border-[#D94F4F]/25"
                  : f.status === "uploading"
                    ? "bg-[#E8A838]/15 text-[#C08A2E] border-[#E8A838]/25 animate-pulse"
                    : "bg-[#F4F1EB] text-[#33312E] border-[#E8E5DF]"
              }`}
            >
              {f.type === "text" ? "📄" : "📎"} {f.name}
              <span className="text-[#6A6763]">({formatFileSize(f.size)})</span>
              {f.status === "done" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemoved(f.name);
                  }}
                  className="ml-0.5 hover:text-[#D94F4F] transition-colors"
                >
                  ✕
                </button>
              )}
              {f.status === "uploading" && (
                <span className="text-[#E8A838]">uploading...</span>
              )}
              {f.status === "error" && (
                <span className="text-[#D94F4F]">failed</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

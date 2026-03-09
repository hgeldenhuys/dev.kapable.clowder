import type { ReactNode } from "react";
import type { UploadedFile } from "~/lib/uploads.server";
import { FileDropZone } from "./FileDropZone";

export interface Step1Data {
  appName: string;
  description: string;
  files: UploadedFile[];
}

interface Step1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  sessionId?: string; // needed for file uploads
  children?: ReactNode; // slot for specialist preview chips
}

export function Step1Context({ data, onChange, sessionId, children }: Step1Props) {
  const descriptionLength = data.description.trim().length;
  const isValid = data.appName.trim().length >= 1 && descriptionLength >= 20;
  const wordCount = data.description.trim() ? data.description.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          What are you building?
        </h2>
        <p className="text-muted-foreground">
          Give your app a name and describe what it does. The more detail, the
          better your AI team can help.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="appName"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            App Name
          </label>
          <input
            id="appName"
            type="text"
            maxLength={60}
            placeholder="My Amazing App"
            value={data.appName}
            onChange={(e) => onChange({ ...data, appName: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground mt-1 block text-right">
            {data.appName.length}/60
          </span>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Description
          </label>
          <div className="relative">
            <textarea
              id="description"
              placeholder="Describe your app idea in detail — who are the users, what do they do, what data is needed?"
              value={data.description}
              onChange={(e) =>
                onChange({ ...data, description: e.target.value })
              }
              className="w-full min-h-[160px] px-4 py-3 pb-8 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-base"
              autoFocus
            />
            <span
              className={`absolute bottom-2 right-3 text-xs ${
                wordCount >= 200
                  ? "text-green-400"
                  : descriptionLength >= 20
                    ? "text-muted-foreground"
                    : "text-yellow-500"
              }`}
            >
              {wordCount} word{wordCount !== 1 ? "s" : ""}
              {descriptionLength < 20 && " (min 20 chars)"}
              {wordCount >= 200 && " — instant build!"}
            </span>
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Reference Files <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <FileDropZone
            sessionId={sessionId}
            files={data.files}
            onFileAdded={(file) => {
              // Replace existing file with same name (update status), or add new
              const existing = data.files.findIndex((f) => f.name === file.name);
              const updated = [...data.files];
              if (existing >= 0) {
                updated[existing] = file;
              } else {
                updated.push(file);
              }
              onChange({ ...data, files: updated });
            }}
            onFileRemoved={(filename) => {
              onChange({ ...data, files: data.files.filter((f) => f.name !== filename) });
            }}
            disabled={!sessionId}
          />
        </div>
      </div>

      {/* Specialist preview chips (from predict-experts) */}
      {children}

      {/* Validation hint */}
      {!isValid && (data.appName.trim() || data.description.trim()) && (
        <p className="text-xs text-yellow-500 text-center">
          {!data.appName.trim()
            ? "Enter an app name to continue"
            : "Description needs at least 20 characters"}
        </p>
      )}
    </div>
  );
}

/** Check if step 1 data is valid for proceeding */
export function isStep1Valid(data: Step1Data): boolean {
  return data.appName.trim().length >= 1 && data.description.trim().length >= 20;
}

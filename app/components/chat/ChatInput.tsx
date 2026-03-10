"use client";

import { useRef, type FormEvent } from "react";
import { Send, Play } from "lucide-react";
import type { ClowderMessage } from "~/lib/api.server";
import { BuildProgressTimeline } from "~/components/deploy/BuildProgressTimeline";

interface ChatInputProps {
  sessionId: string;
  isBuilding?: boolean;
  phase?: string;
  messages?: ClowderMessage[];
  appUrl?: string;
  onSend?: (content: string) => void;
  onForceStart?: () => void;
  onRetryBuild?: () => void;
  onFileDrop?: (file: File) => void;
}

/**
 * Text-only chat input with file drop zone and "Force Start" button.
 * No voice — v1 is text-only.
 */
export function ChatInput({
  sessionId,
  isBuilding = false,
  phase = "",
  messages = [],
  appUrl,
  onSend,
  onForceStart,
  onRetryBuild,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const content = textareaRef.current?.value.trim();
    if (!content) return;
    onSend?.(content);
    if (textareaRef.current) textareaRef.current.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  }

  if (isBuilding) {
    return (
      <div className="py-3 px-2">
        <BuildProgressTimeline messages={messages} phase={phase} appUrl={appUrl} onRetry={onRetryBuild} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            name="content"
            placeholder="Reply to your expert committee… (Enter to send, Shift+Enter for newline)"
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="flex-none p-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity self-end"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </form>

      {onForceStart && (
        <div className="flex items-center justify-center px-1">
          <button
            type="button"
            onClick={onForceStart}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors shadow-md shadow-emerald-900/30"
          >
            <Play size={14} fill="currentColor" />
            <span>I'm satisfied — start building</span>
          </button>
        </div>
      )}
    </div>
  );
}

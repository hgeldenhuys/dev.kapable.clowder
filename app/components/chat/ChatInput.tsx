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
      <form onSubmit={handleSubmit} className="flex gap-2.5 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            name="content"
            placeholder="Reply to your expert committee… (Enter to send, Shift+Enter for newline)"
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full px-4 py-3 pr-12 rounded-2xl border border-[#E8E5DF] bg-white text-foreground placeholder:text-[#6A6763]/50 resize-none focus:outline-none focus:ring-2 focus:ring-[#E07A5F]/20 focus:border-[#E07A5F]/40 focus:bg-white text-sm backdrop-blur-sm transition-all"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="flex-none p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[var(--shadow-sm)] hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.03] active:scale-[0.97] transition-all self-end"
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
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-900/25 hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play size={14} fill="currentColor" />
            <span>I'm satisfied — start building</span>
          </button>
        </div>
      )}
    </div>
  );
}

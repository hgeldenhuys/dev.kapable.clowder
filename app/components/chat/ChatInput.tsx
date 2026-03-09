"use client";

import { useRef, type FormEvent } from "react";
import { Send, Paperclip, Play } from "lucide-react";

interface ChatInputProps {
  sessionId: string;
  isBuilding?: boolean;
  onSend?: (content: string) => void;
  onForceStart?: () => void;
  onFileDrop?: (file: File) => void;
}

/**
 * Text-only chat input with file drop zone and "Force Start" button.
 * No voice — v1 is text-only.
 */
export function ChatInput({
  sessionId,
  isBuilding = false,
  onSend,
  onForceStart,
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
      <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
        <div className="animate-pulse">Your experts are building your app…</div>
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

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip size={12} />
          <span>File drop coming in v2</span>
        </div>
        {onForceStart && (
          <button
            type="button"
            onClick={onForceStart}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
          >
            <Play size={12} className="group-hover:text-primary" />
            <span>I'm ready — start building</span>
          </button>
        )}
      </div>
    </div>
  );
}

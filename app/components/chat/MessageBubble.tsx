import { useState, useEffect, useMemo } from "react";
import type { ClowderMessage, ClowderExpert } from "~/lib/api.server";

/** Minimal markdown: **bold**, *italic*, `code`, and - bullet lists */
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
}

interface MessageBubbleProps {
  message: ClowderMessage;
  experts: ClowderExpert[];
}

function useClientTime(isoString: string): string {
  const [time, setTime] = useState("");
  useEffect(() => {
    setTime(
      new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [isoString]);
  return time;
}

export function MessageBubble({ message, experts }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const timeStr = useClientTime(message.created_at);
  const expert = message.expert_id
    ? experts.find((e) => e.id === message.expert_id)
    : null;
  const html = useMemo(() => renderSimpleMarkdown(message.content), [message.content]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 space-y-1 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card text-foreground border border-border rounded-tl-sm"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary">
              {expert?.name ?? "Product Owner"}
            </span>
            {expert && expert.domain.toLowerCase() !== expert.name.toLowerCase() && (
              <span className="text-xs text-muted-foreground capitalize">
                · {expert.domain}
              </span>
            )}
          </div>
        )}
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {timeStr && (
          <p className="text-xs opacity-50 text-right">
            {timeStr}
          </p>
        )}
      </div>
    </div>
  );
}

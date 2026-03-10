import { useState, useEffect, useMemo } from "react";
import type { ClowderMessage, ClowderExpert } from "~/lib/api.server";
import { ExpertAvatar } from "./ExpertAvatar";

/** Minimal markdown: **bold**, *italic*, `code`, ```code blocks```, and - bullet lists */
function renderSimpleMarkdown(text: string): string {
  // Escape HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (triple backtick)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-zinc-900 border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>'
  );

  // Inline formatting
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-xs text-emerald-400">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>');

  return html;
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
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Expert avatar */}
      {!isUser && (
        <ExpertAvatar
          domain={expert?.domain ?? "system"}
          name={expert?.name ?? "System"}
          size="sm"
          className="mt-1"
        />
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 space-y-1 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card text-foreground border-l-2 rounded-tl-sm"
        }`}
        style={
          !isUser
            ? { borderLeftColor: `var(--expert-color, oklch(0.65 0.2 280))` }
            : undefined
        }
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary">
              {expert?.name ?? (message.phase === "interviewing" ? "Product Owner" : "System")}
            </span>
            {expert && (
              <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700/50">
                {expert.domain.replace(/_/g, " ")}
              </span>
            )}
          </div>
        )}
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {timeStr && (
          <p className="text-[10px] opacity-40 text-right mt-1">
            {timeStr}
          </p>
        )}
      </div>
    </div>
  );
}

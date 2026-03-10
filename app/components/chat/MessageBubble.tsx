import { useState, useEffect, useMemo } from "react";
import type { ClowderMessage, ClowderExpert } from "~/lib/api.server";
import { ExpertAvatar, getExpertIcon } from "./ExpertAvatar";

/** Domain-specific border colors for expert messages (solid, not gradient) */
const DOMAIN_BORDER_COLORS: Record<string, string> = {
  strategist: "#5B8FB9",   // warm blue
  designer: "#9B6B8E",     // warm plum
  architect: "#E8A838",    // amber
  commerce: "#81B29A",     // sage
  compliance: "#D94F4F",   // warm red
  growth: "#C75B8F",       // warm pink
  security: "#7A7572",     // warm gray
  data: "#6B6BA0",         // warm indigo
  analytics: "#5B9B8F",    // warm teal
  content: "#C75B8F",      // warm rose
  ai_ml: "#8B6BA0",        // warm purple
  system: "#9A9690",       // taupe
};

function getDomainBorderColor(domain: string): string {
  const d = domain.toLowerCase();
  for (const [key, color] of Object.entries(DOMAIN_BORDER_COLORS)) {
    if (d.includes(key)) return color;
  }
  return "#9B6B8E"; // fallback plum
}

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
    '<pre class="bg-[#F4F1EB] border border-[#E8E5DF] rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>'
  );

  // Inline formatting
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-[#F4F1EB] px-1.5 py-0.5 rounded text-xs text-[#E07A5F]">$1</code>')
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
            ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-md shadow-[var(--shadow-sm)]"
            : "bg-white text-foreground rounded-tl-md shadow-[var(--shadow-sm)] border border-[#E8E5DF] border-l-2"
        }`}
        style={
          !isUser
            ? { borderLeftColor: getDomainBorderColor(expert?.domain ?? "system") }
            : undefined
        }
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            {expert && (
              <span className="text-xs opacity-60" title={expert.domain.replace(/_/g, " ")}>
                {getExpertIcon(expert.domain)}
              </span>
            )}
            <span className="text-xs font-semibold text-primary">
              {expert?.name ?? (message.role === "system" ? "System" : "Clowder")}
            </span>
            {expert && (
              <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 rounded-full bg-[#F4F1EB] border border-[#E8E5DF]">
                {expert.domain.replace(/_/g, " ")}
              </span>
            )}
            {expert && expert.confidence >= 0.8 && (
              <span className="text-[10px] text-[#81B29A] px-1.5 py-0.5 rounded-full bg-[#81B29A]/10 border border-[#81B29A]/20">
                ready
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

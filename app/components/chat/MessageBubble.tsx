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
    '<pre class="bg-secondary border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>'
  );

  // Inline formatting
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-secondary px-1.5 py-0.5 rounded text-xs text-primary">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>');

  return html;
}

interface MessageBubbleProps {
  message: ClowderMessage;
  experts: ClowderExpert[];
  /** Whether this is the first message in a consecutive group from the same expert */
  isFirstInGroup?: boolean;
  /** Whether this is the last message in a consecutive group from the same expert */
  isLastInGroup?: boolean;
}

function useClientTime(isoString: string): string {
  const [time, setTime] = useState("");
  useEffect(() => {
    const date = new Date(isoString);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) {
      setTime("just now");
    } else if (diffMin < 60) {
      setTime(`${diffMin}m ago`);
    } else {
      setTime(
        date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  }, [isoString]);
  return time;
}

export function MessageBubble({
  message,
  experts,
  isFirstInGroup = true,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const timeStr = useClientTime(message.created_at);
  const expert = message.expert_id
    ? experts.find((e) => e.id === message.expert_id)
    : null;
  const html = useMemo(() => renderSimpleMarkdown(message.content), [message.content]);
  const borderColor = getDomainBorderColor(expert?.domain ?? "system");

  // For grouped non-user messages: only show avatar on first message
  const showAvatar = !isUser && isFirstInGroup;
  // For grouped non-user messages: only show header (name, domain) on first message
  const showHeader = !isUser && isFirstInGroup;
  // Only show timestamp on last message in group
  const showTime = isLastInGroup;

  // Avatar placeholder width for alignment when avatar is hidden
  const avatarPlaceholder = !isUser && !isFirstInGroup;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Expert avatar or spacer for alignment */}
      {showAvatar && (
        <ExpertAvatar
          domain={expert?.domain ?? "system"}
          name={expert?.name ?? "System"}
          size="sm"
          className="mt-1"
        />
      )}
      {avatarPlaceholder && (
        <div className="w-8 flex-none" />
      )}

      <div
        className={`max-w-[90%] md:max-w-[75%] px-4 py-3 space-y-1 ${
          isUser
            ? `bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[var(--shadow-sm)] ${
                isFirstInGroup ? "rounded-2xl rounded-tr-md" : isLastInGroup ? "rounded-2xl rounded-br-md" : "rounded-xl"
              }`
            : `bg-card text-foreground shadow-[var(--shadow-sm)] border border-border border-l-2 ${
                isFirstInGroup ? "rounded-2xl rounded-tl-md" : isLastInGroup ? "rounded-2xl rounded-bl-md" : "rounded-xl"
              }`
        }`}
        style={
          !isUser
            ? { borderLeftColor: borderColor }
            : undefined
        }
      >
        {showHeader && (
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
              <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 rounded-full bg-secondary border border-border">
                {expert.domain.replace(/_/g, " ")}
              </span>
            )}
            {expert && expert.confidence >= 0.8 && (
              <span className="text-[10px] text-accent px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                ready
              </span>
            )}
          </div>
        )}
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {showTime && timeStr && (
          <p className="text-[10px] opacity-40 text-right mt-1">
            {timeStr}
          </p>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import type { ClowderMessage, ClowderExpert } from "~/lib/api.server";

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

/** Domain-specific gradient colors for expert avatars */
const EXPERT_GRADIENTS: Record<string, string> = {
  strategist: "from-cyan-500 to-blue-600",
  designer: "from-violet-500 to-purple-600",
  architect: "from-amber-500 to-orange-600",
  commerce: "from-emerald-500 to-green-600",
  compliance: "from-red-500 to-rose-600",
  growth: "from-pink-500 to-fuchsia-600",
  security: "from-slate-500 to-zinc-600",
  data: "from-indigo-500 to-blue-600",
  payments: "from-yellow-500 to-amber-600",
};

function getExpertGradient(expert: ClowderExpert | null): string {
  if (!expert) return "from-zinc-500 to-zinc-600";
  const domain = expert.domain.toLowerCase();
  for (const [key, gradient] of Object.entries(EXPERT_GRADIENTS)) {
    if (domain.includes(key)) return gradient;
  }
  // Fallback: hash the name to pick a consistent color
  const hash = expert.name.charCodeAt(0) % 5;
  const fallbacks = [
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-purple-600",
    "from-amber-500 to-orange-600",
    "from-emerald-500 to-green-600",
    "from-pink-500 to-fuchsia-600",
  ];
  return fallbacks[hash];
}

/** Domain-specific icons (Unicode symbols) */
function getExpertIcon(expert: ClowderExpert | null): string {
  if (!expert) return "◈";
  const domain = expert.domain.toLowerCase();
  if (domain.includes("strateg")) return "♟";
  if (domain.includes("design")) return "◐";
  if (domain.includes("architect")) return "△";
  if (domain.includes("commerce") || domain.includes("payment")) return "◇";
  if (domain.includes("security") || domain.includes("compliance")) return "◉";
  if (domain.includes("growth")) return "↗";
  if (domain.includes("data")) return "⬡";
  return "◈";
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
  const gradient = getExpertGradient(expert);
  const icon = getExpertIcon(expert);

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Expert avatar */}
      {!isUser && (
        <div
          className={`flex-none w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shadow-lg mt-1`}
          title={expert?.name ?? "System"}
        >
          {icon}
        </div>
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

import { useState, useEffect } from "react";
import type { ClowderMessage, ClowderExpert } from "~/lib/api.server";

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
              {expert?.name ?? "System"}
            </span>
            {expert && (
              <span className="text-xs text-muted-foreground capitalize">
                · {expert.domain}
              </span>
            )}
          </div>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        {timeStr && (
          <p className="text-xs opacity-50 text-right">
            {timeStr}
          </p>
        )}
      </div>
    </div>
  );
}

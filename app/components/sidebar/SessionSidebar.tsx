"use client";

import { Link } from "react-router";
import type { ClowderSession } from "~/lib/api.server";

const phaseColors: Record<string, string> = {
  assembling: "bg-yellow-400",
  ideating: "bg-blue-400",
  planning: "bg-purple-400",
  building: "bg-green-400",
  delivered: "bg-emerald-400",
};

interface SessionSidebarProps {
  sessions: ClowderSession[];
  currentSessionId: string;
  onClose: () => void;
}

/**
 * Collapsible sidebar listing all Clowder sessions.
 * Click to switch sessions, shows phase badge and app URL.
 */
export function SessionSidebar({ sessions, currentSessionId, onClose }: SessionSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-card/80 backdrop-blur-sm border-r border-border w-64">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessions</span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.map((s) => {
          const isCurrent = s.id === currentSessionId;
          const dotColor = phaseColors[s.phase] ?? "bg-muted-foreground";

          return (
            <Link
              key={s.id}
              to={`/session/${s.id}`}
              className={`block px-3 py-2.5 transition-colors ${
                isCurrent
                  ? "bg-primary/10 border-l-2 border-primary"
                  : "hover:bg-card border-l-2 border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-none ${dotColor}`} />
                <span className={`text-xs truncate ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {s.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 pl-4">
                <span className="text-[10px] text-muted-foreground/50 capitalize">{s.phase}</span>
                {s.app_url && (
                  <span className="text-[10px] text-emerald-400/60">live</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 px-3 py-2">
        <Link
          to="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <span>+</span>
          <span>New session</span>
        </Link>
      </div>
    </div>
  );
}

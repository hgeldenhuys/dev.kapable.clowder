"use client";

import { Link, useNavigate } from "react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { ClowderSession } from "~/lib/api.server";

const phaseColors: Record<string, string> = {
  assembling: "bg-[#E8A838]",
  ideating: "bg-[#5B8FB9]",
  planning: "bg-[#9B6B8E]",
  building: "bg-[#81B29A]",
  delivered: "bg-[#81B29A]",
};

interface SessionSidebarProps {
  sessions: ClowderSession[];
  currentSessionId: string;
  onClose: () => void;
}

/**
 * Collapsible sidebar listing all Clowder sessions.
 * Triple-dot menu on each session for rename and delete.
 * Uses optimistic state updates — no page reloads.
 */
export function SessionSidebar({ sessions: initialSessions, currentSessionId, onClose }: SessionSidebarProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Sync with prop changes (e.g. new session created via SSE)
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenId]);

  async function handleRename(sessionId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    // Optimistic update
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, name: trimmed } : s))
    );
    setRenamingId(null);
    try {
      const res = await fetch(`/api/clowder-session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Rename failed");
      toast.success("Session renamed");
    } catch {
      // Revert optimistic update
      setSessions(initialSessions);
      toast.error("Failed to rename session");
    }
  }

  async function handleDelete(sessionId: string) {
    // Optimistic removal
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/clowder-session/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Session deleted");
      if (sessionId === currentSessionId) {
        navigate("/");
      }
    } catch {
      // Revert optimistic update
      setSessions(initialSessions);
      toast.error("Failed to delete session");
    }
  }

  return (
    <div className="h-full flex flex-col bg-white/90 backdrop-blur-sm border-r border-border w-[85vw] max-w-[280px] md:w-64">
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
          const isRenaming = renamingId === s.id;

          return (
            <div
              key={s.id}
              className={`group relative px-3 py-2.5 transition-colors ${
                isCurrent
                  ? "bg-primary/10 border-l-2 border-primary"
                  : "hover:bg-card border-l-2 border-transparent"
              }`}
            >
              {isRenaming ? (
                /* Inline rename input */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRename(s.id);
                  }}
                  className="flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full flex-none ${dotColor}`} />
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setRenamingId(null);
                      }
                    }}
                    className="flex-1 text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground outline-none focus:border-primary"
                  />
                </form>
              ) : (
                /* Normal session link */
                <Link to={`/session/${s.id}`} className="block">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-none ${dotColor}`} />
                    <span className={`text-xs truncate ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {s.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-4">
                    <span className="text-[10px] text-muted-foreground/50 capitalize">{s.phase}</span>
                    {s.app_url && (
                      <span className="text-[10px] text-[#81B29A]/60">live</span>
                    )}
                  </div>
                </Link>
              )}

              {/* Triple-dot menu trigger */}
              {!isRenaming && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === s.id ? null : s.id);
                  }}
                  className="absolute right-2 top-2.5 p-1 rounded text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-background/50 transition-all"
                  aria-label="Session options"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              )}

              {/* Context menu dropdown */}
              {menuOpenId === s.id && (
                <div
                  ref={menuRef}
                  className="absolute right-2 top-9 z-50 w-32 rounded-lg bg-popover border border-border shadow-xl py-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpenId(null);
                      setRenameValue(s.name);
                      setRenamingId(s.id);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpenId(null);
                      setConfirmDeleteId(s.id);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-5 w-80 max-w-[90vw]">
            <h3 className="text-sm font-semibold text-foreground mb-2">Delete session?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently delete the session, all expert data, and all messages. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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

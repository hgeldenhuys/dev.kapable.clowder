"use client";

import { useState, useEffect, useCallback } from "react";

interface ShortcutAction {
  key: string;
  label: string;
  shortcut: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  actions: ShortcutAction[];
}

/**
 * Cmd+K shortcut palette — shows available keyboard shortcuts.
 * Also registers global keyboard listeners for the shortcuts.
 */
export function KeyboardShortcuts({ actions }: KeyboardShortcutsProps) {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // Escape to close
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      // Execute shortcuts when palette is closed (don't interfere with typing)
      if (!open) return;

      for (const action of actions) {
        const parts = action.shortcut.toLowerCase().split("+");
        const needsMeta = parts.includes("cmd") || parts.includes("ctrl");
        const needsShift = parts.includes("shift");
        const key = parts[parts.length - 1];

        if (needsMeta && !(e.metaKey || e.ctrlKey)) continue;
        if (needsShift && !e.shiftKey) continue;
        if (e.key.toLowerCase() === key) {
          e.preventDefault();
          action.action();
          setOpen(false);
          return;
        }
      }
    },
    [open, actions]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-80 max-w-[90vw] rounded-xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Keyboard Shortcuts</p>
        </div>
        <div className="py-1">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                action.action();
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-primary/10 transition-colors text-left"
            >
              <span className="text-sm text-foreground">{action.label}</span>
              <kbd className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border/50 font-mono">
                {action.shortcut}
              </kbd>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/50 text-center">Press Esc to close</p>
        </div>
      </div>
    </>
  );
}

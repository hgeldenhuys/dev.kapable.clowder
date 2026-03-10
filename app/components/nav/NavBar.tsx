import { useState } from "react";

export function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" className="w-6 h-6" alt="Clowder" />
          <span className="font-bold text-lg text-foreground">Clowder</span>
        </a>

        {/* Desktop navigation links */}
        <div className="hidden sm:flex sm:items-center sm:gap-6">
          <a
            href="#how-it-works"
            className="text-sm text-stone-600 hover:text-orange-700 hover:underline underline-offset-4 transition-colors"
          >
            How it works
          </a>
          <a
            href="https://pulse.kapable.run"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-stone-600 hover:text-orange-700 hover:underline underline-offset-4 transition-colors"
          >
            See Pulse
          </a>
          <a
            href="https://console.kapable.dev"
            className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium transition-colors"
          >
            Sign in
          </a>
        </div>

        {/* Hamburger icon — mobile only */}
        <button
          type="button"
          className="sm:hidden p-2 -mr-2 text-stone-600 hover:text-stone-900 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile slide-down panel */}
      <div
        className={`sm:hidden overflow-hidden transition-all duration-300 ${menuOpen ? "max-h-[200px]" : "max-h-0"}`}
      >
        <div className="flex flex-col border-t border-border/40 bg-background">
          <a
            href="#how-it-works"
            onClick={() => setMenuOpen(false)}
            className="py-3 px-6 text-base text-stone-600 hover:text-orange-700 hover:bg-stone-50 transition-colors"
          >
            How it works
          </a>
          <a
            href="https://pulse.kapable.run"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="py-3 px-6 text-base text-stone-600 hover:text-orange-700 hover:bg-stone-50 transition-colors"
          >
            See Pulse
          </a>
          <a
            href="https://console.kapable.dev"
            onClick={() => setMenuOpen(false)}
            className="py-3 px-6 text-base text-stone-700 font-medium hover:bg-stone-50 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    </nav>
  );
}

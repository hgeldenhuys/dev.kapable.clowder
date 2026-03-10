export function NavBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" className="w-6 h-6" alt="Clowder" />
          <span className="font-bold text-lg text-foreground">Clowder</span>
        </a>

        {/* Navigation links */}
        <div className="flex items-center gap-6">
          <a
            href="#community"
            className="hidden sm:inline text-sm text-stone-600 hover:text-stone-900 transition-colors"
          >
            How it works
          </a>
          <a
            href="https://pulse.kapable.run"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-stone-600 hover:text-stone-900 transition-colors"
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
      </div>
    </nav>
  );
}

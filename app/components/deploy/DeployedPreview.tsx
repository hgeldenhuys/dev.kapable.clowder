import { useState, useEffect, useCallback } from "react";

interface DeployedPreviewProps {
  appUrl: string;
  appName: string;
  onCopyUrl: () => void;
}

/**
 * Inline iframe preview of a deployed Clowder app.
 * Shows the live app with a toolbar for opening in new tab, copying URL, and viewport switching.
 */
export function DeployedPreview({ appUrl, appName, onCopyUrl }: DeployedPreviewProps) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fallback: hide spinner after 4s even if onLoad doesn't fire (SSR hydration race)
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleCopy = useCallback(() => {
    onCopyUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopyUrl]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Preview toolbar */}
      <div className="flex-none flex items-center gap-2 px-4 py-2.5 bg-card border-b border-border shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-medium text-accent">Live</span>
        </div>
        <span className="text-xs text-muted-foreground truncate flex-1 mx-2">
          {appUrl}
        </span>

        {/* Viewport toggle */}
        <button
          type="button"
          onClick={() => setViewport("desktop")}
          className={`p-1.5 rounded text-xs transition-colors ${viewport === "desktop" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          title="Desktop view"
          aria-label="Desktop view"
          aria-pressed={viewport === "desktop"}
        >
          ▢
        </button>
        <button
          type="button"
          onClick={() => setViewport("mobile")}
          className={`p-1.5 rounded text-xs transition-colors ${viewport === "mobile" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          title="Mobile view"
          aria-label="Mobile view"
          aria-pressed={viewport === "mobile"}
        >
          ▯
        </button>

        <span className="w-px h-4 bg-border" />

        {/* Copy URL */}
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          aria-label={copied ? "URL copied" : "Copy URL to clipboard"}
        >
          {copied ? "Copied!" : "Copy URL"}
        </button>

        {/* Open in new tab */}
        <a
          href={appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1"
        >
          Open ↗
        </a>
      </div>

      {/* iframe container */}
      <div className="flex-1 flex items-start justify-center overflow-hidden p-2 bg-secondary">
        <div
          className={`relative rounded-lg overflow-hidden shadow-2xl shadow-primary/5 transition-all duration-300 h-full ${
            viewport === "mobile" ? "w-[375px]" : "w-full"
          }`}
        >
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary gap-3 z-10 pointer-events-none transition-opacity duration-500">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading {appName}...</p>
            </div>
          )}
          <iframe
            src={appUrl}
            title={`${appName} — Live Preview`}
            className="w-full h-full border-0 bg-card"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}

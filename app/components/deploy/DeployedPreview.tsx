import { useState, useCallback } from "react";

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

  const handleCopy = useCallback(() => {
    onCopyUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopyUrl]);

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Preview toolbar */}
      <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Live</span>
        </div>
        <span className="text-xs text-muted-foreground truncate flex-1 mx-2">
          {appUrl}
        </span>

        {/* Viewport toggle */}
        <button
          type="button"
          onClick={() => setViewport("desktop")}
          className={`p-1.5 rounded text-xs transition-colors ${viewport === "desktop" ? "bg-zinc-700 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          title="Desktop view"
        >
          ▢
        </button>
        <button
          type="button"
          onClick={() => setViewport("mobile")}
          className={`p-1.5 rounded text-xs transition-colors ${viewport === "mobile" ? "bg-zinc-700 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          title="Mobile view"
        >
          ▯
        </button>

        <span className="w-px h-4 bg-border" />

        {/* Copy URL */}
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
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
      <div className="flex-1 flex items-start justify-center overflow-hidden p-2">
        <div
          className={`relative bg-white rounded-lg overflow-hidden shadow-2xl shadow-primary/5 transition-all duration-300 h-full ${
            viewport === "mobile" ? "w-[375px]" : "w-full"
          }`}
        >
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading {appName}...</p>
            </div>
          )}
          <iframe
            src={appUrl}
            title={`${appName} — Live Preview`}
            className="w-full h-full border-0"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}

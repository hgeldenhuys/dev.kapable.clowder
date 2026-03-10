/**
 * Loading skeleton for the session page.
 * Shows placeholder layout while data loads.
 */
export function SessionSkeleton() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar skeleton */}
      <div className="flex-none h-[60px] border-b border-border" style={{ background: "var(--background)" }}>
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
          <div className="w-6 h-6 rounded-full bg-border animate-pulse" />
          <div className="w-32 h-4 rounded bg-border animate-pulse" />
          <div className="w-16 h-3 rounded bg-border/60 animate-pulse" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat skeleton */}
        <div className="flex-1 flex flex-col">
          {/* Expert header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <div className="w-10 h-10 rounded-full bg-border animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-24 h-3.5 rounded bg-border animate-pulse" />
              <div className="w-16 h-2.5 rounded bg-border/60 animate-pulse" />
            </div>
          </div>

          {/* Messages skeleton */}
          <div className="flex-1 px-4 py-4 space-y-4">
            {/* Expert message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-border animate-pulse flex-none" />
              <div className="space-y-2 max-w-[65%]">
                <div className="w-20 h-3 rounded bg-border/60 animate-pulse" />
                <div className="w-full h-16 rounded-2xl bg-border/40 animate-pulse" />
              </div>
            </div>

            {/* User message */}
            <div className="flex justify-end">
              <div className="w-48 h-12 rounded-2xl bg-primary/10 animate-pulse" />
            </div>

            {/* Expert message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-border animate-pulse flex-none" />
              <div className="space-y-2 max-w-[65%]">
                <div className="w-24 h-3 rounded bg-border/60 animate-pulse" />
                <div className="w-72 h-20 rounded-2xl bg-border/40 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Input skeleton */}
          <div className="border-t border-border/30 p-4">
            <div className="w-full h-14 rounded-xl bg-border/30 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

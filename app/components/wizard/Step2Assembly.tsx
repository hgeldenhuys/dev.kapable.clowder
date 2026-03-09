export interface Specialist {
  type: string;
  name: string;
  confidence: number;
  reason?: string;
}

interface Step2Props {
  appName: string;
  specialists: Specialist[];
  loading: boolean;
  onRemoveSpecialist: (type: string) => void;
}

// Domain display config — colors for specialist chips
const domainConfig: Record<string, { label: string; color: string }> = {
  commerce: { label: "Commerce", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  compliance: { label: "Compliance", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  growth: { label: "Growth", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  analytics: { label: "Analytics", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  security: { label: "Security", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  iot: { label: "IoT", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  content: { label: "Content", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  ai_ml: { label: "AI/ML", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  realtime: { label: "Realtime", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  mapping: { label: "Mapping", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  social: { label: "Social", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  scheduling: { label: "Scheduling", color: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  logistics: { label: "Logistics", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  healthcare: { label: "Healthcare", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  education: { label: "Education", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  finance: { label: "Finance", color: "bg-lime-500/20 text-lime-300 border-lime-500/30" },
  media: { label: "Media", color: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30" },
};

const defaultChipColor = "bg-gray-500/20 text-gray-300 border-gray-500/30";

const coreTeam = [
  { name: "Strategist", style: "bg-primary/20 text-primary border-primary/30" },
  { name: "Designer", style: "bg-primary/20 text-primary border-primary/30" },
  { name: "Architect", style: "bg-primary/20 text-primary border-primary/30" },
];

export function Step2Assembly({
  appName,
  specialists,
  loading,
  onRemoveSpecialist,
}: Step2Props) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Assembling your team
          {appName ? (
            <>
              {" "}for{" "}
              <span className="text-primary">{appName}</span>
            </>
          ) : (
            "..."
          )}
        </h2>
        <p className="text-muted-foreground">
          Your core team is ready. Specialists are being selected based on your
          project description.
        </p>
      </div>

      {/* Core team — always present */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Core Team
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {coreTeam.map((expert) => (
            <span
              key={expert.name}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${expert.style}`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-current" />
              {expert.name}
            </span>
          ))}
        </div>
      </div>

      {/* Specialists — from typehead or predict-experts */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Specialists
          {loading && (
            <span className="ml-2 text-indigo-400 animate-pulse">
              analyzing...
            </span>
          )}
        </h3>
        <div className="flex flex-wrap gap-2 justify-center min-h-[40px]">
          {specialists.length === 0 && !loading && (
            <span className="text-sm text-zinc-500">
              No additional specialists suggested
            </span>
          )}
          {specialists.map((s) => {
            const config = domainConfig[s.type];
            const label =
              config?.label ??
              s.name ??
              s.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            const colorClass = config?.color ?? defaultChipColor;

            return (
              <span
                key={s.type}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-300 ${colorClass}`}
                style={{ opacity: Math.max(0.5, s.confidence) }}
                title={s.reason || `Confidence: ${Math.round(s.confidence * 100)}%`}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-current" />
                {label}
                <button
                  type="button"
                  onClick={() => onRemoveSpecialist(s.type)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-red-400"
                  title="Remove specialist"
                >
                  ✕
                </button>
              </span>
            );
          })}
          {loading && (
            <span className="inline-flex items-center px-3 py-1.5 text-sm text-muted-foreground animate-pulse">
              <span className="inline-block w-2 h-2 rounded-full bg-zinc-600 mr-2 animate-bounce" />
              discovering...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

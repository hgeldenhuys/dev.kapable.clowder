import { ExpertAvatar } from "~/components/chat/ExpertAvatar";

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
  commerce: { label: "Commerce", color: "bg-[#E8A838]/15 text-[#C08A2E] border-[#E8A838]/25" },
  compliance: { label: "Compliance", color: "bg-[#D94F4F]/15 text-[#C04545] border-[#D94F4F]/25" },
  growth: { label: "Growth", color: "bg-accent/15 text-accent border-accent/25" },
  analytics: { label: "Analytics", color: "bg-[#5B8FB9]/15 text-[#4A7A9E] border-[#5B8FB9]/25" },
  security: { label: "Security", color: "bg-primary/15 text-primary border-primary/25" },
  iot: { label: "IoT", color: "bg-[#9B6B8E]/15 text-[#7E567A] border-[#9B6B8E]/25" },
  content: { label: "Content", color: "bg-[#C75B8F]/15 text-[#A84D78] border-[#C75B8F]/25" },
  ai_ml: { label: "AI/ML", color: "bg-[#9B6B8E]/15 text-[#7E567A] border-[#9B6B8E]/25" },
  realtime: { label: "Realtime", color: "bg-[#5B8FB9]/15 text-[#4A7A9E] border-[#5B8FB9]/25" },
  mapping: { label: "Mapping", color: "bg-accent/15 text-accent border-accent/25" },
  social: { label: "Social", color: "bg-[#6B7EB2]/15 text-[#566899] border-[#6B7EB2]/25" },
  scheduling: { label: "Scheduling", color: "bg-[#5B9E9E]/15 text-[#4A8282] border-[#5B9E9E]/25" },
  logistics: { label: "Logistics", color: "bg-[#E8A838]/15 text-[#C08A2E] border-[#E8A838]/25" },
  healthcare: { label: "Healthcare", color: "bg-[#C75B8F]/15 text-[#A84D78] border-[#C75B8F]/25" },
  education: { label: "Education", color: "bg-[#5B8FB9]/15 text-[#4A7A9E] border-[#5B8FB9]/25" },
  finance: { label: "Finance", color: "bg-accent/15 text-accent border-accent/25" },
  media: { label: "Media", color: "bg-[#C75B8F]/15 text-[#A84D78] border-[#C75B8F]/25" },
};

const defaultChipColor = "bg-border/40 text-muted-foreground border-border";

const coreTeam = [
  { name: "Strategist", domain: "strategist", style: "bg-primary/20 text-primary border-primary/30" },
  { name: "Designer", domain: "designer", style: "bg-primary/20 text-primary border-primary/30" },
  { name: "Architect", domain: "architect", style: "bg-primary/20 text-primary border-primary/30" },
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
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${expert.style}`}
            >
              <ExpertAvatar domain={expert.domain} name={expert.name} size="sm" className="!w-6 !h-6 !text-xs" />
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
            <span className="ml-2 text-primary animate-pulse">
              analyzing...
            </span>
          )}
        </h3>
        <div className="flex flex-wrap gap-2 justify-center min-h-[40px]">
          {specialists.length === 0 && !loading && (
            <span className="text-sm text-muted-foreground">
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
                className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-300 ${colorClass}`}
                style={{ opacity: Math.max(0.5, s.confidence) }}
                title={s.reason || `Confidence: ${Math.round(s.confidence * 100)}%`}
              >
                <ExpertAvatar domain={s.type} name={s.name} size="sm" className="!w-6 !h-6 !text-xs" showTooltip={false} />
                {label}
                <button
                  type="button"
                  onClick={() => onRemoveSpecialist(s.type)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-destructive"
                  title="Remove specialist"
                >
                  ✕
                </button>
              </span>
            );
          })}
          {loading && (
            <span className="inline-flex items-center px-3 py-1.5 text-sm text-muted-foreground animate-pulse">
              <span className="inline-block w-2 h-2 rounded-full bg-border mr-2 animate-bounce" />
              discovering...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

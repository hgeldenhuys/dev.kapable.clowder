import type { ReactNode } from "react";
import type { UploadedFile } from "~/lib/uploads.server";

export interface Step1Data {
  appName: string;
  description: string;
  files: UploadedFile[];
}

const STARTER_TEMPLATES = [
  {
    name: "Feedback Board",
    icon: "💬",
    accent: "from-[#E07A5F]/8 to-[#E07A5F]/3",
    borderAccent: "hover:border-[#E07A5F]/30",
    description: "A real-time feedback board where users can post ideas, vote on them, and track which ones get implemented. Features: user submissions with categories, upvote/downvote system, status tracking (new, planned, in progress, done), admin dashboard for managing submissions.",
  },
  {
    name: "Team Task Board",
    icon: "✅",
    accent: "from-[#81B29A]/8 to-[#81B29A]/3",
    borderAccent: "hover:border-[#81B29A]/30",
    description: "A collaborative task management board for small teams. Users can create tasks with titles and descriptions, assign them to team members, drag between columns (To Do, In Progress, Done), and filter by assignee. Real-time updates so everyone sees changes instantly.",
  },
  {
    name: "Event Planner",
    icon: "📅",
    accent: "from-[#E8A838]/8 to-[#E8A838]/3",
    borderAccent: "hover:border-[#E8A838]/30",
    description: "A community event listing and RSVP platform. Organizers create events with date, time, location, and description. Attendees can browse upcoming events, RSVP, and see who else is going. Features: event categories, capacity limits, and a calendar view.",
  },
  {
    name: "Recipe Collection",
    icon: "🍳",
    accent: "from-[#C75B8F]/8 to-[#C75B8F]/3",
    borderAccent: "hover:border-[#C75B8F]/30",
    description: "A personal recipe sharing app where users can add recipes with ingredients, steps, and photos. Features: search by ingredient, tag recipes by cuisine or dietary preference, save favorites, and share recipes with friends via a unique link.",
  },
];

interface Step1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  sessionId?: string; // needed for file uploads
  children?: ReactNode; // slot for specialist preview chips
}

export function Step1Context({ data, onChange, sessionId, children }: Step1Props) {
  const descriptionLength = data.description.trim().length;
  const isValid = data.appName.trim().length >= 1 && descriptionLength >= 20;
  const wordCount = data.description.trim() ? data.description.trim().split(/\s+/).length : 0;
  const isEmpty = !data.appName.trim() && !data.description.trim();

  return (
    <div className="space-y-5">
      {/* Starter templates — compact horizontal scroll, shown when empty */}
      {isEmpty && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground/40 text-center font-medium uppercase tracking-wider">or start from a template</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 snap-x">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => onChange({ ...data, appName: t.name, description: t.description })}
                className={`flex-none snap-start text-left px-3.5 py-2.5 rounded-xl border border-border/20 bg-gradient-to-br ${t.accent} ${t.borderAccent} shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 group w-[160px]`}
                aria-label={`Start with ${t.name} template`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base group-hover:scale-110 transition-transform duration-200">{t.icon}</span>
                  <span className="text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors truncate">{t.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/40 leading-snug line-clamp-2">{t.description.slice(0, 70)}...</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="appName"
            className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
          >
            App Name
          </label>
          <input
            id="appName"
            type="text"
            maxLength={60}
            placeholder="My Amazing App"
            value={data.appName}
            onChange={(e) => onChange({ ...data, appName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-[#E8E5DF] bg-white text-foreground placeholder:text-[#6A6763]/50 focus:outline-none focus:ring-2 focus:ring-[#E07A5F]/20 focus:border-[#E07A5F]/40 focus:bg-white transition-all text-base"
          />
          <span className="text-[10px] text-muted-foreground/40 mt-1 block text-right">
            {data.appName.length}/60
          </span>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
          >
            Description
          </label>
          <div className="relative">
            <textarea
              id="description"
              placeholder="Describe your app idea in detail — who are the users, what do they do, what data is needed?"
              value={data.description}
              onChange={(e) =>
                onChange({ ...data, description: e.target.value })
              }
              className="w-full min-h-[120px] px-4 py-3 pb-8 rounded-xl border border-[#E8E5DF] bg-white text-foreground placeholder:text-[#6A6763]/50 resize-none focus:outline-none focus:ring-2 focus:ring-[#E07A5F]/20 focus:border-[#E07A5F]/40 focus:bg-white transition-all text-base leading-relaxed"
            />
            <span
              className={`absolute bottom-2.5 right-3 text-[11px] font-medium ${
                wordCount >= 200
                  ? "text-[#81B29A]"
                  : descriptionLength >= 20
                    ? "text-muted-foreground/50"
                    : "text-[#E8A838]/80"
              }`}
            >
              {wordCount} word{wordCount !== 1 ? "s" : ""}
              {descriptionLength < 20 && " (min 20 chars)"}
              {wordCount >= 200 && " ✨ instant build!"}
            </span>
          </div>
        </div>

        {/* File upload removed — will be re-added when pre-session uploads are supported */}
      </div>

      {/* Specialist preview chips (from predict-experts) */}
      {children}

      {/* Validation hint */}
      {!isValid && (data.appName.trim() || data.description.trim()) && (
        <p className="text-xs text-[#E8A838]/70 text-center">
          {!data.appName.trim()
            ? "Enter an app name to continue"
            : "Description needs at least 20 characters"}
        </p>
      )}
    </div>
  );
}

/** Check if step 1 data is valid for proceeding */
export function isStep1Valid(data: Step1Data): boolean {
  return data.appName.trim().length >= 1 && data.description.trim().length >= 20;
}

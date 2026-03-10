import type { ReactNode } from "react";
import type { UploadedFile } from "~/lib/uploads.server";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

export interface Step1Data {
  appName: string;
  description: string;
  files: UploadedFile[];
}

const STARTER_TEMPLATES = [
  {
    name: "Feedback Board",
    icon: "💬",
    accent: "from-primary/8 to-primary/3",
    borderAccent: "hover:border-primary/30",
    description: "A real-time feedback board where users can post ideas, vote on them, and track which ones get implemented. Features: user submissions with categories, upvote/downvote system, status tracking (new, planned, in progress, done), admin dashboard for managing submissions.",
  },
  {
    name: "Team Task Board",
    icon: "✅",
    accent: "from-accent/8 to-accent/3",
    borderAccent: "hover:border-accent/30",
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
      {wordCount < 20 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground/60 text-center font-medium">Or start with a template</p>
          <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 snap-x scroll-smooth">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => onChange({ ...data, appName: t.name, description: t.description })}
                className={`flex-none snap-start text-left px-3.5 py-2.5 rounded-xl border border-border/40 bg-gradient-to-br ${t.accent} ${t.borderAccent} shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200 group w-[160px] sm:w-[185px]`}
                aria-label={`Start with ${t.name} template`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base group-hover:scale-110 transition-transform duration-200">{t.icon}</span>
                  <span className="text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors">{t.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/60 leading-snug line-clamp-2">{t.description.split('. ')[0]}.</p>
              </button>
            ))}
          </div>
          {/* Right fade to indicate scrollable */}
          <div className="absolute right-0 top-0 bottom-1 w-8 sm:w-12 bg-gradient-to-l from-[#FAF9F6] to-transparent pointer-events-none rounded-r-xl" />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="appName"
            className="text-xs font-medium text-muted-foreground/70 mb-1.5 block"
          >
            App name
          </label>
          <Input
            id="appName"
            type="text"
            maxLength={60}
            placeholder="My Amazing App"
            value={data.appName}
            onChange={(e) => onChange({ ...data, appName: e.target.value })}
            className="h-auto px-4 py-3 rounded-xl bg-white text-foreground placeholder:text-muted-foreground/60 shadow-[var(--shadow-sm)] focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 focus:bg-white focus:shadow-[var(--shadow-md)] transition-all text-base"
          />
          <span className="text-[10px] text-muted-foreground/60 mt-1 block text-right">
            {data.appName.length}/60
          </span>
        </div>

        <div>
          <label
            htmlFor="description"
            className="text-xs font-medium text-muted-foreground/70 mb-1.5 block"
          >
            What do you want to build?
          </label>
          <div className="relative">
            <Textarea
              id="description"
              placeholder="I want to build a tool where teams can track projects, assign tasks, and see progress in real-time..."
              value={data.description}
              onChange={(e) =>
                onChange({ ...data, description: e.target.value })
              }
              className="min-h-[120px] px-4 py-3 pb-8 rounded-xl bg-white text-foreground placeholder:text-muted-foreground/60 shadow-[var(--shadow-sm)] resize-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 focus:bg-white focus:shadow-[var(--shadow-md)] transition-all text-base leading-relaxed"
            />
            <span
              className={`absolute bottom-2.5 right-3 text-[11px] font-medium ${
                wordCount >= 20
                  ? "text-accent"
                  : wordCount >= 3
                    ? "text-muted-foreground/60"
                    : "text-muted-foreground/60"
              }`}
            >
              {wordCount < 3
                ? "Describe your idea to get started"
                : wordCount < 20
                  ? `Keep going \u2014 ${wordCount} words (aim for 20+)`
                  : `${wordCount} words`}
            </span>
          </div>
        </div>

        {/* File upload removed — will be re-added when pre-session uploads are supported */}
      </div>

      {/* Specialist preview chips (from predict-experts) */}
      {children}

      {/* Validation hint */}
      {!isValid && (data.appName.trim() || data.description.trim()) && (
        <p className="text-xs text-[color:var(--warning)] opacity-70 text-center">
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

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
    description: "A real-time feedback board where users can post ideas, vote on them, and track which ones get implemented. Features: user submissions with categories, upvote/downvote system, status tracking (new, planned, in progress, done), admin dashboard for managing submissions.",
  },
  {
    name: "Team Task Board",
    icon: "✅",
    description: "A collaborative task management board for small teams. Users can create tasks with titles and descriptions, assign them to team members, drag between columns (To Do, In Progress, Done), and filter by assignee. Real-time updates so everyone sees changes instantly.",
  },
  {
    name: "Event Planner",
    icon: "📅",
    description: "A community event listing and RSVP platform. Organizers create events with date, time, location, and description. Attendees can browse upcoming events, RSVP, and see who else is going. Features: event categories, capacity limits, and a calendar view.",
  },
  {
    name: "Recipe Collection",
    icon: "🍳",
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
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          What are you building?
        </h2>
        <p className="text-muted-foreground">
          Give your app a name and describe what it does. The more detail, the
          better your AI team can help.
        </p>
      </div>

      {/* Starter templates — shown when fields are empty */}
      {isEmpty && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">Try one of these to get started</p>
          <div className="grid grid-cols-2 gap-2">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => onChange({ ...data, appName: t.name, description: t.description })}
                className="text-left p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{t.icon}</span>
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{t.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed line-clamp-2">{t.description.slice(0, 80)}...</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="appName"
            className="block text-sm font-medium text-foreground mb-1.5"
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
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground mt-1 block text-right">
            {data.appName.length}/60
          </span>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-foreground mb-1.5"
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
              className="w-full min-h-[160px] px-4 py-3 pb-8 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-base"
              autoFocus
            />
            <span
              className={`absolute bottom-2 right-3 text-xs ${
                wordCount >= 200
                  ? "text-green-400"
                  : descriptionLength >= 20
                    ? "text-muted-foreground"
                    : "text-yellow-500"
              }`}
            >
              {wordCount} word{wordCount !== 1 ? "s" : ""}
              {descriptionLength < 20 && " (min 20 chars)"}
              {wordCount >= 200 && " — instant build!"}
            </span>
          </div>
        </div>

        {/* File upload removed — will be re-added when pre-session uploads are supported */}
      </div>

      {/* Specialist preview chips (from predict-experts) */}
      {children}

      {/* Validation hint */}
      {!isValid && (data.appName.trim() || data.description.trim()) && (
        <p className="text-xs text-yellow-500 text-center">
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

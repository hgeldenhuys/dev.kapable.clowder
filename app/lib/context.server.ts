/**
 * Context document builder for Clowder sessions.
 *
 * Builds a Markdown document that serves as the living memory for a session.
 * Every expert prompt receives this, and every step appends to it.
 * Stored in Vault at: clowder/{sessionId}/context.md
 */

export interface ContextTeamMember {
  name: string;
  role: "core" | "specialist";
  confidence?: number;
  reason?: string;
}

export interface ContextFile {
  name: string;
  url: string;
  type: "binary" | "text";
  preview?: string;
}

export interface ContextInterview {
  expert: string;
  message: string;
  role: "expert" | "user";
  timestamp: string;
}

export interface ContextData {
  appName: string;
  description: string;
  files: ContextFile[];
  team: ContextTeamMember[];
  interviews: ContextInterview[];
  artifacts?: Record<string, string>;
}

/**
 * Build the full context document as Markdown.
 */
export function buildContextMarkdown(data: ContextData): string {
  const lines: string[] = [];

  lines.push(`# ${data.appName || "Untitled App"}`);
  lines.push("");
  lines.push("## Description");
  lines.push(data.description);
  lines.push("");

  // Files section
  if (data.files.length > 0) {
    lines.push("## Files");
    for (const file of data.files) {
      const typeLabel = file.type === "text" ? "text" : "binary";
      lines.push(`- [${file.name}](${file.url}) — ${typeLabel}`);
      if (file.preview) {
        lines.push(`  > ${file.preview.slice(0, 200)}${file.preview.length > 200 ? "..." : ""}`);
      }
    }
    lines.push("");
  }

  // Team section
  lines.push("## Team");
  for (const member of data.team) {
    const details: string[] = [];
    details.push(member.role);
    if (member.confidence !== undefined) {
      details.push(`confidence: ${member.confidence.toFixed(2)}`);
    }
    if (member.reason) {
      details.push(member.reason);
    }
    lines.push(`- ${member.name} (${details.join(", ")})`);
  }
  lines.push("");

  // Interviews section
  if (data.interviews.length > 0) {
    lines.push("## Expert Interviews");
    lines.push("");

    let roundNum = 0;
    let lastExpert = "";
    for (const interview of data.interviews) {
      if (interview.role === "expert" && interview.expert !== lastExpert) {
        roundNum++;
        lastExpert = interview.expert;
        lines.push(`### Round ${roundNum} — ${interview.expert}`);
      }

      if (interview.role === "expert") {
        lines.push(`> ${interview.message}`);
      } else {
        lines.push(`**User:** ${interview.message}`);
      }
      lines.push("");
    }
  }

  // Artifacts section
  if (data.artifacts && Object.keys(data.artifacts).length > 0) {
    lines.push("## Build Artifacts");
    for (const [key, value] of Object.entries(data.artifacts)) {
      lines.push(`- ${key}: ${value}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Build a JSONL line for an interview entry.
 */
export function buildInterviewLine(
  expert: string,
  message: string,
  role: "expert" | "user",
  confidence?: number,
): string {
  const entry: Record<string, unknown> = {
    expert: role === "user" ? "user" : expert,
    message,
    timestamp: new Date().toISOString(),
  };
  if (confidence !== undefined) {
    entry.confidence = confidence;
  }
  return JSON.stringify(entry);
}

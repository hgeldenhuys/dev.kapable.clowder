export type OrbStatus =
  | "unclear"
  | "progressing"
  | "ready"
  | "on_stage"
  | "building"
  | "done";

export interface OrbData {
  id: string;
  name: string;
  domain: string;
  confidence: number; // 0.0 to 1.0
  status: OrbStatus;
  isActive?: boolean; // currently on stage (talking)
}

/** Map confidence (0–1) to a Three.js hex color */
export function getOrbHexColor(confidence: number, status: OrbStatus): number {
  if (status === "building") return 0x3b82f6; // blue
  if (status === "done") return 0x22c55e;     // bright green
  if (status === "on_stage") return 0xffffff; // white (ring color)

  // Confidence-based gradient: red → orange → yellow → green → blue
  if (confidence < 0.2) return 0xef4444; // red
  if (confidence < 0.5) return 0xf97316; // orange
  if (confidence < 0.7) return 0xeab308; // yellow
  if (confidence < 0.9) return 0x22c55e; // green
  return 0x3b82f6; // blue
}

/** Map confidence to a CSS color string (for non-Three.js fallback) */
export function getOrbCssColor(confidence: number, status: OrbStatus): string {
  if (status === "building") return "oklch(0.6 0.2 245)";
  if (status === "done") return "oklch(0.65 0.2 145)";
  if (status === "on_stage") return "oklch(0.95 0.005 270)";
  if (confidence < 0.2) return "oklch(0.55 0.22 25)";
  if (confidence < 0.5) return "oklch(0.65 0.18 50)";
  if (confidence < 0.7) return "oklch(0.75 0.17 95)";
  if (confidence < 0.9) return "oklch(0.65 0.2 145)";
  return "oklch(0.6 0.2 245)";
}

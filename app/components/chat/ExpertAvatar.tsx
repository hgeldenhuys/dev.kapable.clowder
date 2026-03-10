/** Domain-specific gradient colors for expert avatars */
const EXPERT_GRADIENTS: Record<string, string> = {
  strategist: "from-cyan-500 to-blue-600",
  designer: "from-violet-500 to-purple-600",
  architect: "from-amber-500 to-orange-600",
  commerce: "from-emerald-500 to-green-600",
  compliance: "from-red-500 to-rose-600",
  growth: "from-pink-500 to-fuchsia-600",
  security: "from-slate-500 to-zinc-600",
  data: "from-indigo-500 to-blue-600",
  payments: "from-yellow-500 to-amber-600",
  analytics: "from-cyan-400 to-teal-600",
  content: "from-pink-400 to-rose-600",
  ai_ml: "from-purple-400 to-indigo-600",
  realtime: "from-blue-400 to-cyan-600",
  social: "from-indigo-400 to-violet-600",
  scheduling: "from-teal-400 to-emerald-600",
  logistics: "from-yellow-400 to-orange-600",
  healthcare: "from-rose-400 to-red-600",
  education: "from-sky-400 to-blue-600",
  finance: "from-lime-400 to-green-600",
  media: "from-fuchsia-400 to-purple-600",
};

/** Domain-specific icons (Unicode symbols) */
const EXPERT_ICONS: Record<string, string> = {
  strategist: "\u265F", // ♟
  designer: "\u25D0",   // ◐
  architect: "\u25B3",   // △
  commerce: "\u25C7",    // ◇
  security: "\u25C9",    // ◉
  compliance: "\u25C9",  // ◉
  growth: "\u2197",      // ↗
  data: "\u2B21",        // ⬡
  analytics: "\u25A3",   // ▣
  content: "\u270E",     // ✎
  ai_ml: "\u2B22",       // ⬢
  realtime: "\u26A1",    // ⚡
  social: "\u25CB",      // ○
  payments: "\u25C7",    // ◇
  scheduling: "\u29D6",  // ⧖
  logistics: "\u2690",   // ⚐
  healthcare: "\u2695",  // ⚕
  education: "\u2302",   // ⌂
  finance: "\u25C6",     // ◆
  media: "\u25B6",       // ▶
};

/** Expert specialty descriptions for tooltips */
const EXPERT_DESCRIPTIONS: Record<string, string> = {
  strategist: "Business strategy, market positioning, and competitive analysis",
  designer: "User experience, visual design, and interaction patterns",
  architect: "System architecture, database design, and API structure",
  commerce: "E-commerce, payments, product catalog, and checkout flows",
  compliance: "Regulatory requirements, data privacy, and legal constraints",
  growth: "User acquisition, retention, analytics, and growth loops",
  security: "Authentication, authorization, data protection, and threat modeling",
  data: "Data modeling, analytics pipelines, and data visualization",
  analytics: "Business intelligence, metrics, dashboards, and reporting",
  content: "Content management, editorial workflows, and media handling",
  ai_ml: "Machine learning, AI integration, and intelligent features",
  realtime: "Real-time communication, WebSockets, and live collaboration",
  social: "Social features, user profiles, feeds, and community",
  payments: "Payment processing, subscriptions, and billing",
  scheduling: "Calendar, booking, appointments, and time management",
  logistics: "Inventory, shipping, tracking, and supply chain",
  healthcare: "Health records, patient management, and clinical workflows",
  education: "Learning management, courses, assessments, and progress tracking",
  finance: "Financial tracking, budgeting, accounting, and reporting",
  media: "Media streaming, content delivery, and file management",
};

export function getExpertGradient(domain: string): string {
  const d = domain.toLowerCase();
  for (const [key, gradient] of Object.entries(EXPERT_GRADIENTS)) {
    if (d.includes(key)) return gradient;
  }
  // Fallback: hash the domain to pick a consistent color
  const hash = d.charCodeAt(0) % 5;
  const fallbacks = [
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-purple-600",
    "from-amber-500 to-orange-600",
    "from-emerald-500 to-green-600",
    "from-pink-500 to-fuchsia-600",
  ];
  return fallbacks[hash];
}

export function getExpertIcon(domain: string): string {
  const d = domain.toLowerCase();
  for (const [key, icon] of Object.entries(EXPERT_ICONS)) {
    if (d.includes(key)) return icon;
  }
  return "\u25C8"; // ◈
}

export function getExpertDescription(domain: string): string {
  const d = domain.toLowerCase();
  for (const [key, desc] of Object.entries(EXPERT_DESCRIPTIONS)) {
    if (d.includes(key)) return desc;
  }
  return "Domain specialist";
}

interface ExpertAvatarProps {
  domain: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
};

export function ExpertAvatar({
  domain,
  name,
  size = "sm",
  showTooltip = true,
  className = "",
}: ExpertAvatarProps) {
  const gradient = getExpertGradient(domain);
  const icon = getExpertIcon(domain);
  const description = getExpertDescription(domain);
  const tooltip = showTooltip
    ? `${name ?? domain}: ${description}`
    : undefined;

  return (
    <div
      className={`flex-none rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-lg ${sizeClasses[size]} ${className}`}
      title={tooltip}
    >
      {icon}
    </div>
  );
}

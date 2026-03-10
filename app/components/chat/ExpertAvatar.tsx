/** Domain-specific gradient colors for expert avatars */
const EXPERT_GRADIENTS: Record<string, string> = {
  strategist: "from-sky-400 to-blue-500",
  designer: "from-purple-400 to-violet-500",
  architect: "from-amber-400 to-orange-500",
  commerce: "from-emerald-400 to-green-500",
  compliance: "from-rose-400 to-red-500",
  growth: "from-pink-400 to-rose-500",
  security: "from-stone-400 to-zinc-500",
  data: "from-indigo-400 to-blue-500",
  payments: "from-amber-400 to-yellow-500",
  analytics: "from-teal-400 to-cyan-500",
  content: "from-rose-400 to-pink-500",
  ai_ml: "from-violet-400 to-purple-500",
  realtime: "from-sky-400 to-cyan-500",
  social: "from-violet-400 to-indigo-500",
  scheduling: "from-emerald-400 to-teal-500",
  logistics: "from-orange-400 to-amber-500",
  healthcare: "from-rose-400 to-red-500",
  education: "from-sky-400 to-blue-500",
  finance: "from-emerald-400 to-green-500",
  media: "from-fuchsia-400 to-purple-500",
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
    "from-sky-400 to-blue-500",
    "from-violet-400 to-purple-500",
    "from-amber-400 to-orange-500",
    "from-emerald-400 to-green-500",
    "from-pink-400 to-rose-500",
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

/**
 * Clowder Orchestrator — PO agent brain.
 *
 * Receives a user message, calls Claude headless as the PO,
 * and generates the appropriate expert's response.
 * Updates expert confidence/status in DB via the platform API.
 *
 * Architecture:
 * 1. User sends message → BFF receives it → calls orchestrate()
 * 2. orchestrate() builds a prompt with session context
 * 3. Calls Claude headless: `claude -p "..." --output-format json`
 * 4. Parses PO response → saves expert message to DB
 * 5. Updates expert confidence/status via API
 * 6. Returns: the expert's message + updated expert state
 *
 * In v1, Claude is called as a subprocess. In v2, this becomes
 * a persistent Claude session (KAIT) for true statefulness.
 */

import { execSync } from "child_process";
import {
  PO_SYSTEM_PROMPT,
  buildPOPrompt,
  buildExpertSystemPrompt,
} from "./prompts.server";
import {
  sendClowderMessage,
  updateClowderExpert,
  createClowderExpert,
  listClowderExperts,
  getClowderSession,
  type ClowderMessage,
  type ClowderExpert,
} from "./api.server";

interface POResponse {
  responding_expert: string;
  message: string;
  confidence: number;
  blockers: string[];
  spawn_specialists?: string[];
}

interface OrchestrateResult {
  expertMessage: ClowderMessage;
  updatedExpert: ClowderExpert;
}

/**
 * Spawn the 3 core experts for a new session.
 * Called once when a session first receives a user message.
 */
export async function spawnCoreExperts(sessionId: string): Promise<ClowderExpert[]> {
  const coreExperts = [
    { name: "Strategist", domain: "strategist", role: "core" as const, sort_order: 0 },
    { name: "Designer", domain: "designer", role: "core" as const, sort_order: 1 },
    { name: "Architect", domain: "architect", role: "core" as const, sort_order: 2 },
  ];

  const created: ClowderExpert[] = [];
  for (const expert of coreExperts) {
    const systemPrompt = buildExpertSystemPrompt(expert.domain, expert.name);
    const e = await createClowderExpert(sessionId, {
      ...expert,
      system_prompt: systemPrompt,
    });
    created.push(e);
  }
  return created;
}

/**
 * Spawn specialist experts based on the PO's recommendations.
 */
async function spawnSpecialists(
  sessionId: string,
  domains: string[]
): Promise<ClowderExpert[]> {
  const domainNames: Record<string, string> = {
    commerce: "Commerce",
    compliance: "Compliance",
    growth: "Growth",
    analytics: "Analytics",
    security: "Security",
    iot: "IoT",
    content: "Content",
    "ai/ml": "AI/ML",
  };

  const created: ClowderExpert[] = [];
  let sortOrder = 3;

  for (const domain of domains) {
    const name = domainNames[domain.toLowerCase()] ?? domain;
    const systemPrompt = buildExpertSystemPrompt(domain, name);
    const e = await createClowderExpert(sessionId, {
      name,
      role: "specialist",
      domain,
      system_prompt: systemPrompt,
      sort_order: sortOrder++,
    });
    created.push(e);
  }

  return created;
}

/**
 * Call Claude headless as the PO agent.
 * Returns a parsed POResponse or null if Claude is not available.
 */
async function callPOAgent(prompt: string): Promise<POResponse | null> {
  const fullPrompt = `${PO_SYSTEM_PROMPT}\n\n---\n\n${prompt}`;

  try {
    const text = execSync(
      `claude --dangerously-skip-permissions --output-format json`,
      {
        input: fullPrompt,
        encoding: "utf8",
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      }
    ).trim();

    // Try to parse the JSON response
    if (!text) return null;

    // Claude --output-format json wraps in {"type":"result","result":"..."}
    let jsonText = text;
    try {
      const wrapper = JSON.parse(text) as { type?: string; result?: string };
      if (wrapper.result) {
        jsonText = wrapper.result;
      }
    } catch {
      // Already raw JSON
    }

    // Extract JSON object from the response (may have preamble)
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]) as POResponse;
  } catch (e) {
    console.error("Claude subprocess error:", e);
    return null;
  }
}

/**
 * Generate a fallback expert response when Claude is not available.
 * This ensures the app works even without Claude installed.
 */
function fallbackResponse(
  experts: ClowderExpert[],
  sessionDescription: string
): POResponse {
  // Pick the expert with lowest confidence
  const sorted = [...experts].sort((a, b) => a.confidence - b.confidence);
  const expert = sorted[0] ?? { name: "Strategist", domain: "strategist" };

  const questions: Record<string, string[]> = {
    strategist: [
      `That's an interesting idea! Who is the primary user for this app? Is it consumers, businesses, or both?`,
      `What problem are you solving that existing solutions don't address well?`,
      `How do you envision making money with this app? Subscription, one-time purchase, or marketplace fees?`,
    ],
    designer: [
      `What does the main screen look like? What's the first action a user takes?`,
      `How many distinct screens or views does this app need?`,
      `What's the "wow moment" — when does a new user first see the value?`,
    ],
    architect: [
      `What are the core data entities? For example, users, products, orders?`,
      `Do you need real-time updates, or is periodic refresh acceptable?`,
      `What's your expected user scale in the first year?`,
    ],
  };

  const domainQuestions = questions[expert.domain] ?? questions["strategist"];
  const question = domainQuestions[Math.floor(Math.random() * domainQuestions.length)];

  return {
    responding_expert: expert.name,
    message: question,
    confidence: Math.min(expert.confidence + 0.1, 0.9),
    blockers: ["Need to understand target audience", "Need to clarify business model"],
  };
}

/**
 * Main orchestration function.
 *
 * Call this after saving the user's message to DB.
 * It will generate an expert response and update expert state.
 */
export async function orchestrate(sessionId: string): Promise<OrchestrateResult | null> {
  // Load current state
  const { session } = await getClowderSession(sessionId);
  let experts = await listClowderExperts(sessionId);

  // If no experts yet, spawn the core 3 first
  if (experts.length === 0) {
    experts = await spawnCoreExperts(sessionId);
  }

  // Build the PO prompt with session context
  // For simplicity, we just load the experts' current state
  // (messages are loaded by the PO prompt builder)
  const prompt = buildPOPrompt({
    sessionDescription: session.description ?? "Unknown app",
    recentMessages: [], // TODO: load recent messages for full context
    experts: experts.map((e) => ({
      name: e.name,
      domain: e.domain,
      confidence: e.confidence,
      blockers: Array.isArray(e.blockers) ? e.blockers as string[] : [],
    })),
  });

  // Call Claude (or use fallback)
  let poResponse = await callPOAgent(prompt);
  if (!poResponse) {
    poResponse = fallbackResponse(experts, session.description ?? "");
  }

  // Find the responding expert (match by name)
  let respondingExpert = experts.find(
    (e) => e.name.toLowerCase() === poResponse!.responding_expert.toLowerCase()
  );

  // If it's a new specialist, spawn them
  if (!respondingExpert && poResponse.spawn_specialists?.length) {
    const spawned = await spawnSpecialists(sessionId, poResponse.spawn_specialists);
    experts = [...experts, ...spawned];
    respondingExpert = spawned[0];
  }

  // Fallback to first expert if still not found
  if (!respondingExpert) {
    respondingExpert = experts[0];
  }

  if (!respondingExpert) {
    return null;
  }

  // Update expert confidence and status
  const newStatus: ClowderExpert["status"] =
    poResponse.confidence >= 0.9 ? "ready" :
    poResponse.confidence >= 0.5 ? "progressing" : "unclear";

  const updatedExpert = await updateClowderExpert(sessionId, respondingExpert.id, {
    confidence: poResponse.confidence,
    status: newStatus,
    blockers: poResponse.blockers,
  });

  // Set this expert on stage
  await updateClowderExpert(sessionId, respondingExpert.id, { status: "on_stage" });

  // Save the expert's response as a message
  const expertMessage = await sendClowderMessage(sessionId, {
    content: poResponse.message,
    expert_id: respondingExpert.id,
    role: "expert",
    metadata: {
      confidence: poResponse.confidence,
      blockers: poResponse.blockers,
    },
  });

  // Spawn specialists if requested
  if (poResponse.spawn_specialists?.length) {
    await spawnSpecialists(sessionId, poResponse.spawn_specialists).catch(() => {
      // Non-fatal — specialists can be spawned later
    });
  }

  return { expertMessage, updatedExpert };
}

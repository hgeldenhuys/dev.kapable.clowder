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
  listClowderMessages,
  getClowderSession,
  updateSessionPhase,
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
 * Call the PO agent via OpenRouter API.
 * Uses Gemini Flash for fast, cheap responses.
 * Falls back to null if API key not configured or call fails.
 */
async function callPOAgent(prompt: string): Promise<POResponse | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("OPENROUTER_API_KEY not set — using fallback responses");
    return null;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clowder.kapable.run",
        "X-Title": "Clowder AI App Builder",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: PO_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error("OpenRouter API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    // Extract JSON object from the response (may have preamble/markdown)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]) as POResponse;
  } catch (e) {
    console.error("OpenRouter API error:", e);
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

  // Load recent messages for conversation context
  const allMessages = await listClowderMessages(sessionId);
  const recentMessages = allMessages.slice(-10).map((m) => {
    const expertName = m.expert_id
      ? experts.find((e) => e.id === m.expert_id)?.name
      : undefined;
    return { role: m.role, content: m.content, expertName };
  });

  // Build the PO prompt with session context
  const prompt = buildPOPrompt({
    sessionDescription: session.description ?? "Unknown app",
    recentMessages,
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

  // Boost confidence based on how rich the user's input has been.
  // LLMs tend to be too conservative; this ensures natural progression.
  const userMessages = allMessages.filter((m) => m.role === "user");
  const totalUserWords = userMessages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0);
  const confidenceFloor = Math.min(0.5, totalUserWords / 400); // 200+ words → floor of 0.5
  const adjustedConfidence = Math.max(poResponse.confidence, confidenceFloor);

  // Update expert confidence and status
  const newStatus: ClowderExpert["status"] =
    adjustedConfidence >= 0.9 ? "ready" :
    adjustedConfidence >= 0.5 ? "progressing" : "unclear";

  const updatedExpert = await updateClowderExpert(sessionId, respondingExpert.id, {
    confidence: adjustedConfidence,
    status: newStatus,
    blockers: poResponse.blockers,
  });

  // Boost non-responding experts too — rich user input covers multiple domains
  for (const e of experts) {
    if (e.id !== respondingExpert.id && e.confidence < confidenceFloor) {
      const boostedStatus = confidenceFloor >= 0.5 ? "progressing" : "unclear";
      await updateClowderExpert(sessionId, e.id, {
        confidence: confidenceFloor,
        status: boostedStatus,
      });
    }
  }

  // Clear previous on_stage expert, then set the new one
  for (const e of experts) {
    if (e.status === "on_stage" && e.id !== respondingExpert.id) {
      const resetStatus = e.confidence >= 0.5 ? "progressing" : "unclear";
      await updateClowderExpert(sessionId, e.id, { status: resetStatus });
    }
  }
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

  // Phase transitions — reload experts from DB since we just updated confidences
  const freshExperts = await listClowderExperts(sessionId);
  await transitionPhase(sessionId, session.phase, freshExperts, poResponse);

  return { expertMessage, updatedExpert };
}

/**
 * Evaluate and apply phase transitions based on expert state.
 *
 * assembling → ideating: when experts exist and first exchange happened
 * ideating → planning: when all core experts ≥ 50% confidence
 */
async function transitionPhase(
  sessionId: string,
  currentPhase: string,
  experts: ClowderExpert[],
  latestResponse: POResponse,
) {
  if (currentPhase === "assembling") {
    // Move to ideating once experts are responding
    await updateSessionPhase(sessionId, "ideating");
  } else if (currentPhase === "ideating") {
    // Move to planning when all core experts are at least 50% confident
    // experts should be freshly loaded from DB with up-to-date confidence values
    const coreExperts = experts.filter((e) => e.role === "core");
    const allProgressing = coreExperts.length > 0 && coreExperts.every((e) => e.confidence >= 0.5);
    if (allProgressing) {
      await updateSessionPhase(sessionId, "planning");
    }
  }
}

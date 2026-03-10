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
  INTERVIEWER_SYSTEM_PROMPT,
  INTERVIEW_QUESTIONS,
  buildInterviewTurnPrompt,
  buildIntentDocumentPrompt,
} from "./prompts.server";
import { runBuildPhase } from "./builder.server";
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
import { readVaultFile, writeVaultFile, appendVaultLine, sessionVaultPath } from "./vault.server";
import { buildContextMarkdown, buildInterviewLine } from "./context.server";
import type { ContextTeamMember } from "./context.server";

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
async function callPOAgent(prompt: string, timeoutMs = 30_000): Promise<POResponse | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("OPENROUTER_API_KEY not set — using fallback responses");
    return null;
  }

  // Use fast model for PO routing — it only picks an expert and returns brief JSON
  const poModel = process.env.CLOWDER_PO_MODEL ?? "google/gemini-2.0-flash-001";

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
        model: poModel,
        messages: [
          { role: "system", content: PO_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(timeoutMs),
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
 * Call the interviewer agent via OpenRouter API.
 * Uses the same model as PO but with the interviewer system prompt.
 */
async function callInterviewer(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  // Interviewer needs to be FAST — it asks simple follow-up questions
  const interviewModel = process.env.CLOWDER_INTERVIEW_MODEL ?? "google/gemini-2.0-flash-001";

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
        model: interviewModel,
        messages: [
          { role: "system", content: INTERVIEWER_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.error("Interviewer API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    // Extract JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return text; // fallback: use raw text as message

    const parsed = JSON.parse(match[0]) as { message?: string };
    return parsed.message ?? text;
  } catch (e) {
    console.error("Interviewer API error:", e);
    return null;
  }
}

/**
 * Generate the Intent Document from interview conversation.
 * Returns the structured intent as JSON, or null on failure.
 */
async function generateIntentDocument(
  sessionDescription: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = buildIntentDocumentPrompt({ sessionDescription, conversationHistory });

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
        model: process.env.CLOWDER_INTENT_MODEL ?? "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: "You generate structured JSON documents. Respond with ONLY valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch (e) {
    console.error("Intent document generation error:", e);
    return null;
  }
}

/**
 * Conduct one turn of the intent interview.
 *
 * Determines which question to ask based on user message count,
 * calls the LLM to generate a natural response, and after all
 * questions are answered, generates the Intent Document and
 * transitions to the "assembling" phase (spawns experts).
 */
async function conductInterview(sessionId: string): Promise<OrchestrateResult | null> {
  const { session } = await getClowderSession(sessionId);
  const allMessages = await listClowderMessages(sessionId);

  // Count user messages to determine interview step
  const userMessages = allMessages.filter((m) => m.role === "user");
  const userMsgCount = userMessages.length;

  // Build conversation history for the LLM
  const conversationHistory = allMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Determine which question to ask (0-indexed: Q1=after 1st msg, Q2=after 2nd, etc.)
  const questionIndex = userMsgCount - 1; // 1st user msg → index 0 → ask Q1

  if (questionIndex < INTERVIEW_QUESTIONS.length) {
    // Ask the next interview question
    const question = INTERVIEW_QUESTIONS[questionIndex];

    const prompt = buildInterviewTurnPrompt({
      sessionDescription: session.description ?? "Unknown app",
      questionPrompt: question.prompt,
      conversationSoFar: conversationHistory,
    });

    let message = await callInterviewer(prompt);

    // Fallback if LLM fails
    if (!message) {
      const fallbacks: Record<string, string> = {
        who: "That sounds exciting! Who is this app for? Who are the primary users, and what roles do they play?",
        actions: "Great, that helps a lot! Now, what are the 3 most important things a user can DO in this app?",
        success: "Perfect. Now imagine I built this perfectly — what would you show someone to prove it works? Walk me through a quick demo.",
        scope: "Almost there! Last question: what should this app NOT do? What's explicitly out of scope for the first version?",
      };
      message = fallbacks[question.key] ?? "Can you tell me more about that?";
    }

    // Save as a system message (the PO interviewer, not an expert)
    const interviewMessage = await sendClowderMessage(sessionId, {
      content: message,
      role: "expert", // Use "expert" role so the UI shows it in the chat flow
      metadata: {
        interview_step: questionIndex + 1,
        interview_total: INTERVIEW_QUESTIONS.length,
        interview_key: question.key,
      },
    });

    // Log to Vault
    const interviewsPath = sessionVaultPath(sessionId, "interviews.jsonl");
    appendVaultLine(
      interviewsPath,
      buildInterviewLine("PO (Interview)", message, "expert"),
    ).catch(() => {});

    // Return a synthetic result (no expert entity during interview)
    return {
      expertMessage: interviewMessage,
      updatedExpert: null as unknown as ClowderExpert, // No expert yet during interview
    };
  }

  // All questions answered — generate the Intent Document
  console.log(`[Interview] All ${INTERVIEW_QUESTIONS.length} questions answered for session ${sessionId}. Generating Intent Document...`);

  const intentDoc = await generateIntentDocument(
    session.description ?? "Unknown app",
    conversationHistory,
  );

  // Store Intent Document
  if (intentDoc) {
    // Save to Vault as markdown
    const intentMd = formatIntentDocument(intentDoc);
    const intentPath = sessionVaultPath(sessionId, "intent.md");
    writeVaultFile(intentPath, intentMd).catch((e) =>
      console.error("Vault intent write failed:", e),
    );

    // Save to session as JSON (via Data API patch)
    // We store it in the session description field as enriched context
    // (or we could add an intent_document field — for v1, we use Vault)
  }

  // Send summary message to chat
  const summary = intentDoc
    ? `**Your vision is clear!** Here's what I've captured:\n\n` +
      `**Mission:** ${intentDoc.mission ?? "—"}\n\n` +
      `**Success looks like:** ${intentDoc.success_scenario ?? "—"}\n\n` +
      `Your expert team is assembling now — they'll refine the details in their domains.`
    : "Great, I have a good understanding of your vision! Let me assemble your expert team.";

  const summaryMessage = await sendClowderMessage(sessionId, {
    content: summary,
    role: "system",
    metadata: {
      type: "intent_captured",
      intent_document: intentDoc,
    },
  });

  // Transition: interviewing → assembling
  await updateSessionPhase(sessionId, "assembling");

  // Write full context document for experts (includes intent)
  if (intentDoc) {
    const contextMd = `# Intent Document\n\n${formatIntentDocument(intentDoc)}\n\n---\n\n# Interview Transcript\n\n` +
      conversationHistory.map((m) => `**${m.role === "user" ? "User" : "PO"}:** ${m.content}`).join("\n\n");
    const contextPath = sessionVaultPath(sessionId, "context.md");
    writeVaultFile(contextPath, contextMd).catch(() => {});
  }

  // Now spawn experts and immediately trigger first expert exchange
  // The next user message will hit the regular orchestrate() path
  // But we can also auto-trigger by transitioning to ideating with a synthetic prompt
  const experts = await spawnCoreExperts(sessionId);
  await updateSessionPhase(sessionId, "ideating");

  // Auto-trigger the first expert exchange using the intent summary
  // This makes the transition seamless — experts start discussing immediately
  const autoPrompt = buildPOPrompt({
    sessionDescription: session.description ?? "Unknown app",
    contextDocument: intentDoc ? formatIntentDocument(intentDoc) : undefined,
    recentMessages: [{ role: "system", content: summary }],
    experts: experts.map((e) => ({
      name: e.name,
      domain: e.domain,
      confidence: e.confidence,
      blockers: [],
    })),
  });

  let poResponse = await callPOAgent(autoPrompt);
  if (!poResponse) {
    console.log("[Interview→Ideation] PO agent failed, retrying with 90s timeout...");
    poResponse = await callPOAgent(autoPrompt, 45_000);
  }
  if (poResponse) {
    const respondingExpert = experts.find(
      (e) => e.name.toLowerCase() === poResponse.responding_expert.toLowerCase(),
    ) ?? experts[0];

    if (respondingExpert) {
      await updateClowderExpert(sessionId, respondingExpert.id, {
        confidence: poResponse.confidence,
        status: "on_stage",
      });

      await sendClowderMessage(sessionId, {
        content: poResponse.message,
        expert_id: respondingExpert.id,
        role: "expert",
        metadata: {
          confidence: poResponse.confidence,
          blockers: poResponse.blockers,
        },
      });
    }
  }

  return {
    expertMessage: summaryMessage,
    updatedExpert: null as unknown as ClowderExpert,
  };
}

/**
 * Format an Intent Document as readable markdown.
 */
function formatIntentDocument(doc: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`## Mission\n${doc.mission ?? "—"}\n`);

  const personas = doc.personas as Array<{ name: string; role: string; can: string[] }> | undefined;
  if (personas?.length) {
    lines.push("## Personas");
    for (const p of personas) {
      lines.push(`- **${p.name}** (${p.role}): ${(p.can ?? []).join(", ")}`);
    }
    lines.push("");
  }

  const stories = doc.core_stories as string[] | undefined;
  if (stories?.length) {
    lines.push("## Core Stories");
    for (const s of stories) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  if (doc.success_scenario) {
    lines.push(`## Success Scenario\n${doc.success_scenario}\n`);
  }

  const outOfScope = doc.out_of_scope as string[] | undefined;
  if (outOfScope?.length) {
    lines.push("## Out of Scope");
    for (const s of outOfScope) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  return lines.join("\n");
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

  // If we're in the interview phase, conduct the interview instead of expert routing
  if (session.phase === "interviewing") {
    return conductInterview(sessionId);
  }

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

  // Read context document from Vault (best-effort — PO works without it)
  const contextPath = sessionVaultPath(sessionId, "context.md");
  const contextDoc = await readVaultFile(contextPath).catch(() => null);

  // Build the PO prompt with session context
  const prompt = buildPOPrompt({
    sessionDescription: session.description ?? "Unknown app",
    contextDocument: contextDoc ?? undefined,
    recentMessages,
    experts: experts.map((e) => ({
      name: e.name,
      domain: e.domain,
      confidence: e.confidence,
      blockers: Array.isArray(e.blockers) ? e.blockers as string[] : [],
    })),
  });

  // Call Claude (or use fallback). Retry once with longer timeout on failure.
  let poResponse = await callPOAgent(prompt);
  if (!poResponse) {
    console.log("[Orchestrator] PO agent failed, retrying with 90s timeout...");
    poResponse = await callPOAgent(prompt, 90_000);
  }
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

  // Boost non-responding experts + clear previous on_stage + set new on_stage — all in parallel
  const expertUpdates: Promise<unknown>[] = [];
  for (const e of experts) {
    if (e.id === respondingExpert.id) continue;
    const updates: Record<string, unknown> = {};
    if (e.confidence < confidenceFloor) {
      updates.confidence = confidenceFloor;
      updates.status = confidenceFloor >= 0.5 ? "progressing" : "unclear";
    }
    if (e.status === "on_stage") {
      updates.status = e.confidence >= 0.5 ? "progressing" : "unclear";
    }
    if (Object.keys(updates).length > 0) {
      expertUpdates.push(updateClowderExpert(sessionId, e.id, updates));
    }
  }
  expertUpdates.push(updateClowderExpert(sessionId, respondingExpert.id, { status: "on_stage" }));
  await Promise.all(expertUpdates);

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

  // Accumulate interview in Vault (best-effort, non-blocking)
  const interviewsPath = sessionVaultPath(sessionId, "interviews.jsonl");
  appendVaultLine(
    interviewsPath,
    buildInterviewLine(respondingExpert.name, poResponse.message, "expert", poResponse.confidence),
  ).catch((e) => console.error("Vault interview append failed:", e));

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
  let phase = currentPhase;

  if (phase === "assembling") {
    // Move to ideating once experts are responding
    await updateSessionPhase(sessionId, "ideating");
    // Fall through — check if we can also jump to planning in the same call
    // (happens when a 200+ word first message hits the confidence floor immediately)
    phase = "ideating";
  }
  if (phase === "ideating") {
    // Move to planning when all core experts are at least 50% confident
    // experts should be freshly loaded from DB with up-to-date confidence values
    const coreExperts = experts.filter((e) => e.role === "core");
    const allProgressing = coreExperts.length > 0 && coreExperts.every((e) => e.confidence >= 0.5);
    if (allProgressing) {
      await updateSessionPhase(sessionId, "planning");
      // Auto-trigger build phase when all experts are confident enough
      runBuildPhase(sessionId).catch((e) => {
        console.error("Auto-build phase error:", e);
      });
    }
  }
}

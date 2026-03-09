import { describe, test, expect } from "bun:test";
import {
  buildExpertSystemPrompt,
  buildPOPrompt,
  buildInterviewTurnPrompt,
  buildIntentDocumentPrompt,
  INTERVIEW_QUESTIONS,
  PO_SYSTEM_PROMPT,
  INTERVIEWER_SYSTEM_PROMPT,
} from "../prompts.server";

describe("buildExpertSystemPrompt", () => {
  test("returns known personality for core experts", () => {
    const strategist = buildExpertSystemPrompt("strategist", "Strategist");
    expect(strategist).toContain("business model");
    expect(strategist).toContain("why");

    const designer = buildExpertSystemPrompt("designer", "Designer");
    expect(designer).toContain("user flows");

    const architect = buildExpertSystemPrompt("architect", "Architect");
    expect(architect).toContain("data model");
  });

  test("is case-insensitive for domain lookup", () => {
    const upper = buildExpertSystemPrompt("COMMERCE", "Commerce Expert");
    expect(upper).toContain("payment");
  });

  test("returns generic fallback for unknown domains", () => {
    const custom = buildExpertSystemPrompt("quantum_computing", "Quantum Expert");
    expect(custom).toContain("Quantum Expert");
    expect(custom).toContain("expert advisor");
  });

  test("returns personality for all specialist domains", () => {
    for (const domain of ["commerce", "compliance", "growth", "analytics", "security"]) {
      const prompt = buildExpertSystemPrompt(domain, `${domain} Specialist`);
      expect(prompt.length).toBeGreaterThan(50);
    }
  });
});

describe("buildPOPrompt", () => {
  test("includes session description and expert status", () => {
    const prompt = buildPOPrompt({
      sessionDescription: "A recipe sharing app",
      recentMessages: [],
      experts: [
        { name: "Strategist", domain: "strategy", confidence: 0.3, blockers: ["target audience"] },
        { name: "Designer", domain: "design", confidence: 0.1, blockers: [] },
      ],
    });
    expect(prompt).toContain("A recipe sharing app");
    expect(prompt).toContain("Strategist (strategy): confidence=30%");
    expect(prompt).toContain("blockers=[target audience]");
    expect(prompt).toContain("Designer (design): confidence=10%");
    expect(prompt).toContain("blockers=[none]");
  });

  test("formats recent messages as conversation", () => {
    const prompt = buildPOPrompt({
      sessionDescription: "test",
      recentMessages: [
        { role: "user", content: "I want a recipe app" },
        { role: "expert", content: "Who is the target audience?", expertName: "Strategist" },
      ],
      experts: [],
    });
    expect(prompt).toContain("User: I want a recipe app");
    expect(prompt).toContain("Strategist: Who is the target audience?");
  });

  test("enforces rotation by naming last expert", () => {
    const prompt = buildPOPrompt({
      sessionDescription: "test",
      recentMessages: [
        { role: "expert", content: "First question", expertName: "Designer" },
      ],
      experts: [],
    });
    expect(prompt).toContain("Designer spoke last");
    expect(prompt).toContain("DIFFERENT expert");
  });

  test("shows '(no messages yet)' when no recent messages", () => {
    const prompt = buildPOPrompt({
      sessionDescription: "test",
      recentMessages: [],
      experts: [],
    });
    expect(prompt).toContain("(no messages yet");
  });

  test("includes context document when provided", () => {
    const prompt = buildPOPrompt({
      sessionDescription: "test",
      contextDocument: "## Full project context here",
      recentMessages: [],
      experts: [],
    });
    expect(prompt).toContain("## Full Context");
    expect(prompt).toContain("## Full project context here");
  });

  test("limits to last 10 messages", () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: "user" as const,
      content: `Message ${i}`,
    }));
    const prompt = buildPOPrompt({
      sessionDescription: "test",
      recentMessages: messages,
      experts: [],
    });
    expect(prompt).not.toContain("Message 0");
    expect(prompt).toContain("Message 5");
    expect(prompt).toContain("Message 14");
  });
});

describe("buildInterviewTurnPrompt", () => {
  test("includes session description and question prompt", () => {
    const prompt = buildInterviewTurnPrompt({
      sessionDescription: "A CRM app",
      questionPrompt: "Ask about target users",
      conversationSoFar: [],
    });
    expect(prompt).toContain("A CRM app");
    expect(prompt).toContain("Ask about target users");
    expect(prompt).toContain("(first turn)");
  });

  test("formats conversation history", () => {
    const prompt = buildInterviewTurnPrompt({
      sessionDescription: "test",
      questionPrompt: "Ask about scope",
      conversationSoFar: [
        { role: "user", content: "I want a CRM" },
        { role: "expert", content: "Interesting! Who uses it?" },
      ],
    });
    expect(prompt).toContain("User: I want a CRM");
    expect(prompt).toContain("PO: Interesting! Who uses it?");
  });
});

describe("buildIntentDocumentPrompt", () => {
  test("includes full interview history and JSON schema", () => {
    const prompt = buildIntentDocumentPrompt({
      sessionDescription: "A gym app",
      conversationHistory: [
        { role: "expert", content: "Tell me more" },
        { role: "user", content: "Track workouts" },
      ],
    });
    expect(prompt).toContain("A gym app");
    expect(prompt).toContain("PO: Tell me more");
    expect(prompt).toContain("User: Track workouts");
    expect(prompt).toContain('"mission"');
    expect(prompt).toContain('"personas"');
    expect(prompt).toContain('"core_stories"');
  });
});

describe("INTERVIEW_QUESTIONS", () => {
  test("has exactly 4 structured questions", () => {
    expect(INTERVIEW_QUESTIONS).toHaveLength(4);
  });

  test("each question has key, label, and prompt", () => {
    for (const q of INTERVIEW_QUESTIONS) {
      expect(q.key).toBeDefined();
      expect(q.label).toBeDefined();
      expect(q.prompt.length).toBeGreaterThan(20);
    }
  });

  test("covers who, actions, success, scope", () => {
    const keys = INTERVIEW_QUESTIONS.map((q) => q.key);
    expect(keys).toEqual(["who", "actions", "success", "scope"]);
  });
});

describe("system prompts", () => {
  test("PO_SYSTEM_PROMPT contains JSON format instruction", () => {
    expect(PO_SYSTEM_PROMPT).toContain("responding_expert");
    expect(PO_SYSTEM_PROMPT).toContain("confidence");
    expect(PO_SYSTEM_PROMPT).toContain("blockers");
  });

  test("INTERVIEWER_SYSTEM_PROMPT enforces JSON response", () => {
    expect(INTERVIEWER_SYSTEM_PROMPT).toContain('{ "message":');
  });
});

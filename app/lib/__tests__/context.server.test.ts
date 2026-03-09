import { describe, test, expect } from "bun:test";
import { buildContextMarkdown, buildInterviewLine } from "../context.server";
import type { ContextData } from "../context.server";

describe("buildContextMarkdown", () => {
  test("renders minimal context with name and description", () => {
    const data: ContextData = {
      appName: "RecipeShare",
      description: "A recipe sharing platform",
      files: [],
      team: [],
      interviews: [],
    };
    const md = buildContextMarkdown(data);
    expect(md).toContain("# RecipeShare");
    expect(md).toContain("## Description");
    expect(md).toContain("A recipe sharing platform");
    // No files/interviews sections when empty
    expect(md).not.toContain("## Files");
    expect(md).not.toContain("## Expert Interviews");
  });

  test("falls back to 'Untitled App' when name is empty", () => {
    const data: ContextData = {
      appName: "",
      description: "Some app",
      files: [],
      team: [],
      interviews: [],
    };
    const md = buildContextMarkdown(data);
    expect(md).toContain("# Untitled App");
  });

  test("renders files section with text and binary types", () => {
    const data: ContextData = {
      appName: "TestApp",
      description: "test",
      files: [
        { name: "spec.md", url: "https://example.com/spec.md", type: "text", preview: "# Spec heading" },
        { name: "logo.png", url: "https://example.com/logo.png", type: "binary" },
      ],
      team: [],
      interviews: [],
    };
    const md = buildContextMarkdown(data);
    expect(md).toContain("## Files");
    expect(md).toContain("[spec.md](https://example.com/spec.md) — text");
    expect(md).toContain("[logo.png](https://example.com/logo.png) — binary");
    expect(md).toContain("> # Spec heading");
  });

  test("truncates long file previews at 200 chars", () => {
    const longPreview = "x".repeat(300);
    const data: ContextData = {
      appName: "TestApp",
      description: "test",
      files: [{ name: "long.txt", url: "https://example.com/long.txt", type: "text", preview: longPreview }],
      team: [],
      interviews: [],
    };
    const md = buildContextMarkdown(data);
    expect(md).toContain("x".repeat(200) + "...");
  });

  test("renders team section with core and specialist members", () => {
    const data: ContextData = {
      appName: "TestApp",
      description: "test",
      files: [],
      team: [
        { name: "Strategist", role: "core" },
        { name: "Commerce Specialist", role: "specialist", confidence: 0.85, reason: "Payment flows detected" },
      ],
      interviews: [],
    };
    const md = buildContextMarkdown(data);
    expect(md).toContain("## Team");
    expect(md).toContain("- Strategist (core)");
    expect(md).toContain("- Commerce Specialist (specialist, confidence: 0.85, Payment flows detected)");
  });

  test("renders expert interviews with rounds", () => {
    const data: ContextData = {
      appName: "TestApp",
      description: "test",
      files: [],
      team: [],
      interviews: [
        { expert: "Strategist", message: "Who is this for?", role: "expert", timestamp: "2026-01-01T00:00:00Z" },
        { expert: "Strategist", message: "Small business owners", role: "user", timestamp: "2026-01-01T00:01:00Z" },
        { expert: "Designer", message: "What's the main flow?", role: "expert", timestamp: "2026-01-01T00:02:00Z" },
      ],
    };
    const md = buildContextMarkdown(data);
    expect(md).toContain("## Expert Interviews");
    expect(md).toContain("### Round 1 — Strategist");
    expect(md).toContain("> Who is this for?");
    expect(md).toContain("**User:** Small business owners");
    expect(md).toContain("### Round 2 — Designer");
  });

  test("renders artifacts section when present", () => {
    const data: ContextData = {
      appName: "TestApp",
      description: "test",
      files: [],
      team: [],
      interviews: [],
      artifacts: { "spec.json": "/vault/spec.json", "schema.sql": "/vault/schema.sql" },
    };
    const md = buildContextMarkdown(data);
    expect(md).toContain("## Build Artifacts");
    expect(md).toContain("- spec.json: /vault/spec.json");
  });
});

describe("buildInterviewLine", () => {
  test("builds expert JSONL line with confidence", () => {
    const line = buildInterviewLine("Strategist", "What's the target market?", "expert", 0.3);
    const parsed = JSON.parse(line);
    expect(parsed.expert).toBe("Strategist");
    expect(parsed.message).toBe("What's the target market?");
    expect(parsed.confidence).toBe(0.3);
    expect(parsed.timestamp).toBeDefined();
  });

  test("builds user JSONL line (expert field = 'user')", () => {
    const line = buildInterviewLine("user", "Small businesses", "user");
    const parsed = JSON.parse(line);
    expect(parsed.expert).toBe("user");
    expect(parsed.message).toBe("Small businesses");
    expect(parsed.confidence).toBeUndefined();
  });

  test("omits confidence when undefined", () => {
    const line = buildInterviewLine("Designer", "Nice!", "expert");
    const parsed = JSON.parse(line);
    expect("confidence" in parsed).toBe(false);
  });
});

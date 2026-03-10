/**
 * Clowder Build Phase Orchestrator.
 *
 * When the user triggers "force start" or all experts reach sufficient confidence,
 * this orchestrator:
 * 1. Synthesizes the planning artifacts (spec JSON with data model)
 * 2. Saves spec.json to Org Vault via the platform API
 * 3. Provisions project + tables on Kapable
 * 4. Triggers the clowder.build flow (Loop/Agent pipeline) or falls back to scaffoldAndDeploy
 * 5. Streams flow events as chat system messages
 *
 * V1: scaffoldAndDeploy (LLM → GitHub → Deploy) — legacy fallback
 * V2: clowder.build flow (Loop node → Agent node → iterative sprints)
 */

import {
  getClowderSession,
  listClowderExperts,
  listClowderMessages,
  sendClowderMessage,
  updateClowderExpert,
  updateSessionPhase,
  getApiBaseUrl,
  getAdminKey,
} from "./api.server";
import { updateSessionApp, purgeStale } from "./db.server";
import { writeVaultFile, sessionVaultPath } from "./vault.server";
import { emitMessage } from "./sse.server";

// ---------------------------------------------------------------------------
// Structured spec types (Task 10: spec.json instead of spec.md)
// ---------------------------------------------------------------------------

export interface TableDef {
  name: string;
  columns: Array<{ name: string; type: string; required?: boolean }>;
}

interface FromSpecPayload {
  name: string;
  tables: string[];
  spec: {
    tables: TableDef[];
    flows?: Array<{ name: string; description: string }>;
  };
}

interface BuildArtifact {
  type: "spec" | "backlog" | "architecture" | "data_model";
  title: string;
  content: string;
}

// ---------------------------------------------------------------------------
// LLM helpers
// ---------------------------------------------------------------------------

const LLM_MODELS = ["minimax/minimax-m2.5", "google/gemini-3.1-flash-lite-preview"] as const;

async function callLLM(prompt: string, options?: { maxTokens?: number; timeout?: number; model?: string }): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const models = options?.model ? [options.model] : [...LLM_MODELS];

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 30000);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://clowder.kapable.run",
          "X-Title": "Clowder AI App Builder",
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? 8192,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`LLM ${model} failed (${res.status}): ${body.slice(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      if (content.length > 50) return content;
      console.error(`LLM ${model} returned short response (${content.length} chars)`);
      continue;
    } catch (e) {
      console.error(`LLM ${model} error:`, e);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`All LLM models failed for spec generation`);
}

// ---------------------------------------------------------------------------
// Data model parsing (BL-CLW-003)
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set(["text", "integer", "boolean", "timestamp", "json", "uuid", "vector"]);

/** @internal Exported for testing only */
export function parseDataModel(spec: string): TableDef[] {
  const match =
    spec.match(/```json:data_model\n([\s\S]+?)\n```/) ||
    spec.match(/```json\n([\s\S]+?)\n```/) ||
    spec.match(/```\n(\[[\s\S]+?\])\n```/);
  if (!match) return [];
  try {
    let parsed = JSON.parse(match[1]);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      const key = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      if (key) parsed = parsed[key];
    }
    const tables: TableDef[] = parsed;
    if (!Array.isArray(tables)) return [];
    return tables
      .map((t) => ({
        name: t.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        columns: t.columns.filter((c) => VALID_TYPES.has(c.type)),
      }))
      .filter((t) => t.columns.length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Platform provisioning (BL-CLW-001)
// ---------------------------------------------------------------------------

function platformHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.KAPABLE_ADMIN_KEY ?? "",
  };
}

async function provisionProject(
  sessionName: string
): Promise<{ projectId: string; apiKey: string; slug: string }> {
  const suffix = Math.random().toString(36).slice(2, 6);
  const slug = sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 25) + "-" + suffix;
  const res = await fetch(`${getApiBaseUrl()}/v1/projects`, {
    method: "POST",
    headers: platformHeaders(),
    body: JSON.stringify({ name: sessionName, slug }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
  const data = await res.json();
  const liveKey = data.api_keys?.find((k: any) => k.key_type === "live");
  return { projectId: data.project.id, apiKey: liveKey?.key ?? "", slug };
}

async function provisionTables(
  apiKey: string,
  tables: TableDef[]
): Promise<string[]> {
  const results = await Promise.allSettled(
    tables.map(async (table) => {
      const platformColumns = table.columns
        .filter((c) => c.name !== "id" && c.name !== "created_at" && c.name !== "updated_at")
        .map((c) => ({
          name: c.name,
          col_type: c.type,
          nullable: !c.required,
        }));

      const res = await fetch(`${getApiBaseUrl()}/v1/_meta/tables/${table.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ storage_mode: "jsonb", columns: platformColumns }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`Table ${table.name} creation failed (${res.status}): ${errBody.slice(0, 300)}`);
        return null;
      }
      return table.name;
    })
  );

  const created: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      created.push(r.value);
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// Scaffold + Deploy — LEGACY FALLBACK (BL-CLW-002)
// ---------------------------------------------------------------------------

/**
 * Get an ephemeral GitHub write token from the platform's Develop App.
 * Falls back to static GITHUB_TOKEN env var if the platform call fails.
 */
async function getGitHubToken(): Promise<string> {
  // Try platform's GitHub App first (ephemeral, 1-hour TTL)
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/v1/git/develop/token?installation_id=113953574`,
      { headers: platformHeaders() },
    );
    if (res.ok) {
      const data = await res.json() as { token: string };
      if (data.token) return data.token;
    }
  } catch (e) {
    console.warn("Platform GitHub token fetch failed, trying static fallback:", e);
  }
  // Static fallback
  return process.env.GITHUB_TOKEN ?? "";
}

function githubHeadersFromToken(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function createGitHubRepo(repoName: string, token: string): Promise<boolean> {
  const headers = githubHeadersFromToken(token);
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: repoName, auto_init: true, private: false }),
  });
  if (res.status === 422) return true;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`GitHub repo create failed (${res.status}): ${body.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function pushFilesToGitHub(
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>,
  token: string,
): Promise<boolean> {
  const headers = githubHeadersFromToken(token);
  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, {
    headers,
  });
  if (!refRes.ok) {
    console.error(`GitHub get ref failed (${refRes.status})`);
    return false;
  }
  const refData = await refRes.json() as any;
  const latestCommitSha = refData.object.sha;

  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of files) {
    const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
    });
    if (!blobRes.ok) {
      console.error(`GitHub blob create failed for ${file.path}: ${blobRes.status}`);
      continue;
    }
    const blobData = await blobRes.json() as any;
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blobData.sha });
  }

  if (treeItems.length === 0) return false;

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: latestCommitSha, tree: treeItems }),
  });
  if (!treeRes.ok) {
    console.error(`GitHub tree create failed: ${treeRes.status}`);
    return false;
  }
  const treeData = await treeRes.json() as any;

  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Initial scaffold from Clowder",
      tree: treeData.sha,
      parents: [latestCommitSha],
    }),
  });
  if (!commitRes.ok) {
    console.error(`GitHub commit create failed: ${commitRes.status}`);
    return false;
  }
  const commitData = await commitRes.json() as any;

  const updateRefRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitData.sha }),
    },
  );
  if (!updateRefRes.ok) {
    console.error(`GitHub ref update failed: ${updateRefRes.status}`);
    return false;
  }
  return true;
}

async function scaffoldAndDeploy(
  sessionId: string,
  sessionName: string,
  specContent: string,
  tables: TableDef[],
  projectApiKey: string,
  projectId: string,
  sendProgress: (msg: string, meta?: Record<string, unknown>) => Promise<void>,
): Promise<{ appId: string; appUrl: string; repoUrl: string } | null> {
  const suffix = Math.random().toString(36).slice(2, 6);
  const slug = sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 25) + "-" + suffix;

  const githubToken = await getGitHubToken();
  if (!githubToken) {
    await sendProgress("GitHub token not available — skipping scaffold deploy. Install the Kapable Develop App on GitHub to enable this.");
    return null;
  }

  await sendProgress("Generating your app code...");

  const tableDescriptions = tables
    .map((t) => `- ${t.name}: ${t.columns.map((c) => `${c.name}(${c.type})`).join(", ")}`)
    .join("\n");

  const scaffoldPrompt = `You are generating a complete, deployable React Router 7 + Bun web application.

## App Spec
${specContent.slice(0, 4000)}

## Database Tables (already provisioned on Kapable)
${tableDescriptions}

## API Access
- Base URL: https://api.kapable.dev
- API Key: ${projectApiKey}
- Data API: GET/POST/PUT/DELETE /v1/data/{table_name}
- Auth: Include header "x-api-key: ${projectApiKey}" on all requests

## Requirements
1. Use React Router v7 with file-based routing
2. Use Bun as the runtime
3. Use Tailwind CSS with dark mode
4. Create CRUD pages for each table (list view + detail/edit view)
5. Include a homepage/dashboard that links to each table's list view
6. Keep it minimal and functional — no over-engineering
7. Use fetch() for all API calls with the x-api-key header

## Output Format
Output ONLY file contents in this exact format, one file per block:
--- FILE: path/to/file.ext ---
(file contents)
--- END FILE ---

Required files:
- package.json (with dependencies: react, react-dom, react-router, @types/react, tailwindcss, etc.)
- app/root.tsx
- app/routes/_index.tsx (dashboard)
- app/lib/api.ts (Kapable Data API client)
- app/tailwind.css
- tailwind.config.ts
- tsconfig.json
- vite.config.ts
- react-router.config.ts

Plus route files for each table's CRUD pages.`;

  try {
    const output = await callLLM(scaffoldPrompt, { maxTokens: 16384, timeout: 180000, model: "anthropic/claude-sonnet-4" });

    if (output.length < 200) {
      await sendProgress("Scaffold generation produced insufficient output. Skipping deploy.");
      return null;
    }

    const fileBlocks = output.matchAll(/--- FILE: (.+?) ---\n([\s\S]*?)--- END FILE ---/g);
    const files: Array<{ path: string; content: string }> = [];
    for (const match of fileBlocks) {
      files.push({ path: match[1].trim(), content: match[2] });
    }

    if (files.length < 3) {
      await sendProgress("Scaffold generation did not produce enough files. Skipping deploy.");
      return null;
    }

    await sendProgress(`Generated ${files.length} files. Pushing to GitHub...`);

    const repoName = `clowder-${slug}`;
    const owner = "hgeldenhuys";
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    const repoCreated = await createGitHubRepo(repoName, githubToken);
    if (!repoCreated) {
      await sendProgress("Failed to create GitHub repo. The scaffold was generated but not saved.");
      return null;
    }

    await new Promise((r) => setTimeout(r, 2000));

    const pushed = await pushFilesToGitHub(owner, repoName, files, githubToken);
    if (!pushed) {
      await sendProgress(`Failed to push files to GitHub. Repo created at: ${repoUrl}`);
      return null;
    }

    await sendProgress("Registering app on Kapable...");

    const registerRes = await fetch(`${getApiBaseUrl()}/v1/apps`, {
      method: "POST",
      headers: platformHeaders(),
      body: JSON.stringify({
        name: sessionName,
        slug,
        git_repo: repoUrl,
        project_id: projectId,
        framework: "react-router",
        runtime: "bun",
      }),
    });

    if (!registerRes.ok) {
      const errBody = await registerRes.text().catch(() => "");
      await sendProgress(`App registration failed (${registerRes.status}): ${errBody.slice(0, 100)}. Scaffold is on GitHub: ${repoUrl}`);
      return null;
    }

    const appData = await registerRes.json() as any;
    const appId = appData.app?.id ?? appData.id;

    await sendProgress("Deploying your app...");

    const deployRes = await fetch(
      `${getApiBaseUrl()}/v1/apps/${appId}/environments/production/deploy`,
      {
        method: "POST",
        headers: platformHeaders(),
        body: JSON.stringify({ branch: "main" }),
      }
    );

    if (!deployRes.ok) {
      await sendProgress(`Deploy trigger failed (${deployRes.status}). You can deploy manually from: ${repoUrl}`);
    }

    const appUrl = `https://${slug}.kapable.run`;
    return { appId, appUrl, repoUrl };
  } catch (e) {
    console.error("Scaffold and deploy failed:", e);
    await sendProgress(`App scaffolding encountered an error: ${String(e).slice(0, 200)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Task 10: Generate structured spec JSON (not markdown)
// ---------------------------------------------------------------------------

/**
 * Generate a structured FromSpec payload from the session description.
 * Returns a JSON object ready for POST /v1/board/from-spec.
 */
async function generateSpecJson(
  sessionName: string,
  sessionDescription: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ specPayload: FromSpecPayload; tables: TableDef[] } | null> {
  const expertMessages = messages.filter((m) => m.role === "expert");
  const hasExpertContext = expertMessages.length > 1;
  const contextBlock = hasExpertContext
    ? `\nExpert discussion:\n${expertMessages.slice(-5).map((m) => m.content).join("\n")}\n`
    : "";

  const prompt = `Extract a database schema from this app description. Output ONLY a fenced JSON array, nothing else.

App: ${sessionDescription}
${contextBlock}
\`\`\`json
[
  { "name": "table_name", "columns": [
    { "name": "col", "type": "text", "required": true }
  ]}
]
\`\`\`

Rules:
- Types: text, integer, boolean, timestamp, json, uuid, vector
- Every table MUST include "id" (uuid, required) and "created_at" (timestamp, required)
- Use foreign key columns (e.g. "user_id" uuid) for relationships
- Include all entities from the description
- lowercase_with_underscores for names
- Output ONLY the JSON array in a fenced code block, no other text`;

  try {
    const spec = await callLLM(prompt, { maxTokens: 3072, timeout: 30000 });

    if (spec.length > 100) {
      const tables = parseDataModel(spec);
      if (tables.length > 0) {
        const payload: FromSpecPayload = {
          name: sessionName,
          tables: tables.map((t) => t.name),
          spec: { tables },
        };
        return { specPayload: payload, tables };
      }
    }
  } catch (e) {
    console.error("LLM spec generation failed:", e);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Task 11: Trigger clowder.build flow via API
// ---------------------------------------------------------------------------

/**
 * Trigger the clowder.build flow pipeline.
 * Returns the flow run_id for event streaming, or null if flow not configured.
 */
async function triggerBuildFlow(
  sessionId: string,
  specPayload: FromSpecPayload,
  projectId: string,
  projectApiKey: string,
): Promise<{ runId: string } | null> {
  const buildFlowId = process.env.CLOWDER_BUILD_FLOW_ID;
  if (!buildFlowId) {
    console.warn("CLOWDER_BUILD_FLOW_ID not configured — falling back to legacy scaffold");
    return null;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/v1/flows/${buildFlowId}/run`, {
      method: "POST",
      headers: platformHeaders(),
      body: JSON.stringify({
        variables: {
          input: JSON.stringify({
            ...specPayload,
            sessionId,
            projectId,
            apiKey: projectApiKey,
          }),
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Build flow trigger failed (${res.status}): ${body.slice(0, 200)}`);
      return null;
    }

    const data = await res.json() as any;
    const runId = data.data?.run_id ?? data.run_id ?? data.data?.id;
    if (!runId) {
      console.error("Build flow response missing run_id:", JSON.stringify(data).slice(0, 200));
      return null;
    }

    return { runId };
  } catch (e) {
    console.error("Build flow trigger error:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Task 12: Stream flow events as chat system messages
// ---------------------------------------------------------------------------

/**
 * Connect to the flow run SSE stream and forward log/node events
 * as system messages in the Clowder chat.
 * Runs in the background — does not block.
 */
async function streamFlowEvents(
  sessionId: string,
  flowId: string,
  runId: string,
): Promise<void> {
  const url = `${getApiBaseUrl()}/v1/flows/${flowId}/runs/${runId}/events`;

  try {
    const res = await fetch(url, {
      headers: {
        ...platformHeaders(),
        Accept: "text/event-stream",
      },
      signal: AbortSignal.timeout(1800000), // 30 min max
    });

    if (!res.ok || !res.body) {
      console.error(`Flow event stream failed (${res.status})`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);
          await handleFlowEvent(sessionId, event);
        } catch {
          // Skip malformed events
        }
      }
    }
  } catch (e) {
    if (String(e).includes("abort")) return; // Timeout is expected
    console.error("Flow event stream error:", e);
  }
}

/**
 * Handle a single flow event and forward relevant ones to Clowder chat.
 */
async function handleFlowEvent(
  sessionId: string,
  event: Record<string, any>,
): Promise<void> {
  const eventType = event.event_type ?? event.type;

  // Forward log node outputs as system messages
  if (eventType === "node_complete" && event.node_type === "log") {
    const message = event.output ?? event.message ?? "";
    if (message) {
      await sendClowderMessage(sessionId, {
        content: message,
        role: "system",
        metadata: { source: "flow", node_type: "log" },
      });
    }
    return;
  }

  // Forward loop iteration progress
  if (eventType === "log" && event.event_name === "loop_iteration_start") {
    const iteration = event.data?.iteration ?? "?";
    const max = event.data?.max ?? "?";
    await sendClowderMessage(sessionId, {
      content: `Sprint ${iteration}/${max} starting...`,
      role: "system",
      metadata: { source: "flow", event_name: "loop_iteration_start" },
    });
    return;
  }

  // Forward agent node completions
  if (eventType === "node_complete" && event.node_type === "agent") {
    const output = event.output ?? "";
    const summary = output.length > 200 ? output.slice(0, 200) + "..." : output;
    if (summary) {
      await sendClowderMessage(sessionId, {
        content: `Agent completed: ${summary}`,
        role: "system",
        metadata: { source: "flow", node_type: "agent" },
      });
    }
    return;
  }

  // Forward flow completion
  if (eventType === "flow_complete" || eventType === "run_complete") {
    const status = event.status ?? "done";
    await sendClowderMessage(sessionId, {
      content: status === "done"
        ? "Build pipeline completed successfully!"
        : `Build pipeline finished with status: ${status}`,
      role: "system",
      metadata: { source: "flow", event_type: eventType, status },
    });
    return;
  }

  // Forward flow errors
  if (eventType === "node_error" || eventType === "flow_error") {
    const error = event.error_message ?? event.error ?? "Unknown error";
    await sendClowderMessage(sessionId, {
      content: `Build pipeline error: ${String(error).slice(0, 300)}`,
      role: "system",
      metadata: { source: "flow", event_type: eventType },
    });
  }
}

// ---------------------------------------------------------------------------
// Save artifacts to Vault
// ---------------------------------------------------------------------------

async function saveArtifactsToVault(
  orgId: string,
  sessionName: string,
  artifacts: BuildArtifact[]
): Promise<void> {
  for (const artifact of artifacts) {
    const path = `apps/${sessionName.toLowerCase().replace(/\s+/g, "-")}/${artifact.type}.md`;

    try {
      await fetch(`${getApiBaseUrl()}/v1/vault/files/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: platformHeaders(),
        body: JSON.stringify({
          content: artifact.content,
          message: `Clowder: Add ${artifact.title}`,
          org_id: orgId,
        }),
      });
    } catch (e) {
      console.error(`Failed to save artifact ${path}:`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Main build phase
// ---------------------------------------------------------------------------

/**
 * Run the build phase for a session.
 *
 * Priority: clowder.build flow (if CLOWDER_BUILD_FLOW_ID set) > scaffoldAndDeploy
 */
export async function runBuildPhase(sessionId: string): Promise<void> {
  const buildStart = Date.now();
  const { session } = await getClowderSession(sessionId);
  const [experts, messages] = await Promise.all([
    listClowderExperts(sessionId),
    listClowderMessages(sessionId),
  ]);

  // Update session to planning phase
  await sendClowderMessage(sessionId, {
    content: "Great — I have enough to work with. Let me synthesize what we've discussed and create your app plan.",
    role: "system",
    metadata: { phase: "planning" },
  });

  // ---------------------------------------------------------------------------
  // Task 10: Generate structured spec JSON
  // ---------------------------------------------------------------------------

  const specResult = await generateSpecJson(
    session.name,
    session.description ?? "",
    messages.map((m) => ({ role: m.role, content: m.content }))
  );

  let tables: TableDef[] = [];
  let specPayload: FromSpecPayload | null = null;

  if (specResult) {
    tables = specResult.tables;
    specPayload = specResult.specPayload;

    // Write spec.json to Vault
    const specJsonPath = sessionVaultPath(sessionId, "spec.json");
    await writeVaultFile(specJsonPath, JSON.stringify(specPayload, null, 2)).catch((e) =>
      console.error("Vault spec.json write failed:", e)
    );

    // Save legacy markdown artifact too (for human readability)
    const artifacts: BuildArtifact[] = [{
      type: "spec",
      title: "App Specification",
      content: JSON.stringify(specPayload, null, 2),
    }];

    // Save to platform artifacts table
    for (const artifact of artifacts) {
      try {
        await fetch(`${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/artifacts`, {
          method: "POST",
          headers: platformHeaders(),
          body: JSON.stringify({
            artifact_type: artifact.type,
            title: artifact.title,
            content: artifact.content,
            created_by: "po",
          }),
        });
      } catch (e) {
        console.error("Failed to save artifact:", e);
      }
    }

    await saveArtifactsToVault(session.org_id, session.name, artifacts).catch(() => {});
  } else {
    // Fallback: generate stub artifacts (no tables extracted)
    const stubArtifacts: BuildArtifact[] = [{
      type: "spec",
      title: "App Specification",
      content: `# App Specification\n\n## Overview\n${session.description ?? ""}\n\n## Status\nNo structured data model was extracted. Planning artifacts will be generated manually.`,
    }];

    for (const artifact of stubArtifacts) {
      try {
        await fetch(`${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/artifacts`, {
          method: "POST",
          headers: platformHeaders(),
          body: JSON.stringify({
            artifact_type: artifact.type,
            title: artifact.title,
            content: artifact.content,
            created_by: "po",
          }),
        });
      } catch (e) {
        console.error("Failed to save artifact:", e);
      }
    }
  }

  // Mark all experts as "building"
  for (const expert of experts) {
    await updateClowderExpert(sessionId, expert.id, {
      status: "building",
      confidence: 1.0,
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Platform provisioning: create project + tables from spec
  // ---------------------------------------------------------------------------

  let provisionResult: { projectId: string; apiKey: string; tables: string[] } | null = null;

  if (tables.length > 0) {
    await sendClowderMessage(sessionId, {
      content: `Creating your app on the Kapable platform...`,
      role: "system",
      metadata: { phase: "building" },
    });

    try {
      const { projectId, apiKey, slug } = await provisionProject(session.name);

      await sendClowderMessage(sessionId, {
        content: `Project created! Now setting up ${tables.length} database table${tables.length > 1 ? "s" : ""}...`,
        role: "system",
        metadata: { phase: "building", project_id: projectId },
      });

      const createdTables = await provisionTables(apiKey, tables);

      await updateSessionApp(sessionId, projectId, "");

      provisionResult = { projectId, apiKey, tables: createdTables };

      await sendClowderMessage(sessionId, {
        content: `Tables created: ${createdTables.map((t) => `\`${t}\``).join(", ")}`,
        role: "system",
        metadata: { phase: "building", tables: createdTables },
      });
    } catch (e) {
      console.error("Platform provisioning failed:", e);
      await sendClowderMessage(sessionId, {
        content: `Platform provisioning encountered an error. Your planning documents are still saved — a developer can provision manually.`,
        role: "system",
        metadata: { phase: "building", error: String(e) },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Task 11: Trigger build flow (or fallback to scaffold)
  // ---------------------------------------------------------------------------

  let deployResult: { appId: string; appUrl: string; repoUrl: string } | null = null;
  let flowTriggered = false;

  if (provisionResult && provisionResult.tables.length > 0 && specPayload) {
    // Try flow-based build first
    const flowResult = await triggerBuildFlow(
      sessionId,
      specPayload,
      provisionResult.projectId,
      provisionResult.apiKey,
    );

    if (flowResult) {
      flowTriggered = true;
      const buildFlowId = process.env.CLOWDER_BUILD_FLOW_ID!;

      await sendClowderMessage(sessionId, {
        content: `Build pipeline started! Your app is being built iteratively by AI agents.`,
        role: "system",
        metadata: {
          phase: "building",
          flow_run_id: flowResult.runId,
          flow_id: buildFlowId,
        },
      });

      // Task 12: Stream flow events in the background (fire-and-forget)
      streamFlowEvents(sessionId, buildFlowId, flowResult.runId).catch((e) =>
        console.error("Flow event stream error:", e)
      );
    } else {
      // Fallback to legacy scaffold
      const sendProgress = async (msg: string, meta?: Record<string, unknown>) => {
        await sendClowderMessage(sessionId, {
          content: msg,
          role: "system",
          metadata: { phase: "building", ...meta },
        });
      };

      deployResult = await scaffoldAndDeploy(
        sessionId,
        session.name,
        JSON.stringify(specPayload),
        tables,
        provisionResult.apiKey,
        provisionResult.projectId,
        sendProgress,
      );

      if (deployResult) {
        await updateSessionApp(sessionId, deployResult.appId, deployResult.appUrl);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Final summary message
  // ---------------------------------------------------------------------------

  const summaryLines = [
    `Planning complete! Here's what was created:`,
    ``,
    `- App Specification (spec.json)`,
  ];

  if (provisionResult) {
    summaryLines.push(
      ``,
      `**Platform provisioned:**`,
      `- Project ID: \`${provisionResult.projectId}\``,
      `- Tables: ${provisionResult.tables.map((t) => `\`${t}\``).join(", ")}`,
    );
  } else if (tables.length === 0) {
    summaryLines.push(
      ``,
      `No structured data model was found in the spec. A developer can provision tables manually.`,
    );
  }

  if (flowTriggered) {
    summaryLines.push(
      ``,
      `**Build pipeline running:**`,
      `Your app is being built iteratively by AI agents. Progress updates will appear in chat.`,
    );
  } else if (deployResult) {
    summaryLines.push(
      ``,
      `**Your app is live!**`,
      `- URL: ${deployResult.appUrl}`,
      `- GitHub: ${deployResult.repoUrl}`,
    );
  }

  summaryLines.push(``, `Your app plan has been saved to your Org Vault.`);

  // Phase: "building" if flow is running, "delivered" if scaffold deployed, "planning" if nothing deployed
  const finalPhase = flowTriggered ? "building" : (provisionResult ? "delivered" : "planning");
  const phaseExtra = deployResult?.appUrl ? { app_url: deployResult.appUrl } : undefined;
  await updateSessionPhase(sessionId, finalPhase, phaseExtra);

  await sendClowderMessage(sessionId, {
    content: summaryLines.join("\n"),
    role: "system",
    metadata: {
      phase: finalPhase,
      provisioned: !!provisionResult,
      tables_created: provisionResult?.tables.length ?? 0,
      table_names: provisionResult?.tables ?? [],
      project_id: provisionResult?.projectId ?? null,
      deployed: !!deployResult,
      flow_triggered: flowTriggered,
      app_url: deployResult?.appUrl,
      build_time_ms: Date.now() - buildStart,
    },
  });

  // Auto-purge stale sessions to keep pool healthy (fire-and-forget)
  purgeStale().catch(() => {});
}

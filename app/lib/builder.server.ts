/**
 * Clowder Build Phase Orchestrator.
 *
 * When the user triggers "force start" or all experts reach sufficient confidence,
 * this orchestrator:
 * 1. Synthesizes the planning artifacts (spec, backlog, arch doc, data model)
 * 2. Saves them to Org Vault via the platform API
 * 3. (v1 stub) Marks experts as "building" and the session as "building"
 * 4. (v2) Creates KAIT sessions per expert and monitors build progress
 *
 * V1 is intentionally stubbed for the build phase execution.
 * V2 will wire KAIT sessions to each expert.
 */

import {
  getClowderSession,
  listClowderExperts,
  listClowderMessages,
  sendClowderMessage,
  updateClowderExpert,
  updateSessionPhase,
  getApiBaseUrl,
} from "./api.server";
import { updateSessionApp } from "./db.server";

interface BuildArtifact {
  type: "spec" | "backlog" | "architecture" | "data_model";
  title: string;
  content: string;
}

/**
 * Call an LLM via OpenRouter API.
 * Uses OPENROUTER_API_KEY from env, falls back to empty string.
 */
async function callLLM(prompt: string, options?: { maxTokens?: number; timeout?: number; model?: string }): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 120000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? "google/gemini-2.0-flash-001",
        max_tokens: options?.maxTokens ?? 8192,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenRouter API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Data model parsing (BL-CLW-003)
// ---------------------------------------------------------------------------

interface TableDef {
  name: string;
  columns: Array<{ name: string; type: string; required?: boolean }>;
}

const VALID_TYPES = new Set(["text", "integer", "boolean", "timestamp", "json", "uuid", "vector"]);

function parseDataModel(spec: string): TableDef[] {
  const match = spec.match(/```json:data_model\n([\s\S]+?)\n```/);
  if (!match) return [];
  try {
    const tables: TableDef[] = JSON.parse(match[1]);
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
  const created: string[] = [];
  for (const table of tables) {
    try {
      // Map our TableDef format to the platform's ColumnDef format:
      // - col_type (not type) — matches Rust ColumnDef struct
      // - nullable is required (default true for user columns)
      // - Filter out "id" and "created_at" — platform auto-adds these
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
      if (res.ok) {
        created.push(table.name);
      } else {
        const errBody = await res.text().catch(() => "");
        console.error(`Table ${table.name} creation failed (${res.status}): ${errBody.slice(0, 300)}`);
      }
    } catch (e) {
      console.error(`Table ${table.name} creation error:`, e);
      // Non-fatal — continue with other tables
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// Scaffold + Deploy (BL-CLW-002)
// ---------------------------------------------------------------------------

/**
 * GitHub REST API helpers — no CLI tools needed on production.
 * Requires GITHUB_TOKEN env var.
 */
function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? "";
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function createGitHubRepo(repoName: string): Promise<boolean> {
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: repoName, auto_init: true, private: false }),
  });
  if (res.status === 422) return true; // Already exists — OK
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
): Promise<boolean> {
  // Get the default branch's latest commit SHA
  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, {
    headers: githubHeaders(),
  });
  if (!refRes.ok) {
    console.error(`GitHub get ref failed (${refRes.status})`);
    return false;
  }
  const refData = await refRes.json() as any;
  const latestCommitSha = refData.object.sha;

  // Create blobs for each file
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of files) {
    const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
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

  // Create a tree
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: latestCommitSha, tree: treeItems }),
  });
  if (!treeRes.ok) {
    console.error(`GitHub tree create failed: ${treeRes.status}`);
    return false;
  }
  const treeData = await treeRes.json() as any;

  // Create a commit
  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
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

  // Update the ref to point to the new commit
  const updateRefRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
    {
      method: "PATCH",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitData.sha }),
    },
  );
  if (!updateRefRes.ok) {
    console.error(`GitHub ref update failed: ${updateRefRes.status}`);
    return false;
  }
  return true;
}

/**
 * Generate a minimal RR7 + Bun scaffold via LLM,
 * push to GitHub via REST API, register as Connect App, and trigger deploy.
 */
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

  const githubToken = process.env.GITHUB_TOKEN ?? "";
  if (!githubToken) {
    await sendProgress("GITHUB_TOKEN not configured — skipping scaffold deploy.");
    return null;
  }

  // Step 1: Generate scaffold with LLM
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

    // Parse the file blocks
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

    // Step 2: Create GitHub repo and push files via REST API
    const repoName = `clowder-${slug}`;
    const owner = "hgeldenhuys";
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    const repoCreated = await createGitHubRepo(repoName);
    if (!repoCreated) {
      await sendProgress("Failed to create GitHub repo. The scaffold was generated but not saved.");
      return null;
    }

    // Small delay to let GitHub initialize the repo
    await new Promise((r) => setTimeout(r, 2000));

    const pushed = await pushFilesToGitHub(owner, repoName, files);
    if (!pushed) {
      await sendProgress(`Failed to push files to GitHub. Repo created at: ${repoUrl}`);
      return null;
    }

    // Step 3: Register as Connect App
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

    // Step 4: Trigger deploy
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

/**
 * Generate planning artifacts using Claude headless.
 * Falls back to stub content if Claude is not available.
 */
async function generatePlanningArtifacts(
  sessionDescription: string,
  messages: Array<{ role: string; content: string }>
): Promise<BuildArtifact[]> {
  const conversationSummary = messages
    .slice(-20)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `Extract a database schema from this app description.

App: ${sessionDescription}

Context:
${conversationSummary}

Output a brief app summary (3-5 sentences), then a JSON data model block.

\`\`\`json:data_model
[
  { "name": "table_name", "columns": [
    { "name": "col", "type": "text", "required": true }
  ]}
]
\`\`\`

Rules:
- Supported column types: text, integer, boolean, timestamp, json, uuid, vector
- Every table MUST include "id" (uuid, required) and "created_at" (timestamp, required)
- Use foreign key columns (e.g. "user_id" of type "uuid") for relationships
- Include all entities mentioned in the description
- Keep table/column names lowercase with underscores
- Output ONLY the summary paragraph and the json:data_model block, nothing else`;

  try {
    const spec = await callLLM(prompt, { maxTokens: 4096, timeout: 60000 });

    if (spec.length > 100) {
      return [
        {
          type: "spec",
          title: "App Specification",
          content: spec,
        },
      ];
    }
  } catch (e) {
    console.error("LLM spec generation failed:", e);
    // Fall through to stub
  }

  // Stub artifacts — used when Claude is not available
  return [
    {
      type: "spec",
      title: "App Specification",
      content: `# App Specification

## Overview
${sessionDescription}

## Status
Planning artifacts will be generated by the expert committee during the build phase.

## Next Steps
- Expert committee to finalize requirements
- Architecture review
- Implementation kickoff
`,
    },
    {
      type: "backlog",
      title: "Implementation Backlog",
      content: `# Implementation Backlog

## Epic 1: Core Infrastructure
- [ ] Project setup and scaffolding
- [ ] Database schema implementation
- [ ] Authentication system
- [ ] API layer

## Epic 2: Core Features
- [ ] Primary user flow
- [ ] Data management UI
- [ ] User account management

## Epic 3: Polish
- [ ] Responsive design
- [ ] Error handling
- [ ] Performance optimization
- [ ] Documentation
`,
    },
  ];
}

/**
 * Save artifacts to Org Vault via the platform API.
 */
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
      // Non-fatal — continue with other artifacts
    }
  }
}

/**
 * Run the build phase for a session.
 *
 * V1: Generates artifacts, saves to vault, marks session as "building".
 * V2: Will spawn KAIT sessions per expert for actual implementation.
 */
export async function runBuildPhase(sessionId: string): Promise<void> {
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

  // Generate artifacts
  const artifacts = await generatePlanningArtifacts(
    session.description ?? "",
    messages.map((m) => ({ role: m.role, content: m.content }))
  );

  // Save artifacts to platform (Clowder artifacts table)
  for (const artifact of artifacts) {
    try {
      await fetch(`${getApiBaseUrl()}/v1/clowder/sessions/${sessionId}/artifacts`, {
        method: "POST",
        headers: platformHeaders(),
        body: JSON.stringify({
          artifact_type: artifact.type === "spec" ? "spec" : artifact.type,
          title: artifact.title,
          content: artifact.content,
          created_by: "po",
        }),
      });
    } catch (e) {
      console.error("Failed to save artifact:", e);
    }
  }

  // Also try vault (non-fatal)
  await saveArtifactsToVault(session.org_id, session.name, artifacts).catch(() => {});

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

  const specContent = artifacts.find((a) => a.type === "spec")?.content ?? "";
  const tables = parseDataModel(specContent);

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

      const appUrl = `https://${slug}.kapable.run`;

      // Persist project info via Data API
      await updateSessionApp(sessionId, projectId, appUrl);

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
  // Scaffold + Deploy: generate frontend, push to GitHub, deploy
  // ---------------------------------------------------------------------------

  let deployResult: { appId: string; appUrl: string; repoUrl: string } | null = null;

  if (provisionResult && provisionResult.tables.length > 0) {
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
      specContent,
      tables,
      provisionResult.apiKey,
      provisionResult.projectId,
      sendProgress,
    );

    if (deployResult) {
      // Update Data API with final app URL
      await updateSessionApp(sessionId, deployResult.appId, deployResult.appUrl);
    }
  }

  // Final summary message
  const summaryLines = [
    `Planning complete! Here's what was created:`,
    ``,
    ...artifacts.map((a) => `- ${a.title}`),
  ];

  if (provisionResult) {
    summaryLines.push(
      ``,
      `**Platform provisioned:**`,
      `- Project ID: \`${provisionResult.projectId}\``,
      `- Tables: ${provisionResult.tables.map((t) => `\`${t}\``).join(", ")}`,
    );
  } else if (tables.length === 0 && specContent.length > 100) {
    summaryLines.push(
      ``,
      `No structured data model was found in the spec. A developer can provision tables manually.`,
    );
  }

  if (deployResult) {
    summaryLines.push(
      ``,
      `**Your app is live!**`,
      `- URL: ${deployResult.appUrl}`,
      `- GitHub: ${deployResult.repoUrl}`,
    );
  }

  summaryLines.push(``, `Your app plan has been saved to your Org Vault.`);

  // Update session phase based on outcome
  const finalPhase = deployResult ? "delivered" : provisionResult ? "building" : "planning";
  await updateSessionPhase(sessionId, finalPhase);

  await sendClowderMessage(sessionId, {
    content: summaryLines.join("\n"),
    role: "system",
    metadata: {
      phase: finalPhase,
      artifacts_count: artifacts.length,
      provisioned: !!provisionResult,
      tables_created: provisionResult?.tables.length ?? 0,
      deployed: !!deployResult,
      app_url: deployResult?.appUrl,
    },
  });
}

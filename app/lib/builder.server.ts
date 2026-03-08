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

import { execSync } from "child_process";
import {
  getClowderSession,
  listClowderExperts,
  listClowderMessages,
  sendClowderMessage,
  updateClowderExpert,
  getApiBaseUrl,
  buildHeaders,
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
async function callLLM(prompt: string, options?: { maxTokens?: number; timeout?: number }): Promise<string> {
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
        model: "anthropic/claude-sonnet-4",
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

async function provisionProject(
  sessionName: string
): Promise<{ projectId: string; apiKey: string }> {
  const slug = sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const res = await fetch(`${getApiBaseUrl()}/v1/projects`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ name: sessionName, slug }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
  const data = await res.json();
  const liveKey = data.api_keys?.find((k: any) => k.key_type === "live");
  return { projectId: data.project.id, apiKey: liveKey?.key ?? "" };
}

async function provisionTables(
  apiKey: string,
  tables: TableDef[]
): Promise<string[]> {
  const created: string[] = [];
  for (const table of tables) {
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/_meta/tables/${table.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ storage_mode: "typed", columns: table.columns }),
      });
      if (res.ok) created.push(table.name);
    } catch {
      // Non-fatal — continue with other tables
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// Scaffold + Deploy (BL-CLW-002)
// ---------------------------------------------------------------------------

/**
 * Generate a minimal RR7 + Bun scaffold via Claude headless,
 * push to GitHub, register as Connect App, and trigger deploy.
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
  const slug = sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const scaffoldDir = `/tmp/clowder-scaffold-${sessionId}`;

  // Step 1: Generate scaffold with Claude headless
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
3. Use shadcn/ui components with dark mode (Tailwind CSS)
4. Create CRUD pages for each table (list view + detail/edit view)
5. Include a simple login/signup page using Kapable session tokens
6. Include a homepage/dashboard that links to each table's list view
7. Keep it minimal and functional — no over-engineering

## Output Format
Output ONLY file contents in this exact format, one file per block:
--- FILE: path/to/file.ext ---
(file contents)
--- END FILE ---

Required files:
- package.json (with dependencies: react, react-dom, react-router, @types/react, tailwindcss, etc.)
- app/root.tsx
- app/routes/_index.tsx (dashboard)
- app/routes/login.tsx
- app/lib/api.ts (Kapable Data API client)
- app/tailwind.css
- tailwind.config.ts
- tsconfig.json
- vite.config.ts
- react-router.config.ts

Plus route files for each table's CRUD pages.`;

  try {
    const output = await callLLM(scaffoldPrompt, { maxTokens: 16384, timeout: 180000 });

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

    // Step 2: Write files to disk
    await sendProgress(`Writing ${files.length} files to scaffold...`);

    execSync(`rm -rf ${scaffoldDir} && mkdir -p ${scaffoldDir}`, { encoding: "utf8" });
    for (const file of files) {
      const fullPath = `${scaffoldDir}/${file.path}`;
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      execSync(`mkdir -p "${dir}"`, { encoding: "utf8" });
      const { writeFileSync } = await import("node:fs");
      writeFileSync(fullPath, file.content, "utf8");
    }

    // Step 3: Initialize git and push to GitHub
    await sendProgress("Pushing to GitHub...");

    const repoName = `clowder-${slug}`;
    try {
      execSync(
        `cd ${scaffoldDir} && git init && git add -A && git commit -m "Initial scaffold from Clowder" && gh repo create hgeldenhuys/${repoName} --public --source=. --push`,
        { encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] }
      );
    } catch (e) {
      // Repo might already exist — try just pushing
      try {
        execSync(
          `cd ${scaffoldDir} && git remote add origin https://github.com/hgeldenhuys/${repoName}.git 2>/dev/null; git push -u origin main`,
          { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] }
        );
      } catch {
        await sendProgress("Failed to push to GitHub. The scaffold is saved locally.");
        return null;
      }
    }

    const repoUrl = `https://github.com/hgeldenhuys/${repoName}`;

    // Step 4: Register as Connect App
    await sendProgress("Registering app on Kapable...");

    const registerRes = await fetch(`${getApiBaseUrl()}/v1/apps`, {
      method: "POST",
      headers: buildHeaders(),
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
      await sendProgress(`App registration failed (${registerRes.status}). Scaffold is on GitHub: ${repoUrl}`);
      return null;
    }

    const appData = await registerRes.json();
    const appId = appData.app?.id ?? appData.id;

    // Step 5: Trigger deploy
    await sendProgress("Deploying your app...");

    const deployRes = await fetch(
      `${getApiBaseUrl()}/v1/apps/${appId}/environments/production/deploy`,
      {
        method: "POST",
        headers: buildHeaders(),
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

  const prompt = `Based on this app idea and expert discussion, generate a planning document.

App Idea: ${sessionDescription}

Expert Discussion:
${conversationSummary}

Generate a comprehensive spec in markdown. Include:
1. App overview and value proposition
2. Target users
3. Core features (MVP)
4. User flows
5. Data model (entities and relationships)
6. Technical architecture
7. Implementation backlog (10-15 prioritized stories)

IMPORTANT: At the end of your markdown, include a JSON code block with the data model:
\`\`\`json:data_model
[
  { "name": "table_name", "columns": [
    { "name": "col", "type": "text", "required": true }
  ]}
]
\`\`\`
Supported column types: text, integer, boolean, timestamp, json, uuid, vector
Every table should include an "id" column of type "uuid" and a "created_at" column of type "timestamp".

Output only the markdown document, no preamble.`;

  try {
    const spec = await callLLM(prompt, { maxTokens: 8192, timeout: 120000 });

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
        headers: buildHeaders(),
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
        headers: buildHeaders(),
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
      const { projectId, apiKey } = await provisionProject(session.name);

      await sendClowderMessage(sessionId, {
        content: `Project created! Now setting up ${tables.length} database table${tables.length > 1 ? "s" : ""}...`,
        role: "system",
        metadata: { phase: "building", project_id: projectId },
      });

      const createdTables = await provisionTables(apiKey, tables);

      const slug = session.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      const appUrl = `https://${slug}.kapable.run`;

      // Persist project info in local DB
      updateSessionApp(sessionId, projectId, appUrl);

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
      // Update local DB with final app URL
      updateSessionApp(sessionId, deployResult.appId, deployResult.appUrl);
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

  await sendClowderMessage(sessionId, {
    content: summaryLines.join("\n"),
    role: "system",
    metadata: {
      phase: deployResult ? "delivered" : "building",
      artifacts_count: artifacts.length,
      provisioned: !!provisionResult,
      tables_created: provisionResult?.tables.length ?? 0,
      deployed: !!deployResult,
      app_url: deployResult?.appUrl,
    },
  });
}

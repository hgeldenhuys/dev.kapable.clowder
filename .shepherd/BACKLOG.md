# Clowder Backlog — Deploy Phase

## BL-CLW-001: Build phase provisions project + tables from planning artifacts

**Priority:** P0 — Closes the "no actual build phase" gap
**Effort:** Medium (1 sprint)
**Repo:** `dev.kapable.clowder`

### Context

`runBuildPhase()` in `app/lib/builder.server.ts:163–225` currently:
1. Generates markdown artifacts (spec + backlog) via Claude headless
2. Saves them to vault
3. Marks experts as "building"
4. Sends a "planning complete" system message

It does NOT call any Kapable platform APIs to actually provision the app.

### What to build

After generating artifacts (line 181), add a new step that:

1. **Extracts table definitions from the spec** — The Claude-generated spec includes a "Data Model" section with entities. Parse this to get table names and columns.
2. **Calls `POST /v1/projects`** to create a Kapable project — Returns `project_id` + `sk_live_*` API key.
3. **Calls `PUT /v1/_meta/tables/{name}`** for each table — Using the project API key, creates typed tables with columns from the spec.
4. **Stores `project_id` in the session** — Update `clowder_sessions.app_id` (column already exists, line 35 in `db.server.ts`).
5. **Reports progress via SSE** — Send system messages as each table is created.

### Files to modify

| File | Lines | Change |
|------|-------|--------|
| `app/lib/builder.server.ts` | 163–225 | Add `provisionProject()` + `provisionTables()` calls after artifact generation |
| `app/lib/builder.server.ts` | 36–127 | Update `generatePlanningArtifacts()` prompt to require structured JSON data model section |
| `app/lib/api.server.ts` | 26–39 | Already has `getApiBaseUrl()` and `buildHeaders()` — reuse for platform API calls |
| `app/lib/db.server.ts` | 120–124 | Add `updateSessionApp(id, appId, appUrl)` function to set `app_id` and `app_url` columns |

### New function: `provisionProject()`

```typescript
// builder.server.ts — new function
async function provisionProject(
  sessionName: string,
  orgId: string
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
```

### New function: `provisionTables()`

```typescript
// builder.server.ts — new function
async function provisionTables(
  apiKey: string,
  tables: Array<{ name: string; columns: Array<{ name: string; type: string; required?: boolean }> }>
): Promise<string[]> {
  const created: string[] = [];
  for (const table of tables) {
    const res = await fetch(`${getApiBaseUrl()}/v1/_meta/tables/${table.name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ storage_mode: "typed", columns: table.columns }),
    });
    if (res.ok) created.push(table.name);
  }
  return created;
}
```

### Structured data model extraction

Update the Claude prompt (line 45–61) to append:

```
IMPORTANT: At the end of your markdown, include a JSON code block with the data model:
\`\`\`json:data_model
[
  { "name": "table_name", "columns": [
    { "name": "col", "type": "text", "required": true }
  ]}
]
\`\`\`
Supported types: text, integer, boolean, timestamp, json, uuid
```

Then parse with: `spec.match(/```json:data_model\n([\s\S]+?)\n```/)`

### New DB function

```typescript
// db.server.ts — add after updateSessionPhase (line 124)
export function updateSessionApp(id: string, appId: string, appUrl: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE clowder_sessions SET app_id = ?, app_url = ?, updated_at = ? WHERE id = ?")
    .run(appId, appUrl, now, id);
}
```

### Acceptance Criteria

- [ ] `POST /v1/projects` called during build phase, project created on platform
- [ ] Tables from spec created via `PUT /v1/_meta/tables/{name}` with correct columns
- [ ] `clowder_sessions.app_id` populated after provisioning
- [ ] System messages sent via SSE showing progress: "Creating project...", "Creating table X...", "Tables created!"
- [ ] Graceful fallback if platform API unreachable (artifacts still saved, error reported to user)
- [ ] Existing force-start flow unchanged for ideating → planning transition

---

## BL-CLW-002: Build phase scaffolds and deploys a Connect App frontend

**Priority:** P0 — Completes the deploy loop
**Effort:** Medium-Large (1 sprint)
**Repo:** `dev.kapable.clowder` + new scaffold template repo
**Depends on:** BL-CLW-001

### Context

After BL-CLW-001, we have a Kapable project with tables but no frontend. This story scaffolds a minimal Connect App from a template, pushes to GitHub, registers it via `POST /v1/apps`, and deploys.

### What to build

After tables are provisioned (BL-CLW-001), add:

1. **Scaffold a frontend from template** — Use Claude headless to generate a minimal RR7 + Bun app that:
   - Has CRUD pages for each table (list + detail views)
   - Uses `@kapable/sdk` to call the Data API
   - Has auth (login/signup) via Kapable session tokens
   - Uses shadcn/ui components (dark mode)

2. **Push to GitHub** — Create a new repo under `hgeldenhuys/` org using `gh repo create`, push scaffold.

3. **Register as Connect App** — `POST /v1/apps` with git_repo URL and slug from session name.

4. **Deploy** — `POST /v1/apps/{id}/environments/production/deploy`

5. **Update session** — Set `app_url` to `https://{slug}.kapable.run` and `phase` to `delivered`.

6. **Report to user** — Final system message: "Your app is live at https://{slug}.kapable.run!"

### Files to modify

| File | Lines | Change |
|------|-------|--------|
| `app/lib/builder.server.ts` | After provisionTables() | Add `scaffoldAndDeploy()` function |
| `app/lib/builder.server.ts` | 212–224 | Update final system message to include app URL |
| `app/lib/db.server.ts` | After line 124 | `updateSessionApp()` (from BL-CLW-001) to also set `phase = 'delivered'` |
| `app/routes/session.tsx` | 46–96 | Show "Visit your app" link when `session.app_url` exists |

### Scaffold approach

Use Claude headless with a system prompt containing:
- The app spec (from generated artifacts)
- The table names + columns (from BL-CLW-001)
- A template structure (package.json, routes, components)
- The project API key for Data API calls

Output: A `/tmp/clowder-scaffold-{sessionId}/` directory with a deployable RR7 app.

### Session UI update

```tsx
// session.tsx — show app link when delivered
{session.app_url && (
  <a
    href={session.app_url}
    target="_blank"
    className="text-xs text-primary hover:underline"
  >
    Visit your app →
  </a>
)}
```

### Acceptance Criteria

- [ ] Claude headless generates a working RR7 + Bun scaffold with CRUD for each table
- [ ] Scaffold pushed to new GitHub repo
- [ ] Connect App registered via `POST /v1/apps`
- [ ] Deploy triggered and succeeds (pipeline run status = `succeeded`)
- [ ] `session.app_url` set to `https://{slug}.kapable.run`
- [ ] Session phase transitions to `delivered`
- [ ] User sees "Visit your app →" link in the session UI
- [ ] App loads at the subdomain and shows data from the tables

---

## BL-CLW-003: Enhance Claude prompt to produce structured data model JSON

**Priority:** P1 — Prerequisite quality improvement for BL-CLW-001
**Effort:** Small (30 min)
**Repo:** `dev.kapable.clowder`

### Context

The current prompt (builder.server.ts:45–61) asks Claude to "Include data model (entities and relationships)" as free-form markdown. For BL-CLW-001 to work, we need the data model as parseable JSON.

### What to build

1. Update the synthesis prompt to require a `json:data_model` fenced code block
2. Add a parser function that extracts the JSON from the markdown
3. Validate column types against supported set: `text, integer, boolean, timestamp, json, uuid, vector`
4. Fallback: if JSON block missing, attempt to parse markdown tables

### Files to modify

| File | Lines | Change |
|------|-------|--------|
| `app/lib/builder.server.ts` | 45–61 | Append structured JSON requirement to prompt |
| `app/lib/builder.server.ts` | new | Add `parseDataModel(spec: string)` function |

### Parser function

```typescript
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
    // Validate and filter
    return tables.map((t) => ({
      name: t.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      columns: t.columns.filter((c) => VALID_TYPES.has(c.type)),
    })).filter((t) => t.columns.length > 0);
  } catch {
    return [];
  }
}
```

### Acceptance Criteria

- [ ] Claude prompt explicitly requests `json:data_model` block
- [ ] `parseDataModel()` extracts and validates table definitions
- [ ] Invalid column types are filtered out (not crash)
- [ ] Empty/missing JSON block returns empty array (graceful)
- [ ] At least 3 tables extracted from a typical pet-marketplace-style spec

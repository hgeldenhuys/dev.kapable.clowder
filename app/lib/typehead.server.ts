/**
 * Typehead flow runner for Clowder.
 *
 * Triggers the production typehead flow via Kapable Flow Engine API
 * to predict which specialist experts should join the team.
 *
 * Flow: source → schema_input → llm_predict → schema_output → output
 * Returns structured specialist predictions.
 */

import { getTypeheadFlowId, isTypeheadEnabled } from "./config.server";

const API_BASE = process.env.KAPABLE_API_URL ?? "https://api.kapable.dev";
const API_KEY = process.env.CLOWDER_INTERNAL_API_KEY ?? "";

export interface TypeheadInput {
  name: string;
  description: string;
  file_summaries?: string[];
}

export interface TypeheadSpecialist {
  type: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface TypeheadResult {
  specialists: TypeheadSpecialist[];
  complexity: string;
  estimated_tables: number;
  key_domains: string[];
}

/**
 * Trigger the typehead flow and return the run ID for SSE streaming.
 * Returns null if typehead flow is not configured.
 */
export async function runTypehead(input: TypeheadInput): Promise<{ runId: string; flowId: string } | null> {
  if (!isTypeheadEnabled()) return null;

  const flowId = getTypeheadFlowId();

  const res = await fetch(`${API_BASE}/v1/flows/${flowId}/run`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variables: {
        input: JSON.stringify(input),
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`Typehead flow run failed (${res.status}): ${err.slice(0, 200)}`);
    return null;
  }

  const data = await res.json() as { id?: string; run_id?: string };
  const runId = data.run_id ?? data.id;
  if (!runId) {
    console.error("Typehead flow returned no run ID");
    return null;
  }

  return { runId, flowId };
}

/**
 * Get completed typehead result (poll mode — for non-SSE fallback).
 * Returns null if not yet complete or if there's an error.
 */
export async function getTypeheadResult(flowId: string, runId: string): Promise<TypeheadResult | null> {
  const res = await fetch(`${API_BASE}/v1/flows/${flowId}/runs/${runId}`, {
    headers: { "x-api-key": API_KEY },
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    status?: string;
    output_json?: string;
    nodes?: Array<{ node_type?: string; output_json?: string }>;
  };

  if (data.status !== "completed") return null;

  // Try to parse output from the run's output_json or the last output node
  const outputJson = data.output_json;
  if (!outputJson) return null;

  try {
    return JSON.parse(outputJson) as TypeheadResult;
  } catch {
    console.error("Failed to parse typehead output:", outputJson);
    return null;
  }
}

/**
 * Real-time expert prediction endpoint.
 *
 * Called every 3 words as the user types on the homepage.
 * Uses Gemini 3.1 Flash Lite for ultra-fast, cheap predictions.
 * Returns predicted specialist domains with confidence scores.
 */
import type { Route } from "./+types/api.predict-experts";

const PREDICTION_SYSTEM_PROMPT = `You predict AI expert specialists for an app idea being typed in real-time.
Input may be incomplete — predict from what exists.

ALWAYS needed (don't list): Strategist, Designer, Architect

Specialist pool with trigger signals:
commerce — payments, pricing, marketplace, billing, subscriptions, cart, checkout
compliance — GDPR, HIPAA, legal, audit, privacy, regulations, medical, financial
growth — viral, referral, acquisition, onboarding, retention, engagement
analytics — dashboard, metrics, reporting, KPIs, tracking, insights
security — authentication, encryption, roles, permissions, admin, moderation
iot — sensors, devices, hardware, connectivity, firmware, telemetry
content — editorial, blog, CMS, media, publishing, articles, posts
ai_ml — model, training, inference, recommendations, classification, NLP
realtime — chat, messaging, notifications, live, WebSocket, feed, stream
mapping — map, GPS, location, geospatial, routing, nearby, distance
social — profiles, friends, followers, feed, reactions, comments, sharing
scheduling — calendar, booking, appointments, availability, reservations, events
logistics — delivery, shipping, tracking, warehouse, fleet, dispatch, routes
healthcare — patients, clinical, prescriptions, symptoms, diagnosis, records
education — courses, lessons, assessments, grades, students, curriculum
finance — transactions, ledger, invoicing, budgets, expenses, accounting
media — photos, video, audio, streaming, gallery, uploads, transcoding

Respond with ONLY a JSON array. Each entry: [domain, confidence 0.0-1.0, reason_3_words].
Include novel specialists not in pool if clearly needed — use snake_case domain.
Only include specialists with confidence >= 0.3.
Sort by confidence descending.`;

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json() as { text?: string };
  const text = String(body.text ?? "").trim();

  if (!text || text.split(/\s+/).length < 3) {
    return Response.json({ specialists: [] });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ specialists: [] });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clowder.kapable.run",
        "X-Title": "Clowder Expert Prediction",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages: [
          { role: "system", content: PREDICTION_SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json({ specialists: [] });
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Extract JSON array from response (may have markdown fences)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return Response.json({ specialists: [] });
    }

    const parsed = JSON.parse(match[0]) as Array<[string, number, string]>;
    if (!Array.isArray(parsed)) {
      return Response.json({ specialists: [] });
    }

    // Validate and normalize
    const specialists = parsed
      .filter((entry) => Array.isArray(entry) && entry.length >= 3 && typeof entry[1] === "number")
      .map((entry) => ({
        domain: String(entry[0]).toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        confidence: Math.max(0, Math.min(1, entry[1])),
        reason: String(entry[2]).slice(0, 50),
      }))
      .filter((s) => s.confidence >= 0.3)
      .sort((a, b) => b.confidence - a.confidence);

    return Response.json({ specialists });
  } catch {
    return Response.json({ specialists: [] });
  }
}

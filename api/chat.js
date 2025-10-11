// api/chat.js  — Edge-compatible server function for Vercel
export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!process.env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY is not set" }, 500);
    }

    // Parse and validate input
    let payload = {};
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { messages } = payload || {};
    if (!Array.isArray(messages)) {
      return json({ error: "messages must be an array" }, 400);
    }

    // Call OpenAI (30s safety timeout)
    const controller = AbortSignal.timeout ? { signal: AbortSignal.timeout(30000) } : {};
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages
      }),
      ...controller
    });

    // If OpenAI returns an error, surface it clearly
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }

    if (!r.ok) {
      const detail = data?.error?.message || text || `Upstream HTTP ${r.status}`;
      return json({ error: `OpenAI error: ${detail}` }, 502);
    }

    // Success: return OpenAI JSON as-is
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    return json({ error: err?.message || "Unknown server error" }, 500);
  }
}

// Small helper to keep responses consistent
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}

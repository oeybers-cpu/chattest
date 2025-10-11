// api/chat.js  (Edge-compatible server function)
export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "content-type": "application/json" }
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set" }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }

  const { messages } = await req.json();
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ model: "gpt-4.1-mini", messages })
  });

  const data = await r.json();
  return new Response(JSON.stringify(data), {
    status: 200, headers: { "content-type": "application/json" }
  });
}

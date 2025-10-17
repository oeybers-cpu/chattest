export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: "messages" array not found.', { status: 400 });
    }

    const userMessage = messages[messages.length - 1]?.content || "";

    const payload = {
      input: { text: userMessage }
    };

    const stream = await fetch(`https://api.openai.com/v1/workflows/${process.env.WORKFLOW_ID}/invoke`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return new Response(stream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response("An internal server error occurred.", { status: 500 });
  }
}

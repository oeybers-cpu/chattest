export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { messages, mode = "workflow" } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Invalid request: "messages" array not found.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let response;

      try {
        if (mode === "workflow") {
          // Agent Builder workflow mode
          const payload = {
            input: { text: messages[messages.length - 1]?.content || "" }
          };

          response = await fetch(`https://api.openai.com/v1/workflows/${process.env.WORKFLOW_ID}/invoke`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

        } else {
          // Raw GPT-4o mode
          const payload = {
            model: "gpt-4o",
            messages: messages,
            stream: true,
          };

          response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        }

        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          const parsedLines = lines
            .map((line) => line.replace(/^data: /, "").trim())
            .filter((line) => line !== "" && line !== "[DONE]");

          for (const parsedLine of parsedLines) {
            try {
              if (!parsedLine.startsWith("{")) {
                console.warn("Skipping malformed chunk:", parsedLine);
                continue; // ✅ Skip malformed lines
              }
              const parsed = JSON.parse(parsedLine);
              const delta = parsed.choices?.[0]?.delta || parsed.output || parsed; // Handles both GPT and workflow formats
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
            } catch (error) {
              console.error("Could not JSON parse stream message", parsedLine, error);
            }
          }
        }

        controller.close();
      } catch (error) {
        console.error("Handler Error:", error);
        controller.enqueue(encoder.encode(`data: {"error":"Stream failed"}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

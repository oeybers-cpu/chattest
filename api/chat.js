// api/chat.js

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // CORRECTED: Default to 'raw' mode, which doesn't need a WORKFLOW_ID.
    const { messages, mode = "raw" } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: "messages" array not found.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    let response;

    // --- WORKFLOW MODE ---
    if (mode === "workflow") {
      // SAFETY CHECK: Ensure WORKFLOW_ID exists before trying to use it.
      if (!process.env.WORKFLOW_ID) {
        console.error("CRITICAL: Workflow mode was called, but WORKFLOW_ID is not set in Vercel environment variables.");
        return new Response(JSON.stringify({ error: "Server is not configured for workflow mode." }), {
          status: 500, // 500 because it's a server configuration error
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payload = {
        input: { text: messages[messages.length - 1]?.content || "" }
      };

      response = await fetch(`https://api.openai.com/v1/workflows/${process.env.WORKFLOW_ID}/invoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload ),
      });

    // --- RAW GPT-4o MODE ---
    } else {
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
        body: JSON.stringify(payload ),
      });
    }

    // Universal error handling for either fetch call
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API Error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `API request failed with status ${response.status}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Universal streaming logic
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.replace('data: ', '').trim();
              if (jsonStr === "" || jsonStr === "[DONE]") continue;
              
              try {
                const parsed = JSON.parse(jsonStr);
                // In raw mode, the content is in choices[0].delta.content
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  // Re-encode the content into the stream format the frontend expects
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                }
              } catch (error) {
                console.error("Could not JSON parse stream message:", jsonStr, error);
              }
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no', // Important for Vercel
      },
    });

  } catch (error) {
    console.error("Handler Error:", error);
    return new Response(JSON.stringify({ error: "A critical internal server error occurred." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

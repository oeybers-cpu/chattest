export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { messages, mode = "workflow" } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: "messages" array not found.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    
    let response;
    if (mode === "workflow") {
      // Agent Builder workflow mode
      const payload = {
        input: { 
          text: messages[messages.length - 1]?.content || "",
          // Include conversation history if needed by your workflow
          messages: messages
        }
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
        max_tokens: 1000,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `API request failed: ${response.status}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              const cleanedLine = line.replace(/^data: /, "").trim();
              
              if (cleanedLine === "" || cleanedLine === "[DONE]") continue;
              
              if (!cleanedLine.startsWith("{")) {
                console.warn("Skipping malformed chunk:", cleanedLine);
                continue;
              }

              try {
                const parsed = JSON.parse(cleanedLine);
                
                // Handle different response formats
                let content = "";
                
                if (mode === "workflow") {
                  // Workflow format - adjust based on your actual workflow output structure
                  content = parsed.output?.text || 
                           parsed.output?.choices?.[0]?.message?.content ||
                           parsed.output?.message?.content ||
                           parsed.output?.content ||
                           parsed.output ||
                           "";
                } else {
                  // Raw GPT format
                  content = parsed.choices?.[0]?.delta?.content || "";
                }

                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch (error) {
                console.error("Could not JSON parse stream message", cleanedLine, error);
              }
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Stream Error:", error);
          controller.enqueue(encoder.encode(`data: {"error":"Stream processing failed"}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Accel-Buffering': 'no', // Important for Vercel/Nginx
      },
    });

  } catch (error) {
    console.error("Handler Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

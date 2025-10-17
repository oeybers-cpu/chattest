// api/chat.js

// Use the Edge runtime for optimal streaming performance
export const config = {
  runtime: "edge",
};

// The main API handler function
export default async function handler(req) {
  // 1. Check for POST request
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // 2. Get the user's messages from the request body
    const { messages } = await req.json();

    if (!messages) {
      return new Response('Invalid request: "messages" array not found.', { status: 400 });
    }

    // *** MODIFICATION 1: Add a System Prompt for better control (recommended) ***
    const systemMessage = {
      role: "system",
      content: "You are a helpful and harmless AI assistant. Your responses should be clear, truthful, and relevant to the user's query.",
    };
    
    // Combine the system message with the user's history
    const fullMessages = [systemMessage, ...messages];


    // 3. Prepare the request payload for OpenAI
    const payload = {
      // *** MODIFICATION 2: Changed model to a placeholder for GPT-5 ***
      model: "gpt-5-turbo", // Placeholder for the future GPT-5 model name
      messages: fullMessages,
      stream: true, // THIS IS THE KEY CHANGE TO ENABLE STREAMING
    };

    // 4. Call the OpenAI API and get a streaming response
    const stream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ),
    });

    // 5. Pipe the streaming response directly back to our client
    // The Vercel Edge runtime automatically handles this efficiently.
    return new Response(stream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream', // Important: Set the content type for streaming
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*', // Adjust CORS as needed
      },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response("An internal server error occurred.", { status: 500 });
  }
}

// For faster responses, run this on Vercel's Edge Network
export const config = {
  runtime: "edge",
};

// The main API handler function
export default async function handler(req) {
  // 1. Check for POST request
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2. Get the user's messages from the request body
    const { messages } = await req.json();

    // Validate that messages exist and is an array
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: "messages" array not found.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Prepare the request to OpenAI Agent Builder workflow
    const payload = {
      input: { text: messages[messages.length - 1]?.content || "" }
    };

    // 4. Call the OpenAI workflow endpoint
    const response = await fetch(`https://api.openai.com/v1/workflows/${process.env.WORKFLOW_ID}/invoke`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Check for errors from OpenAI
    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      return new Response(JSON.stringify({ error: 'Failed to get response from OpenAI.', details: errorData }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Send the successful response back to your frontend
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

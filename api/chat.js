// For faster responses, run this on Vercel's Edge Network
export const config = {
  runtime: "edge",
};

// The main API handler function
export default async function handler(req) {
  // --- START OF DIAGNOSTIC CODE ---
  const apiKey = process.env.OPENAI_API_KEY;
  let apiKeyStatus;

  if (!apiKey) {
    apiKeyStatus = "API Key is NOT FOUND in environment variables.";
  } else {
    // Log the first 5 and last 4 characters to verify the key without exposing it.
    apiKeyStatus = `API Key Found. Starts with: ${apiKey.substring(0, 5)}, Ends with: ${apiKey.slice(-4)}`;
  }
  
  // Log this status to Vercel's logs.
  console.log(apiKeyStatus);
  // --- END OF DIAGNOSTIC CODE ---

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: "messages" array not found.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if the key exists (again, for safety)
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error: API Key not found.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const payload = {
      model: "gpt-4o",
      messages: messages,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`, // Use the variable we defined
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      // Also log our API key status here for context on the error
      console.log(`Error occurred with key: ${apiKeyStatus}`);
      return new Response(JSON.stringify({ error: 'Failed to get response from OpenAI.', details: errorData }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

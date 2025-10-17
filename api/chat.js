// Filename: /api/chat.js
// This version is configured for "block text" (non-streaming) responses.

import { OpenAI } from 'openai';

// --- Configuration ---
const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are ALLChat, an expert academic literacy advisor. Your purpose is to help students understand and develop skills in academic literacy. Your communication style must be clear, engaging, and fluid. Write in complete, well-structured sentences.`
};

// --- Vercel Edge Function Config ---
export const config = {
  runtime: "edge",
};

// --- Main Request Handler ---
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Validate that the OpenAI API key exists.
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Server configuration error: OPENAI_API_KEY is missing.');
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: "messages" array not found.', { status: 400 });
    }

    // --- Direct OpenAI Chat (Non-Streaming) ---
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Ask OpenAI for a standard, non-streaming chat completion.
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      // ** CHANGE: `stream: true` has been removed. **
      messages: [SYSTEM_PROMPT, ...messages],
    });

    // Extract the content from the first choice in the response.
    const aiResponseContent = response.choices[0].message.content;

    // ** CHANGE: Return a standard JSON response instead of a stream. **
    return new Response(
      JSON.stringify({ response: aiResponseContent }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error("Critical Error in /api/chat handler:", error.message);
    return new Response(
      JSON.stringify({ error: "An internal server error occurred." }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

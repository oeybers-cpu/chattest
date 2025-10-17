// Filename: /api/chat.js

import { OpenAI } from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Tell Vercel to run this as an Edge Function
export const config = {
  runtime: "edge",
};

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// The main function that handles incoming requests
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { messages } = await req.json();

    if (!messages) {
      return new Response('Invalid request: "messages" array not found.', { status: 400 });
    }

    // Define the AI's persona and instructions
    const systemPrompt = {
        role: 'system',
        content: "You are an expert academic advisor. Your purpose is to help students understand and develop skills in academic literacy. Provide clear, well-structured, and concise explanations. Define key terms and use examples. Your tone should be encouraging and educational."
    };

    // Ask OpenAI for a streaming chat completion
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Or "gpt-4-turbo"
      stream: true,
      messages: [systemPrompt, ...messages], // Combine the system prompt with the user's messages
    });

    // Use the Vercel AI SDK to convert the response into a clean, readable stream
    const stream = OpenAIStream(response);

    // Return the stream directly to the frontend. The SDK handles all the complex parts.
    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error("Error in /api/chat handler:", error);
    return new Response("An internal server error occurred.", { status: 500 });
  }
}

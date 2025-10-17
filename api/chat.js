// Filename: /api/chat.js

import { OpenAI } from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// --- Configuration ---
const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are ALLChat, an expert academic literacy advisor. Your purpose is to help students understand and develop skills in academic literacy.`
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

    // Check if the workflow mode should be used.
    const shouldUseWorkflow = process.env.USE_WORKFLOW === 'true' && process.env.WORKFLOW_ID;

    if (shouldUseWorkflow) {
      // If workflow mode is enabled, try it first.
      return await handleWorkflowResponse(messages);
    } else {
      // Otherwise, go directly to the standard OpenAI chat.
      return await handleDirectOpenAI(messages);
    }

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

// --- Workflow Handling Function ---
async function handleWorkflowResponse(messages) {
  try {
    // **FIX APPLIED HERE**: Dynamically import the module *inside* the function.
    const { invokeWorkflow } = await import('@openai/agents');

    const latestMessage = messages[messages.length - 1]?.content || "";
    if (!latestMessage) {
      throw new Error('No user message found for workflow.');
    }

    const result = await invokeWorkflow({
      workflow_id: process.env.WORKFLOW_ID,
      input: { text: latestMessage },
    });

    const workflowResponse = result.output?.response || 'Workflow completed, but no text was returned.';

    // The workflow API does not stream, so we return a single JSON response.
    return new Response(JSON.stringify({ response: workflowResponse }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (workflowError) {
    console.warn('Workflow execution failed, falling back to direct API. Error:', workflowError.message);
    // If the workflow fails for any reason, fall back to the reliable direct method.
    return await handleDirectOpenAI(messages);
  }
}

// --- Direct OpenAI Chat Handling Function ---
async function handleDirectOpenAI(messages) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      stream: true,
      messages: [SYSTEM_PROMPT, ...messages],
    });

    // Use the Vercel AI SDK to handle the stream correctly.
    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);

  } catch (openaiError) {
    console.error('Direct OpenAI API call failed:', openaiError.message);
    // This is a critical failure, so we throw an error to be caught by the main handler.
    throw new Error('Failed to get response from OpenAI.');
  }
}

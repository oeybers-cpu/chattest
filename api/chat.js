// Filename: /api/chat.js

import { OpenAI } from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Only import workflow if we're using it
let workflowModule = null;
if (process.env.USE_WORKFLOW === 'true') {
  try {
    workflowModule = await import('@openai/agents');
  } catch (error) {
    console.warn('Workflow module not available, falling back to direct API');
  }
}

export const config = {
  runtime: "edge",
};

// Validate required environment variables
function validateEnv() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  if (process.env.USE_WORKFLOW === 'true' && !process.env.WORKFLOW_ID) {
    console.warn('USE_WORKFLOW is true but WORKFLOW_ID is not set. Falling back to direct API.');
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are ALLChat, an expert academic literacy advisor. Your purpose is to help students understand and develop skills in academic literacy.`
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Validate environment
    validateEnv();
    
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: "messages" array not found.', { status: 400 });
    }

    // Determine which method to use
    const useWorkflow = process.env.USE_WORKFLOW === 'true' && 
                       process.env.WORKFLOW_ID && 
                       workflowModule;

    if (useWorkflow) {
      return await handleWorkflowResponse(messages);
    } else {
      return await handleDirectOpenAI(messages);
    }

  } catch (error) {
    console.error("Error in /api/chat handler:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Service temporarily unavailable. Please try again later." 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleWorkflowResponse(messages) {
  try {
    const latestMessage = messages[messages.length - 1];
    const userInput = latestMessage?.content;

    if (!userInput) {
      throw new Error('No user message found');
    }

    const result = await workflowModule.invokeWorkflow({
      workflow_id: process.env.WORKFLOW_ID,
      input: { text: userInput },
      api_key: process.env.OPENAI_API_KEY,
    });

    const workflowResponse = result.output?.response || 
                           result.output?.text || 
                           result.text || 
                           'No response from workflow';

    return new Response(
      JSON.stringify({ 
        response: workflowResponse,
        source: 'workflow'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (workflowError) {
    console.error('Workflow execution failed:', workflowError);
    return await handleDirectOpenAI(messages);
  }
}

async function handleDirectOpenAI(messages) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      stream: true,
      messages: [SYSTEM_PROMPT, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);

  } catch (openaiError) {
    console.error('OpenAI API error:', openaiError);
    throw new Error('Failed to get AI response');
  }
}

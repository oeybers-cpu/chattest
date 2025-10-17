// Filename: /api/chat.js

import { OpenAI } from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { invokeWorkflow } from "@openai/agents";

export const config = {
  runtime: "edge",
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced system prompt for academic literacy
const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are ALLChat, an expert academic literacy advisor. Your purpose is to help students understand and develop skills in academic literacy.

Key Responsibilities:
- Provide clear, well-structured, and concise explanations
- Define key academic terms and concepts
- Use relevant examples from various disciplines
- Break down complex ideas into manageable parts
- Encourage critical thinking and academic curiosity

Response Guidelines:
- Structure responses with clear headings and bullet points when helpful
- Use examples to illustrate concepts
- Define specialized terminology
- Maintain an encouraging, educational tone
- Acknowledge when concepts are complex and offer to elaborate
- Suggest related topics or next steps for learning

Formatting:
- Use markdown for clear structure
- Use headings for main sections
- Use bullet points for lists
- Use bold for key terms
- Use code blocks for technical examples

Remember: You're helping students build confidence in academic reading, writing, and thinking.`
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: "messages" array not found.', { status: 400 });
    }

    // Configuration - choose between workflow and direct API
    const USE_WORKFLOW = process.env.USE_WORKFLOW === 'true';
    const WORKFLOW_ID = process.env.WORKFLOW_ID;

    if (USE_WORKFLOW && WORKFLOW_ID) {
      return await handleWorkflowResponse(messages);
    } else {
      return await handleDirectOpenAI(messages);
    }

  } catch (error) {
    console.error("Error in /api/chat handler:", error);
    
    // Provide a more user-friendly error message
    const errorMessage = error.message.includes('API key') 
      ? "Service configuration error. Please check API settings."
      : "Sorry, I'm having trouble responding right now. Please try again.";
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle workflow-based responses
async function handleWorkflowResponse(messages) {
  try {
    const latestMessage = messages[messages.length - 1];
    
    if (!latestMessage || latestMessage.role !== 'user') {
      throw new Error('No user message found');
    }

    const userInput = latestMessage.content;
    
    // Prepare context for the workflow
    const conversationContext = messages
      .slice(-6) // Last 6 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const result = await invokeWorkflow({
      workflow_id: process.env.WORKFLOW_ID,
      input: { 
        text: userInput,
        context: conversationContext,
        timestamp: new Date().toISOString()
      },
      api_key: process.env.OPENAI_API_KEY,
    });

    // Extract response from workflow result
    // Adjust this based on your workflow's output structure
    const workflowResponse = result.output?.answer || 
                           result.output?.response || 
                           result.text || 
                           result.output?.text ||
                           (typeof result === 'string' ? result : JSON.stringify(result));

    if (!workflowResponse) {
      throw new Error('No response from workflow');
    }

    // Create a proper streaming response
    const stream = createSimulatedStream(workflowResponse);
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (workflowError) {
    console.error('Workflow execution failed:', workflowError);
    // Fall back to direct OpenAI
    return await handleDirectOpenAI(messages);
  }
}

// Handle direct OpenAI API calls
async function handleDirectOpenAI(messages) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      stream: true,
      messages: [SYSTEM_PROMPT, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 0.9,
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);

  } catch (openaiError) {
    console.error('OpenAI API error:', openaiError);
    throw new Error(`OpenAI service error: ${openaiError.message}`);
  }
}

// Create a simulated stream for workflow responses
function createSimulatedStream(text) {
  const encoder = new TextEncoder();
  const chunks = text.match(/.{1,30}/g) || [text]; // Split into ~30 char chunks
  
  return new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const data = {
            id: `chatcmpl-workflow-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'workflow',
            choices: [
              {
                index: 0,
                delta: { content: chunk },
                finish_reason: i === chunks.length - 1 ? 'stop' : null,
              },
            ],
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          
          // Simulate natural typing speed (20-60ms between chunks)
          await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 40));
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

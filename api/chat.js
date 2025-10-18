import { OpenAI } from 'openai';
import { invokeWorkflow } from '@openai/agents';
import { OpenAIStream, StreamingTextResponse } from 'ai';

export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages, mode = 'workflow' } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: "messages" array not found.', {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'workflow') {
      // Agent Builder workflow mode
      const inputText = messages[messages.length - 1]?.content || '';
      const result = await invokeWorkflow({
        workflow_id: process.env.WORKFLOW_ID,
        input: { text: inputText },
        api_key: process.env.OPENAI_API_KEY,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // Raw GPT-4o streaming mode
      const systemPrompt = {
        role: 'system',
        content:
          'You are an expert academic advisor. Your purpose is to help students understand and develop skills in academic literacy. Provide clear, well-structured, and concise explanations. Define key terms and use examples. Your tone should be encouraging and educational.',
      };

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        stream: true,
        messages: [systemPrompt, ...messages],
      });

      const stream = OpenAIStream(response);
      return new StreamingTextResponse(stream);
    }
  } catch (error) {
    console.error('Error in /api/chat handler:', error);
    return new Response('An internal server error occurred.', { status: 500 });
  }
}

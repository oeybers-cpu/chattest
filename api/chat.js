import { runWorkflow } from '../sdk/runWorkflow';
import { OpenAI } from 'openai';
import { invokeWorkflow } from '@openai/agents';
import { MySDK } from 'my-sdk'; // Replace with actual SDK import

export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Optional: initialize SDK if needed
const sdk = new MySDK({
  apiKey: process.env.MY_SDK_KEY, // Add to .env and Vercel
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
      // Agent Builder workflow mode with SDK preprocessing
      const inputText = messages[messages.length - 1]?.content || '';
      const enrichedInput = sdk.preprocess(inputText);

      const result = await invokeWorkflow({
        workflow_id: process.env.WORKFLOW_ID,
        input: { text: enrichedInput },
        api_key: process.env.OPENAI_API_KEY,
      });

      const finalOutput = sdk.postprocess(result);

      return new Response(JSON.stringify(finalOutput), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // GPT-4o non-streaming mode with SDK formatting
      const systemPrompt = {
        role: 'system',
        content:
          'You are an expert academic advisor. Your purpose is to help students understand and develop skills in academic literacy. Provide clear, well-structured, and concise explanations. Define key terms and use examples. Your tone should be encouraging and educational.',
      };

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        stream: false,
        max_tokens: 1024,
        messages: [systemPrompt, ...messages.slice(-3)],
      });

      let rawContent = '[No response received from GPT-4o.]';

      if (
        response?.choices &&
        Array.isArray(response.choices) &&
        response.choices[0]?.message?.content
      ) {
        rawContent = response.choices[0].message.content;
      } else {
        console.warn(
          'GPT-4o returned unexpected structure:',
          JSON.stringify(response, null, 2)
        );
      }

      const aiResponseContent = sdk.format(rawContent);

      return new Response(JSON.stringify({ response: aiResponseContent }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in /api/chat handler:', error);
    return new Response('An internal server error occurred.', { status: 500 });
  }
}

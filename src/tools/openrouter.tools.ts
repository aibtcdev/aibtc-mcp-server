import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createJsonResponse } from "../utils/index.js";

export function registerOpenRouterTools(server: McpServer): void {
  server.registerTool(
    "openrouter_integration_guide",
    {
      description: `Get OpenRouter integration examples and code patterns for implementing AI features.

Use this tool when you need to add AI capabilities to any project. Returns:
- Code examples for different environments (Node.js, Cloudflare Workers, browser)
- API patterns and best practices
- Model recommendations
- Error handling patterns

This is a reference tool - use the returned code as a template for implementation.`,
      inputSchema: z.object({
        environment: z
          .enum(["nodejs", "cloudflare-worker", "browser", "all"])
          .optional()
          .default("all")
          .describe("Target environment for the integration"),
        feature: z
          .enum(["chat", "completion", "streaming", "function-calling", "all"])
          .optional()
          .default("all")
          .describe("Specific AI feature to implement"),
      }),
    },
    async ({ environment, feature }) => {
      const guides: Record<string, string> = {};

      // Base API info
      guides.apiOverview = `
# OpenRouter API Overview

Base URL: https://openrouter.ai/api/v1
Auth: Bearer token in Authorization header
API Key: Get from https://openrouter.ai/keys

## Request Format
POST /chat/completions
{
  "model": "anthropic/claude-3-haiku",
  "messages": [
    { "role": "system", "content": "You are helpful" },
    { "role": "user", "content": "Hello" }
  ],
  "max_tokens": 1024,
  "temperature": 0.7
}

## Required Headers
- Authorization: Bearer YOUR_API_KEY
- Content-Type: application/json
- HTTP-Referer: your-site.com (for rankings)
- X-Title: Your App Name (for rankings)
`;

      guides.popularModels = `
# Popular Models

## Fast & Affordable
- anthropic/claude-3.5-haiku - Fast, cheap, 200K context
- openai/gpt-4o-mini - Very fast, 128K context
- meta-llama/llama-3.3-70b-instruct - Great value, 131K context
- google/gemini-2.5-flash - 1M context, very cheap
- mistralai/mistral-nemo - Ultra cheap, 131K context

## High Quality (Frontier)
- anthropic/claude-sonnet-4.5 - Best overall, 1M context
- anthropic/claude-opus-4.5 - Most capable, 200K context
- openai/gpt-4.1 - 1M context, multimodal
- openai/gpt-4o - Solid all-rounder, 128K context
- google/gemini-2.5-pro - 1M context, great reasoning
- x-ai/grok-4 - xAI flagship, 256K context

## Code & Reasoning
- deepseek/deepseek-r1 - Excellent reasoning, 163K context
- deepseek/deepseek-v3.2 - Fast coding, very cheap
- mistralai/mistral-large-2411 - Strong coder, 131K context

## Long Context
- x-ai/grok-4.1-fast - 2M context (!), very cheap
- google/gemini-2.5-pro - 1M context
- anthropic/claude-sonnet-4.5 - 1M context

## Open Source
- meta-llama/llama-3.1-405b-instruct - Largest open model
- meta-llama/llama-3.3-70b-instruct - Best open value
- qwen/qwen3-235b - Strong multilingual
`;

      // Environment-specific examples
      if (environment === "nodejs" || environment === "all") {
        guides.nodejs = `
# Node.js Integration

## Basic Implementation

\`\`\`typescript
// openrouter.ts
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function chat(
  messages: ChatMessage[],
  model = 'anthropic/claude-3-haiku',
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<OpenRouterResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://your-site.com',
      'X-Title': 'Your App',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`OpenRouter error: \${response.status} - \${error}\`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

// Usage
const result = await chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain quantum computing' },
]);
console.log(result.content);
\`\`\`

## With Axios

\`\`\`typescript
import axios from 'axios';

const openrouter = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Authorization': \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
    'HTTP-Referer': 'https://your-site.com',
    'X-Title': 'Your App',
  },
});

export async function chat(messages: ChatMessage[], model = 'anthropic/claude-3-haiku') {
  const { data } = await openrouter.post('/chat/completions', {
    model,
    messages,
    max_tokens: 1024,
  });
  return data.choices[0]?.message?.content || '';
}
\`\`\`
`;
      }

      if (environment === "cloudflare-worker" || environment === "all") {
        guides.cloudflareWorker = `
# Cloudflare Worker Integration

## With Hono.js

\`\`\`typescript
// src/index.ts
import { Hono } from 'hono';

type Bindings = {
  OPENROUTER_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/api/chat', async (c) => {
  const { messages, model = 'anthropic/claude-3-haiku' } = await c.req.json();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${c.env.OPENROUTER_API_KEY}\`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://your-worker.workers.dev',
      'X-Title': 'My Worker',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    return c.json({ error: 'AI request failed' }, 500);
  }

  const data = await response.json();
  return c.json({
    content: data.choices[0]?.message?.content,
    model: data.model,
  });
});

export default app;
\`\`\`

## wrangler.jsonc

\`\`\`json
{
  "name": "my-ai-worker",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"]
}
\`\`\`

## Set API Key as Secret

\`\`\`bash
wrangler secret put OPENROUTER_API_KEY
\`\`\`
`;
      }

      if (environment === "browser" || environment === "all") {
        guides.browser = `
# Browser Integration

⚠️ IMPORTANT: Never expose API keys in browser code!
Use a backend proxy to keep your key secure.

## Backend Proxy Pattern

\`\`\`typescript
// Backend (Express/Hono/etc)
app.post('/api/ai/chat', async (req, res) => {
  const { messages, model } = req.body;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: 1024 }),
  });

  const data = await response.json();
  res.json({ content: data.choices[0]?.message?.content });
});

// Frontend
async function chat(message: string) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: message }],
    }),
  });
  return response.json();
}
\`\`\`
`;
      }

      // Feature-specific examples
      if (feature === "streaming" || feature === "all") {
        guides.streaming = `
# Streaming Responses

## Server-Sent Events Pattern

\`\`\`typescript
// Request with streaming
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'anthropic/claude-3-haiku',
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true,  // Enable streaming
  }),
});

// Process stream
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\\n').filter(line => line.startsWith('data: '));

  for (const line of lines) {
    const data = line.slice(6); // Remove 'data: '
    if (data === '[DONE]') continue;

    const parsed = JSON.parse(data);
    const content = parsed.choices[0]?.delta?.content || '';
    process.stdout.write(content); // Stream to output
  }
}
\`\`\`

## Hono Streaming Response

\`\`\`typescript
import { stream } from 'hono/streaming';

app.post('/api/chat/stream', async (c) => {
  const { messages } = await c.req.json();

  return stream(c, async (stream) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${c.env.OPENROUTER_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader?.read() || { done: true };
      if (done) break;
      await stream.write(decoder.decode(value));
    }
  });
});
\`\`\`
`;
      }

      if (feature === "function-calling" || feature === "all") {
        guides.functionCalling = `
# Function Calling (Tool Use)

Some models support function calling for structured outputs.

\`\`\`typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',  // Supports function calling
    messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather in a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        },
      },
    ],
    tool_choice: 'auto',
  }),
});

const data = await response.json();
const toolCall = data.choices[0]?.message?.tool_calls?.[0];

if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  // Call your actual function: getWeather(args.location, args.unit)
}
\`\`\`

## Models with Function Calling Support
- openai/gpt-4o, gpt-4-turbo
- anthropic/claude-3.5-sonnet, claude-3-opus
- mistralai/mistral-large
`;
      }

      guides.errorHandling = `
# Error Handling

\`\`\`typescript
async function safeChat(messages: ChatMessage[], model: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: 1024 }),
    });

    if (response.status === 401) {
      throw new Error('Invalid API key');
    }
    if (response.status === 429) {
      throw new Error('Rate limited - try again later');
    }
    if (response.status === 402) {
      throw new Error('Insufficient credits');
    }
    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`API error: \${response.status} - \${error}\`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenRouter error:', error);
    throw error;
  }
}
\`\`\`

## Common Error Codes
- 401: Invalid API key
- 402: Out of credits
- 429: Rate limited
- 500: Server error (retry)
- 503: Model overloaded (retry with backoff)
`;

      guides.bestPractices = `
# Best Practices

1. **Store API key securely**
   - Use environment variables
   - Never commit to git
   - Use secrets manager in production

2. **Set reasonable max_tokens**
   - Don't set higher than needed
   - Affects cost and latency

3. **Use appropriate temperature**
   - 0.0-0.3: Factual, deterministic
   - 0.5-0.7: Balanced (default)
   - 0.8-1.0: Creative, varied

4. **Handle rate limits**
   - Implement exponential backoff
   - Cache responses when possible

5. **Choose the right model**
   - Start with claude-3-haiku or gpt-4o-mini
   - Upgrade only if quality insufficient
`;

      return createJsonResponse({
        environment,
        feature,
        guides,
        tip: "Use these code examples as templates. Replace placeholders with your actual values.",
      });
    }
  );

  // List available models
  server.registerTool(
    "openrouter_models",
    {
      description: `Get list of popular OpenRouter models with capabilities and context lengths.

Use this to choose the right model for your use case. For latest pricing, check openrouter.ai/models`,
      inputSchema: z.object({
        category: z
          .enum(["fast", "quality", "cheap", "code", "long-context", "all"])
          .optional()
          .default("all")
          .describe("Filter by model category"),
      }),
    },
    async ({ category }) => {
      const allModels = [
        // Anthropic
        {
          id: "anthropic/claude-3.5-haiku",
          name: "Claude 3.5 Haiku",
          category: ["fast", "cheap"],
          contextLength: 200000,
          bestFor: "Fast responses, simple tasks, cost-effective",
        },
        {
          id: "anthropic/claude-sonnet-4.5",
          name: "Claude Sonnet 4.5",
          category: ["quality", "long-context"],
          contextLength: 1000000,
          bestFor: "Best overall, complex reasoning, coding",
        },
        {
          id: "anthropic/claude-opus-4.5",
          name: "Claude Opus 4.5",
          category: ["quality"],
          contextLength: 200000,
          bestFor: "Most capable, research, difficult tasks",
        },
        // OpenAI
        {
          id: "openai/gpt-4o",
          name: "GPT-4o",
          category: ["quality"],
          contextLength: 128000,
          bestFor: "General purpose, multimodal, function calling",
        },
        {
          id: "openai/gpt-4o-mini",
          name: "GPT-4o Mini",
          category: ["fast", "cheap"],
          contextLength: 128000,
          bestFor: "Fast, cheap, good for simple tasks",
        },
        {
          id: "openai/gpt-4.1",
          name: "GPT-4.1",
          category: ["quality", "long-context"],
          contextLength: 1040000,
          bestFor: "Long context, multimodal, latest OpenAI",
        },
        // Meta Llama
        {
          id: "meta-llama/llama-3.3-70b-instruct",
          name: "Llama 3.3 70B",
          category: ["quality", "cheap"],
          contextLength: 131072,
          bestFor: "Best open source value, great quality",
        },
        {
          id: "meta-llama/llama-3.1-405b-instruct",
          name: "Llama 3.1 405B",
          category: ["quality"],
          contextLength: 131072,
          bestFor: "Largest open model, frontier performance",
        },
        {
          id: "meta-llama/llama-3.1-8b-instruct",
          name: "Llama 3.1 8B",
          category: ["fast", "cheap"],
          contextLength: 16384,
          bestFor: "Ultra cheap, fast, simple tasks",
        },
        // Google
        {
          id: "google/gemini-2.5-pro",
          name: "Gemini 2.5 Pro",
          category: ["quality", "long-context"],
          contextLength: 1000000,
          bestFor: "1M context, great reasoning, multimodal",
        },
        {
          id: "google/gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          category: ["fast", "cheap", "long-context"],
          contextLength: 1000000,
          bestFor: "Fast, 1M context, affordable",
        },
        // xAI Grok
        {
          id: "x-ai/grok-4",
          name: "Grok 4",
          category: ["quality"],
          contextLength: 256000,
          bestFor: "xAI flagship, real-time knowledge",
        },
        {
          id: "x-ai/grok-4.1-fast",
          name: "Grok 4.1 Fast",
          category: ["fast", "long-context"],
          contextLength: 2000000,
          bestFor: "2M context (!), very fast",
        },
        {
          id: "x-ai/grok-3",
          name: "Grok 3",
          category: ["quality"],
          contextLength: 131072,
          bestFor: "Strong reasoning, real-time data",
        },
        // Mistral
        {
          id: "mistralai/mistral-large-2411",
          name: "Mistral Large",
          category: ["quality", "code"],
          contextLength: 131072,
          bestFor: "Coding, reasoning, multilingual",
        },
        {
          id: "mistralai/mistral-nemo",
          name: "Mistral Nemo",
          category: ["fast", "cheap"],
          contextLength: 131072,
          bestFor: "Ultra cheap, 131K context",
        },
        // DeepSeek
        {
          id: "deepseek/deepseek-r1",
          name: "DeepSeek R1",
          category: ["quality", "code"],
          contextLength: 163000,
          bestFor: "Excellent reasoning, chain-of-thought",
        },
        {
          id: "deepseek/deepseek-v3.2",
          name: "DeepSeek V3.2",
          category: ["code", "cheap"],
          contextLength: 163000,
          bestFor: "Fast coding, affordable",
        },
        // Qwen
        {
          id: "qwen/qwen3-235b",
          name: "Qwen3 235B",
          category: ["quality"],
          contextLength: 40000,
          bestFor: "Strong multilingual, great value",
        },
      ];

      let models = allModels;
      if (category && category !== "all") {
        models = allModels.filter((m) => m.category.includes(category));
      }

      return createJsonResponse({
        category,
        count: models.length,
        models,
        recommendation:
          category === "all"
            ? "Start with claude-3.5-haiku or gpt-4o-mini for most tasks. Use claude-sonnet-4.5 or deepseek-r1 for complex reasoning."
            : undefined,
      });
    }
  );
}

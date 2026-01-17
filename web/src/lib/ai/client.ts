import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: 20, // Conservative limit
  tokensPerMinute: 40000, // Conservative token limit
};

// Track rate limiting state
const rateLimitState = {
  requests: [] as number[],
  tokens: 0,
  lastReset: Date.now(),
};

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }

    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

/**
 * Check if we can make a request within rate limits
 * Returns wait time in ms if we need to wait, 0 if we can proceed
 */
function checkRateLimit(estimatedTokens: number): number {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Reset token count every minute
  if (now - rateLimitState.lastReset > 60000) {
    rateLimitState.tokens = 0;
    rateLimitState.lastReset = now;
  }

  // Remove old requests from tracking
  rateLimitState.requests = rateLimitState.requests.filter(t => t > oneMinuteAgo);

  // Check request limit
  if (rateLimitState.requests.length >= RATE_LIMIT.requestsPerMinute) {
    const oldestRequest = rateLimitState.requests[0];
    return oldestRequest + 60000 - now;
  }

  // Check token limit
  if (rateLimitState.tokens + estimatedTokens > RATE_LIMIT.tokensPerMinute) {
    return rateLimitState.lastReset + 60000 - now;
  }

  return 0;
}

function recordRequest(tokens: number): void {
  rateLimitState.requests.push(Date.now());
  rateLimitState.tokens += tokens;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Estimate token count for a string (rough approximation)
 * ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks that fit within token limit
 */
export function chunkText(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  const chunks: string[] = [];

  // Split by sentences/paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length < maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If single paragraph is too long, split by sentences
      if (para.length >= maxChars) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length < maxChars) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Make a rate-limited chat completion request
 */
export async function createChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const client = getOpenAIClient();

  // Estimate input tokens
  const inputTokens = messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content : '';
    return sum + estimateTokens(content);
  }, 0);

  const estimatedTotalTokens = inputTokens + (options.maxTokens || 1000);

  // Wait if rate limited
  const waitTime = checkRateLimit(estimatedTotalTokens);
  if (waitTime > 0) {
    console.log(`Rate limited, waiting ${waitTime}ms...`);
    await sleep(waitTime);
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o', // Default model, will use latest available
    messages,
    max_tokens: options.maxTokens || 1000,
    temperature: options.temperature ?? 0.7,
  });

  // Record actual token usage
  const totalTokens = response.usage?.total_tokens || estimatedTotalTokens;
  recordRequest(totalTokens);

  return response.choices[0]?.message?.content || '';
}

/**
 * Create embeddings for text (for de-duplication)
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  // Estimate tokens and check rate limit
  const estimatedTokens = estimateTokens(text);
  const waitTime = checkRateLimit(estimatedTokens);
  if (waitTime > 0) {
    await sleep(waitTime);
  }

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  recordRequest(estimatedTokens);

  return response.data[0].embedding;
}

/**
 * Create embeddings for multiple texts in batch
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();

  // Estimate tokens and check rate limit
  const estimatedTokens = texts.reduce((sum, t) => sum + estimateTokens(t), 0);
  const waitTime = checkRateLimit(estimatedTokens);
  if (waitTime > 0) {
    await sleep(waitTime);
  }

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  recordRequest(estimatedTokens);

  return response.data.map(d => d.embedding);
}

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const { Groq } = require("groq-sdk");
const logger = require('../utils/loggerUtil');
const MemoryCache = require("../utils/cacheUtil");

// Create a dedicated cache for AI responses with a 24-hour TTL (in milliseconds)
const aiResponseCache = new MemoryCache(24 * 60 * 60 * 1000);

// Initialize AI service clients
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Makes an optimized call to Google's Generative AI with caching and error handling
 * @param {string} prompt - The prompt to send to the AI service
 * @param {Object} options - Configuration options
 * @param {string} options.model - Model to use (default: "gemini-1.5-pro")
 * @param {boolean} options.forceRefresh - Force a fresh response ignoring cache
 * @param {number} options.cacheTtl - Custom cache TTL in milliseconds
 * @returns {Promise<string>} - The AI response text
 */
const getGeminiResponse = async (prompt, options = {}) => {
  const {
    model = "gemini-1.5-pro",
    forceRefresh = false,
    cacheTtl = 24 * 60 * 60 * 1000, // Default 24 hours
  } = options;

  // Create a cache key based on the prompt and model
  const cacheKey = `gemini-${model}-${prompt.substring(0, 100)}`;

  // Check cache first unless forceRefresh is true
  if (!forceRefresh) {
    const cachedResponse = aiResponseCache.get(cacheKey);
    if (cachedResponse) {
      logger.debug('Using cached Gemini response', { prompt: prompt.substring(0, 50) + '...' });
      return cachedResponse;
    }
  }

  try {
    // Make the actual API call to Gemini
    const genModel = genAI.getGenerativeModel(
      { model: model },
      { apiVersion: "v1beta" }
    );

    const result = await genModel.generateContent([prompt]);
    const responseText = result.response.text().trim();

    // Cache the successful response
    aiResponseCache.set(cacheKey, responseText, cacheTtl);

    return responseText;
  } catch (error) {
    logger.error('Gemini service call failed', {
      error: error.message,
      prompt: prompt.substring(0, 100) + '...'
    });

    // Try to get a cached response as fallback, even if it's expired
    const cachedResponse = aiResponseCache.get(cacheKey, true);
    if (cachedResponse) {
      logger.warn('Using expired cached response as fallback', {
        prompt: prompt.substring(0, 50) + '...'
      });
      return cachedResponse;
    }

    // If no cached response is available, throw the error
    throw error;
  }
};

/**
 * Makes an optimized call to OpenAI with caching and error handling
 * @param {Object} options - Configuration options
 * @param {string} options.model - Model to use (default: "gpt-4")
 * @param {Array} options.messages - Messages array for the conversation
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for response randomness
 * @param {boolean} options.forceRefresh - Force a fresh response ignoring cache
 * @param {number} options.cacheTtl - Custom cache TTL in milliseconds
 * @returns {Promise<string>} - The AI response text
 */
const getOpenAIResponse = async (options = {}) => {
  const {
    model = "gpt-4o",
    messages,
    maxTokens = 8192,
    temperature = 0.7,
    forceRefresh = false,
    cacheTtl = 60 * 60 * 1000, // Default 24 hours
  } = options;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required for OpenAI API calls');
  }

  // Create a cache key based on the messages and model
  const messagesKey = JSON.stringify(messages).substring(0, 200);
  const cacheKey = `openai-${model}-${messagesKey}`;
  logger.info('User prompt', { messages });
  // Check cache first unless forceRefresh is true
  if (!forceRefresh) {
    const cachedResponse = aiResponseCache.get(cacheKey);
    if (cachedResponse) {
      logger.debug('Using cached OpenAI response', { messages: messagesKey });
      return cachedResponse;
    }
  }

  try {
    // Make the actual API call to OpenAI
    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
    });

    const responseText = completion.choices[0]?.message?.content.trim();

    // Cache the successful response
    aiResponseCache.set(cacheKey, responseText, cacheTtl);

    return responseText;
  } catch (error) {
    logger.error('OpenAI service call failed', {
      error: error.message,
      messages: messagesKey
    });

    // Try to get a cached response as fallback, even if it's expired
    const cachedResponse = aiResponseCache.get(cacheKey, true);
    if (cachedResponse) {
      logger.warn('Using expired cached response as fallback', {
        messages: messagesKey
      });
      return cachedResponse;
    }

    // If no cached response is available, throw the error
    throw error;
  }
};

/**
 * Makes an optimized call to Groq with caching and error handling
 * @param {Object} options - Configuration options
 * @param {string} options.model - Model to use (default: "llama3-70b-8192")
 * @param {Array} options.messages - Messages array for the conversation
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for response randomness
 * @param {boolean} options.forceRefresh - Force a fresh response ignoring cache
 * @param {number} options.cacheTtl - Custom cache TTL in milliseconds
 * @returns {Promise<string>} - The AI response text
 */
const getGroqResponse = async (options = {}) => {
  const {
    model = "meta-llama/llama-4-scout-17b-16e-instruct",
    messages,
    maxTokens = 4096,
    temperature = 1,
    forceRefresh = false,
    cacheTtl = 24 * 60 * 60 * 1000, // Default 24 hours
  } = options;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required for Groq API calls');
  }

  // Create a cache key based on the messages and model
  const messagesKey = JSON.stringify(messages).substring(0, 200);
  const cacheKey = `groq-${model}-${messagesKey}`;

  // Check cache first unless forceRefresh is true
  if (!forceRefresh) {
    const cachedResponse = aiResponseCache.get(cacheKey);
    if (cachedResponse) {
      logger.debug('Using cached Groq response', { messages: messagesKey });
      return cachedResponse;
    }
  }

  try {
    // Make the actual API call to Groq
    const completion = await groq.chat.completions.create({
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
    });

    const responseText = completion.choices[0]?.message?.content.trim();

    // Cache the successful response
    aiResponseCache.set(cacheKey, responseText, cacheTtl);

    return responseText;
  } catch (error) {
    logger.error('Groq service call failed', {
      error: error.message,
      messages: messagesKey
    });

    // Try to get a cached response as fallback, even if it's expired
    const cachedResponse = aiResponseCache.get(cacheKey, true);
    if (cachedResponse) {
      logger.warn('Using expired cached response as fallback', {
        messages: messagesKey
      });
      return cachedResponse;
    }

    // If no cached response is available, throw the error
    throw error;
  }
};

/**
 * Optimizes a prompt to reduce token usage
 * @param {string} prompt - The original prompt
 * @param {Object} options - Optimization options
 * @returns {string} - The optimized prompt
 */
const optimizePrompt = (prompt, options = {}) => {
  // Remove redundant whitespace
  let optimized = prompt.trim().replace(/\s+/g, ' ');

  // Remove unnecessary instructions or repetitive language
  optimized = optimized
    .replace(/please /gi, '')
    .replace(/kindly /gi, '')
    .replace(/I would like you to /gi, '')
    .replace(/Can you /gi, '')
    .replace(/Could you /gi, '');

  // Truncate if too long (default 1000 chars)
  const maxLength = options.maxLength || 1000;
  if (optimized.length > maxLength) {
    optimized = optimized.substring(0, maxLength) + '...';
  }

  return optimized;
};

/**
 * Extracts and parses JSON from an LLM response text
 * @param {string} text - The LLM response text containing JSON
 * @returns {Object|null} - Parsed JSON object or null if not found/invalid
 */
function extractJsonFromLLMResponse(text) {
  // Method 1: Try to extract JSON between triple backticks
  logger.info(`Raw text : ${text}`)
  const jsonRegexWithMarkdown = /```(?:json)?([\s\S]*?)```/;
  const markdownMatch = text.match(jsonRegexWithMarkdown);

  if (markdownMatch && markdownMatch[1]) {
    try {
      JSON.parse(markdownMatch[1].trim());
      return markdownMatch[1].trim();
    } catch (e) {
      console.warn("Found JSON-like content in markdown, but failed to parse:", e);
    }
  }

  // Method 2: Try to find content that looks like JSON with curly braces
  const jsonRegex = /(\{[\s\S]*\})/;
  const match = text.match(jsonRegex);

  if (match && match[1]) {
    try {
      JSON.parse(match[1]);
      return match[1];
    } catch (e) {
      console.warn("Found JSON-like content, but failed to parse:", e);
    }
  }

  // If nothing works, return null
  return null;
}

module.exports = {
  getGeminiResponse,
  getOpenAIResponse,
  getGroqResponse,
  optimizePrompt,
  extractJsonFromLLMResponse
};

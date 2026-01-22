import OpenAI from "openai";

// OpenAI client kept for potential future AI features
// Currently not actively used - price comparison uses direct user-matched catalogue items

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set. AI features will not work.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  timeout: 60 * 1000, // 1 minute timeout
  maxRetries: 2,
});

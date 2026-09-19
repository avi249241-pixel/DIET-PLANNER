// api/_lib/gemini.ts
import { GoogleGenAI } from "@google/genai";
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function cleanErrorMessage(err) {
  if (!err) return "An unexpected error occurred";
  const msg = err.message || String(err);
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
    return "API rate limit reached on free tier. Using smart offline calculation.";
  }
  if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
    return "Model experiencing high demand. Using smart fallback calculation.";
  }
  try {
    const parsed = JSON.parse(msg);
    if (parsed.error && parsed.error.message) {
      return parsed.error.message;
    }
  } catch (e) {
  }
  return msg;
}
async function callGeminiWithFailover(ai, requestConfig) {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.7-flash"];
  let lastError = null;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        ...requestConfig,
        model
      });
      if (response && response.text) {
        return response;
      }
    } catch (err) {
      lastError = err;
      const errMsg = err?.message || String(err);
      if (errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("UNAVAILABLE")) {
        continue;
      }
      break;
    }
  }
  throw lastError || new Error("Failed to generate content across available models");
}
export {
  callGeminiWithFailover,
  cleanErrorMessage,
  getAI
};

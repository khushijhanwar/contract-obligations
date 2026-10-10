import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import type { LlmClient } from "./extract.js";

export function createGeminiClient(model: string): LlmClient {
  const ai = new GoogleGenAI({});
  return {
    async generate(prompt, schema) {
      const r: any = await ai.interactions.create({
        model,
        input: prompt,
        response_format: { type: "text", mime_type: "application/json", schema },
      });
      return {
        text: r.output_text,
        inputTokens: r.usage?.total_input_tokens ?? 0,
        outputTokens: r.usage?.total_output_tokens ?? 0,
      };
    },
  };
}

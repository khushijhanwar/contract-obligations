import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const model = process.env.GEMINI_MODEL;
if (!process.env.GEMINI_API_KEY || !model) {
  throw new Error("Set GEMINI_API_KEY and GEMINI_MODEL in .env");
}

// With no options, the SDK reads GEMINI_API_KEY from the environment.
const ai = new GoogleGenAI({});

async function main() {
  console.log("model:", model);

  // Test 1: plain text
  let t0 = Date.now();
  const r1 = await ai.interactions.create({
    model,
    input: "Reply with exactly one word: pong",
  });
  console.log("\nTest 1 (plain text)");
  console.log("  reply:", r1.output_text);
  console.log("  ms:", Date.now() - t0);
  console.log("  usage:", JSON.stringify(r1.usage));

  // Test 2: JSON that must match a schema (this is how extraction will work)
  const schema = {
    type: "object",
    properties: {
      governing_law: { type: "string" },
      found: { type: "boolean" },
    },
    required: ["governing_law", "found"],
  };
  t0 = Date.now();
  const r2 = await ai.interactions.create({
    model,
    input:
      "Extract the governing law from this clause: " +
      "This Agreement shall be governed by the laws of the State of Delaware.",
    response_format: { type: "text", mime_type: "application/json", schema },
  });
  console.log("\nTest 2 (JSON with schema)");
  console.log("  parsed:", JSON.parse(r2.output_text));
  console.log("  ms:", Date.now() - t0);
  console.log("  usage:", JSON.stringify(r2.usage));
}

main().catch((e: any) => {
  console.error("\nFAILED");
  console.error("  status:", e?.status ?? e?.code ?? "unknown");
  console.error("  message:", String(e?.message ?? e).slice(0, 400));
  process.exit(1);
});

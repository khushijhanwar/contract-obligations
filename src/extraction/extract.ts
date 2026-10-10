import { FIELDS, ModelOutput, modelJsonSchema } from "./fields.js";
import { buildPrompt, PROMPT_VERSION } from "./prompt.js";
import { locateClause } from "./locate.js";

export type LlmResult = { text: string; inputTokens: number; outputTokens: number };
export interface LlmClient {
  generate(prompt: string, schema: object): Promise<LlmResult>;
}

export type ExtractedField = {
  fieldName: string;
  value: string;
  clause: string;
  startOffset: number;
  endOffset: number;
};
export type UnverifiedField = { fieldName: string; value: string; clause: string };

export type ExtractionOutcome = {
  status: "ok" | "invalid_output";
  promptVersion: string;
  fields: ExtractedField[];
  unverified: UnverifiedField[];
  inputTokens: number;
  outputTokens: number;
};

export async function extractFields(contract: string, llm: LlmClient, version: string = PROMPT_VERSION): Promise<ExtractionOutcome> {
  const res = await llm.generate(buildPrompt(contract, version), modelJsonSchema);
  const base = {
    promptVersion: version,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
  };

  let parsed;
  try {
    parsed = ModelOutput.safeParse(JSON.parse(res.text));
  } catch {
    return { ...base, status: "invalid_output", fields: [], unverified: [] };
  }
  if (!parsed.success) {
    return { ...base, status: "invalid_output", fields: [], unverified: [] };
  }

  const fields: ExtractedField[] = [];
  const unverified: UnverifiedField[] = [];
  for (const def of FIELDS) {
    const r = parsed.data[def.key];
    if (!r.found) continue;
    const loc = locateClause(contract, r.clause);
    if (!loc) {
      unverified.push({ fieldName: def.name, value: r.value, clause: r.clause });
      continue;
    }
    fields.push({
      fieldName: def.name,
      value: r.value,
      clause: loc.text,
      startOffset: loc.start,
      endOffset: loc.end,
    });
  }
  return { ...base, status: "ok", fields, unverified };
}

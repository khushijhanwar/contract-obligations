import { z } from "zod";

export type FieldDef = { key: string; name: string; description: string };

// name matches the CUAD category, so it lines up with expert_labels.field_name
export const FIELDS: FieldDef[] = [
  { key: "parties", name: "Parties", description: "The two or more parties who signed the contract" },
  { key: "agreement_date", name: "Agreement Date", description: "The date of the contract" },
  { key: "effective_date", name: "Effective Date", description: "The date when the contract is effective" },
  { key: "expiration_date", name: "Expiration Date", description: "The date the contract's initial term expires" },
  { key: "renewal_term", name: "Renewal Term", description: "The renewal term after the initial term, including automatic extensions" },
  { key: "notice_period", name: "Notice Period to Terminate Renewal", description: "The notice period required to terminate renewal" },
  { key: "governing_law", name: "Governing Law", description: "Which state or country's law governs the contract" },
  { key: "cap_on_liability", name: "Cap on Liability", description: "A cap on the amount of liability a party can owe, if the contract sets one" },
];

const FieldResult = z.object({
  found: z.boolean(),
  value: z.string(),
  clause: z.string(),
});

// Checks the model's JSON before we trust it.
export const ModelOutput = z.object(
  Object.fromEntries(FIELDS.map((f) => [f.key, FieldResult])),
);

// The same shape, as JSON Schema, sent to Gemini.
export const modelJsonSchema = {
  type: "object",
  properties: Object.fromEntries(
    FIELDS.map((f) => [
      f.key,
      {
        type: "object",
        description: f.description,
        properties: {
          found: { type: "boolean" },
          value: { type: "string" },
          clause: { type: "string" },
        },
        required: ["found", "value", "clause"],
      },
    ]),
  ),
  required: FIELDS.map((f) => f.key),
};

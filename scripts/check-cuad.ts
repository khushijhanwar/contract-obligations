import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FIELDS = [
  "Parties",
  "Agreement Date",
  "Effective Date",
  "Expiration Date",
  "Renewal Term",
  "Notice Period to Terminate Renewal",
  "Governing Law",
  "Cap on Liability",
];

const d = JSON.parse(readFileSync("data/cuad/CUADv1.json", "utf8"));

let badShape = 0;
let offsetMismatches = 0;
let inconsistentFlags = 0;
const hashes = new Set<string>();
const lengths: number[] = [];
const stats: Record<string, { present: number; spans: number; multi: number }> = {};
for (const f of FIELDS) stats[f] = { present: 0, spans: 0, multi: 0 };

for (const c of d.data) {
  if (c.paragraphs.length !== 1 || c.paragraphs[0].qas.length !== 41) {
    badShape++;
    continue;
  }
  const p = c.paragraphs[0];
  hashes.add(createHash("sha256").update(p.context).digest("hex"));
  lengths.push(p.context.length);

  for (const qa of p.qas) {
    const field = qa.id.split("__").pop();
    if (qa.is_impossible !== (qa.answers.length === 0)) inconsistentFlags++;
    if (!FIELDS.includes(field)) continue;
    if (qa.answers.length > 0) {
      stats[field].present++;
      stats[field].spans += qa.answers.length;
      if (qa.answers.length > 1) stats[field].multi++;
    }
    for (const a of qa.answers) {
      const slice = p.context.substring(a.answer_start, a.answer_start + a.text.length);
      if (slice !== a.text) offsetMismatches++;
    }
  }
}

lengths.sort((a, b) => a - b);
const median = lengths[Math.floor(lengths.length / 2)];
console.log("contracts:", d.data.length);
console.log("contracts with unexpected shape:", badShape);
console.log("distinct contract texts:", hashes.size);
console.log("is_impossible disagrees with answers:", inconsistentFlags);
console.log("answers whose offsets do NOT match the text:", offsetMismatches);
console.log("chars per contract: min", lengths[0], "median", median, "max", lengths[lengths.length - 1]);
console.table(stats);

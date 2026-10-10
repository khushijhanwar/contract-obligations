import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const d = JSON.parse(readFileSync("data/cuad/CUADv1.json", "utf8"));

const withAnswers = new Map<string, number>();
const byHash = new Map<string, string[]>();

for (const c of d.data) {
  const p = c.paragraphs[0];
  const h = createHash("sha256").update(p.context).digest("hex");
  byHash.set(h, [...(byHash.get(h) ?? []), c.title]);
  for (const qa of p.qas) {
    const name = qa.id.split("__").pop();
    withAnswers.set(name, (withAnswers.get(name) ?? 0) + (qa.answers.length > 0 ? 1 : 0));
  }
}

console.log("distinct category names in ids:", withAnswers.size);
for (const [name, n] of [...withAnswers].sort()) console.log(String(n).padStart(4), name);

console.log("\nduplicate texts:");
for (const titles of byHash.values()) if (titles.length > 1) console.log(titles);

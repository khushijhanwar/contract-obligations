import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../src/db.js";
import { FIELDS } from "../src/extraction/fields.js";
import { PROMPT_VERSION } from "../src/extraction/prompt.js";
import { bestIou, prf, type Counts } from "../src/eval/metrics.js";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const split = (arg("split") ?? "dev") as "dev" | "heldout";
const promptVersion = arg("prompt") ?? PROMPT_VERSION;
const model = process.env.GEMINI_MODEL;
if (!model) throw new Error("GEMINI_MODEL is not set");
if (split === "heldout" && !process.argv.includes("--final")) {
  throw new Error("The held-out set is for the final test only. Add --final if you mean it.");
}

const docs = await prisma.document.findMany({ where: { split }, select: { id: true, filename: true } });
const ids = docs.map((d) => d.id);
const fileOf = new Map(docs.map((d) => [d.id, d.filename]));

const runs = await prisma.llmRun.findMany({
  where: { documentId: { in: ids }, model, promptVersion, success: true },
});
const processed = [...new Set(runs.map((r) => r.documentId))];
const exts = await prisma.extraction.findMany({ where: { documentId: { in: processed }, model, promptVersion } });
const labels = await prisma.expertLabel.findMany({ where: { documentId: { in: processed } } });

const extBy = new Map(exts.map((e) => [`${e.documentId}|${e.fieldName}`, e]));
const labBy = new Map<string, typeof labels>();
for (const l of labels) {
  const k = `${l.documentId}|${l.fieldName}`;
  labBy.set(k, [...(labBy.get(k) ?? []), l]);
}

type Row = Counts & { labeled: number; overlap: number; iouSum: number };
const rows = new Map<string, Row>(FIELDS.map((f) => [f.name, { tp: 0, fp: 0, fn: 0, labeled: 0, overlap: 0, iouSum: 0 }]));
const misses: { doc: string; field: string; kind: string; model: string; expert: string }[] = [];
const snip = (s: string) => s.replace(/\s+/g, " ").slice(0, 90);

for (const doc of processed) {
  for (const f of FIELDS) {
    const r = rows.get(f.name)!;
    const pred = extBy.get(`${doc}|${f.name}`);
    const exp = labBy.get(`${doc}|${f.name}`) ?? [];
    if (exp.length) r.labeled++;
    if (pred && exp.length) {
      r.tp++;
      const score = bestIou(
        { start: pred.startOffset, end: pred.endOffset },
        exp.map((l) => ({ start: l.startOffset, end: l.endOffset })),
      );
      r.iouSum += score;
      if (score > 0) r.overlap++;
      else misses.push({ doc: fileOf.get(doc)!, field: f.name, kind: "wrong place", model: snip(pred.sourceClause), expert: snip(exp[0].text) });
    } else if (pred) {
      r.fp++;
      misses.push({ doc: fileOf.get(doc)!, field: f.name, kind: "false positive", model: snip(pred.sourceClause), expert: "(no label)" });
    } else if (exp.length) {
      r.fn++;
      misses.push({ doc: fileOf.get(doc)!, field: f.name, kind: "missed", model: "(not found)", expert: snip(exp[0].text) });
    }
  }
}

const pct = (x: number) => (x * 100).toFixed(1);
const table = FIELDS.map((f) => {
  const r = rows.get(f.name)!;
  const s = prf(r);
  return {
    field: f.name,
    labeled: r.labeled,
    precision: pct(s.precision),
    recall: pct(s.recall),
    f1: pct(s.f1),
    "overlap%": r.tp ? pct(r.overlap / r.tp) : "-",
    "avgIoU%": r.tp ? pct(r.iouSum / r.tp) : "-",
  };
});
const total = [...rows.values()].reduce((a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, fn: a.fn + r.fn }), { tp: 0, fp: 0, fn: 0 });
const micro = prf(total);
const macro = table.reduce((a, t) => a + Number(t.f1), 0) / table.length;

const n = Math.max(runs.length, 1);
const cost = runs.reduce((a, r) => a + Number(r.cost.toString()), 0);
const ms = runs.reduce((a, r) => a + r.latencyMs, 0) / n;
const tokIn = runs.reduce((a, r) => a + r.inputTokens, 0) / n;

console.log(`split=${split} model=${model} prompt=${promptVersion} contracts evaluated=${processed.length}/${docs.length}`);
console.table(table);
console.log(`micro F1 ${pct(micro.f1)} | macro F1 ${macro.toFixed(1)}`);
console.log(`cost/doc (list price) $${(cost / n).toFixed(4)} | avg latency ${Math.round(ms)} ms | avg input tokens ${Math.round(tokIn)}`);
console.log(`worst misses: ${misses.length} (see report)`);

const md = [
  `# Eval: split=${split}, model=${model}, prompt=${promptVersion}`,
  `Contracts evaluated: ${processed.length}/${docs.length}`,
  "",
  "| Field | Labeled | Precision | Recall | F1 | Overlap % | Avg IoU % |",
  "|---|---|---|---|---|---|---|",
  ...table.map((t) => `| ${t.field} | ${t.labeled} | ${t.precision} | ${t.recall} | ${t.f1} | ${t["overlap%"]} | ${t["avgIoU%"]} |`),
  "",
  `Micro F1 ${pct(micro.f1)} | Macro F1 ${macro.toFixed(1)}`,
  `Cost per document at list price: $${(cost / n).toFixed(4)} | avg latency ${Math.round(ms)} ms`,
  "",
  "## Misses",
  ...misses.map((m) => `- [${m.kind}] ${m.field} | ${m.doc}\n  - model: ${m.model}\n  - expert: ${m.expert}`),
].join("\n");
const out = `reports/eval-${split}-${promptVersion}.md`;
writeFileSync(out, md);
console.log("report:", out);
await prisma.$disconnect();

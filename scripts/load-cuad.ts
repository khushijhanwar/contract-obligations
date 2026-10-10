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
// The JSON capitalizes some names differently (e.g. "Cap On Liability"), so match ignoring case.
const CANON = new Map(FIELDS.map((f) => [f.toLowerCase(), f]));
const DEV = 50;
const HELDOUT = 50;
const dry = process.argv.includes("--dry-run");

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

type Label = { fieldName: string; text: string; startOffset: number; endOffset: number };
type Contract = { title: string; text: string; hash: string; labels: Label[] };

const raw = JSON.parse(readFileSync("data/cuad/CUADv1.json", "utf8"));

// 1. Sort by title so the result never depends on file order, skip duplicate texts,
//    and verify every label's offsets against the contract text.
const sorted = [...raw.data].sort((a: any, b: any) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
const seen = new Set<string>();
const contracts: Contract[] = [];
let duplicates = 0;

for (const c of sorted as any[]) {
  const p = c.paragraphs[0];
  const hash = sha(p.context);
  if (seen.has(hash)) {
    duplicates++;
    console.log("skipping duplicate text:", c.title);
    continue;
  }
  seen.add(hash);

  const labels: Label[] = [];
  for (const qa of p.qas) {
    const fieldName = CANON.get(String(qa.id.split("__").pop()).toLowerCase());
    if (!fieldName) continue;
    for (const a of qa.answers) {
      const startOffset = a.answer_start;
      const endOffset = startOffset + a.text.length;
      if (p.context.slice(startOffset, endOffset) !== a.text) {
        throw new Error(`Offset mismatch in "${c.title}", field "${fieldName}"`);
      }
      labels.push({ fieldName, text: a.text, startOffset, endOffset });
    }
  }
  contracts.push({ title: c.title, text: p.context, hash, labels });
}

// 2. Rank by a hash of the title: the first 50 are dev, the next 50 are held out.
const titleHash = new Map(contracts.map((c) => [c.title, sha(c.title)]));
const ranked = [...contracts].sort((a, b) =>
  titleHash.get(a.title)! < titleHash.get(b.title)! ? -1 : 1,
);
const chosen = ranked.slice(0, DEV + HELDOUT).map((c, i) => ({
  ...c,
  split: i < DEV ? ("dev" as const) : ("heldout" as const),
}));

console.log(`\ncontracts read: ${raw.data.length}, duplicates skipped: ${duplicates}, usable: ${contracts.length}`);
console.log(`chosen: ${chosen.length}`);
for (const split of ["dev", "heldout"] as const) {
  const set = chosen.filter((c) => c.split === split);
  console.log(`\n${split}: ${set.length} contracts`);
  for (const f of FIELDS) {
    const n = set.filter((c) => c.labels.some((l) => l.fieldName === f)).length;
    console.log(`  ${f.padEnd(36)} ${String(n).padStart(3)} contracts with a label`);
  }
}

if (dry) {
  console.log("\nDry run: nothing was written to the database.");
  process.exit(0);
}

// 3. Insert. A contract whose content hash is already stored is skipped, so re-running is safe.
const { prisma } = await import("../src/db.js");
let created = 0;
let skipped = 0;
for (const c of chosen) {
  const existing = await prisma.document.findUnique({ where: { contentHash: c.hash } });
  if (existing) {
    skipped++;
    continue;
  }
  await prisma.document.create({
    data: {
      filename: c.title,
      contentHash: c.hash,
      rawText: c.text,
      status: "uploaded",
      split: c.split,
      expertLabels: { create: c.labels },
    },
  });
  created++;
}
console.log(`\ncreated: ${created}, already present: ${skipped}`);
await prisma.$disconnect();

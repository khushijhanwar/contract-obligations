import type { ExtractedField } from "./extract.js";

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const DATE = `${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}`;

const RULES: { fieldName: string; patterns: RegExp[] }[] = [
  {
    fieldName: "Agreement Date",
    patterns: [
      new RegExp(
        `(?:dated(?:\\s+as\\s+of)?|(?:made|entered\\s+into)(?:\\s+and\\s+entered\\s+into)?\\s+(?:as\\s+of|on))\\s+(${DATE})`,
        "i",
      ),
    ],
  },
  {
    fieldName: "Effective Date",
    patterns: [
      new RegExp(`(${DATE})\\s*\\(\\s*(?:the\\s+)?[“"]?Effective\\s+Date[”"]?\\s*\\)`, "i"),
      new RegExp(`effective\\s+(?:as\\s+of|on)\\s+(${DATE})`, "i"),
    ],
  },
  {
    fieldName: "Governing Law",
    patterns: [
      /(?:[Gg]overned|[Cc]onstrued|[Ii]nterpreted)\b[^.]{0,80}?\b[Ll]aws?\s+of\s+(?:the\s+)?((?:State|Commonwealth|Province|District)\s+of\s+[A-Z][A-Za-z]*(?:\s[A-Z][A-Za-z]*)?|[A-Z][A-Za-z]*(?:\s[A-Z][A-Za-z]*)?)/,
    ],
  },
];

// Simple pattern matching for dates and governing law. Every result is a real
// slice of the contract, so offsets are always exact.
export function ruleBasedFields(contract: string): ExtractedField[] {
  const out: ExtractedField[] = [];
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = re.exec(contract);
      if (!m) continue;
      out.push({
        fieldName: rule.fieldName,
        value: m[1].replace(/\s+/g, " ").trim(),
        clause: m[0],
        startOffset: m.index,
        endOffset: m.index + m[0].length,
      });
      break;
    }
  }
  return out;
}

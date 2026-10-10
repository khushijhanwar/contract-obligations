export type Located = { start: number; end: number; text: string };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Finds a clause inside a contract and returns its real character positions.
// Tries an exact match first, then ignores differences in whitespace.
// Returns null if the clause is not in the text, so nothing is stored unverified.
export function locateClause(contract: string, clause: string): Located | null {
  const needle = clause.trim();
  if (!needle) return null;

  const exact = contract.indexOf(needle);
  if (exact !== -1) {
    return { start: exact, end: exact + needle.length, text: needle };
  }

  const pattern = needle.split(/\s+/).map(escapeRegex).join("\\s+");
  const match = new RegExp(pattern).exec(contract);
  if (!match) return null;
  return { start: match.index, end: match.index + match[0].length, text: match[0] };
}

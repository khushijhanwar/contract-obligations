export type Span = { start: number; end: number };
export type Counts = { tp: number; fp: number; fn: number };

export function overlapLen(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

// Intersection over union of two character spans: 1 = identical, 0 = no overlap.
export function iou(a: Span, b: Span): number {
  const o = overlapLen(a, b);
  const union = a.end - a.start + (b.end - b.start) - o;
  return union > 0 ? o / union : 0;
}

// Parties and dates have several expert spans, so score against the closest one.
export function bestIou(pred: Span, labels: Span[]): number {
  return Math.max(0, ...labels.map((l) => iou(pred, l)));
}

export function prf({ tp, fp, fn }: Counts) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

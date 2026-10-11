export type RetryOptions = {
  tries?: number;
  baseMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// Retries temporary failures (rate limit, server errors) with growing waits: 2s, 4s, ...
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const tries = opts.tries ?? 3;
  const baseMs = opts.baseMs ?? 2000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = Number(e?.status ?? e?.code);
      if (!RETRYABLE.has(status) || attempt >= tries) throw e;
      await sleep(baseMs * 2 ** (attempt - 1));
    }
  }
}

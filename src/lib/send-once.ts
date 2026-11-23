/** How long after an answer an identical request still counts as the same click. */
const REPEAT_MS = 1000;

/**
 * Sends a form's request once however often its button is clicked: a repeat of the last request, while that is in
 * flight or just after it succeeded, gets the first one's result instead of going out again. A disabled button alone
 * isn't enough -- it is live again from the answer until the next page renders, and a click there saved a sale twice.
 * A failed request is forgotten at once, so it can be retried.
 *
 * ponytail: one open form only. Two tabs or a network-level resend need a server-side idempotency key.
 */
export function createSendOnce(now: () => number = Date.now) {
  let last: { id: string; result: Promise<unknown>; answeredAt?: number } | null = null;

  return <T>(id: string, send: () => Promise<T>): Promise<T> => {
    if (last?.id === id && (last.answeredAt === undefined || now() - last.answeredAt <= REPEAT_MS))
      return last.result as Promise<T>;

    const entry: NonNullable<typeof last> = { id, result: Promise.resolve() };
    last = entry;
    const result = send().then(
      (value) => {
        entry.answeredAt = now();
        return value;
      },
      (error: unknown) => {
        if (last === entry) last = null;
        throw error;
      }
    );
    entry.result = result;
    return result;
  };
}

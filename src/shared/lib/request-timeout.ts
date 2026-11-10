export const REQUEST_TIMEOUT_MS = 12_000;

export class RequestTimeoutError extends Error {
  constructor() {
    super("The request timed out. Please try again.");
    this.name = "TimeoutError";
  }
}

/** Next 15's Edge sandbox does not expose AbortSignal.any, even when Node
 * itself does. Release listeners as soon as any source aborts. */
export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
    listeners.forEach((listener, source) => source.removeEventListener("abort", listener));
    listeners.clear();
  };
  for (const signal of signals) {
    if (signal.aborted) { abort(signal); break; }
    const listener = () => abort(signal);
    listeners.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
  }
  return controller.signal;
}

/** Bound the whole operation, including SDK retries/locks. Callers must pass
 * the signal to I/O and check it before applying any late side effects. */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(new RequestTimeoutError()), timeoutMs);
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason ?? new DOMException("Aborted", "AbortError"));
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([
      aborted,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
    controller.signal.removeEventListener("abort", onAbort);
  }
}

/** A fetch deadline stays active while the response body is being consumed. */
export function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const sourceSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = sourceSignal ? combineAbortSignals([sourceSignal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}

export const fetchWithTimeout = createFetchWithTimeout(REQUEST_TIMEOUT_MS);

/** Per-operation cancellation in addition to the normal per-fetch deadline. */
export function fetchWithSignal(signal: AbortSignal): typeof fetch {
  return (input, init) => {
    const source = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    return fetchWithTimeout(input, {
      ...init,
      signal: source ? combineAbortSignals([signal, source]) : signal,
    });
  };
}

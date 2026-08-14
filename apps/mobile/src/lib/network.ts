export const NETWORK_ERROR_MESSAGE =
  "Splidly can’t reach the internet. Check your connection and try again.";
const NETWORK_TIMEOUT_MS = 15_000;

const networkMessagePatterns = [
  "failed to fetch",
  "fetch failed",
  "network request failed",
  "network error",
  "internet connection appears to be offline",
  "could not connect to the server",
  "connection lost",
  "timed out",
  "timeout",
];

export function isNetworkError(cause: unknown): boolean {
  if (cause instanceof Error && cause.message === NETWORK_ERROR_MESSAGE) {
    return true;
  }
  const message =
    typeof cause === "string"
      ? cause
      : cause instanceof Error
        ? cause.message
        : "";
  const normalized = message.toLowerCase();
  return networkMessagePatterns.some((pattern) => normalized.includes(pattern));
}

export function friendlyErrorMessage(cause: unknown, fallback?: string) {
  if (isNetworkError(cause)) return NETWORK_ERROR_MESSAGE;
  const message =
    cause instanceof Error
      ? cause.message.trim()
      : typeof cause === "string"
        ? cause.trim()
        : "";
  if (
    /drizzlequeryerror|failed query:|internal_server_error|server_error/i.test(
      message,
    )
  ) {
    return "Splidly couldn’t complete that request. Please try again.";
  }
  if (message) return message;
  return fallback ?? "Something went wrong. Please try again.";
}

export const friendlyFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, {
    once: true,
  });
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (upstreamSignal?.aborted) throw cause;
    throw new Error(NETWORK_ERROR_MESSAGE, { cause });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
};

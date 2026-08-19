export const NETWORK_ERROR_MESSAGE =
  "Splidly can’t reach the internet. Check your connection and try again.";
export const SERVER_UNAVAILABLE_MESSAGE =
  "Splidly is temporarily unavailable. Please try again in a moment.";
const REQUEST_ERROR_MESSAGE =
  "Splidly couldn’t complete that request. Please try again.";
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

export function isServerUnavailableError(cause: unknown): boolean {
  const message =
    typeof cause === "string"
      ? cause
      : cause instanceof Error
        ? cause.message
        : "";
  return message.includes(SERVER_UNAVAILABLE_MESSAGE);
}

export function friendlyErrorMessage(cause: unknown, fallback?: string) {
  if (isNetworkError(cause)) return NETWORK_ERROR_MESSAGE;
  if (isServerUnavailableError(cause)) return SERVER_UNAVAILABLE_MESSAGE;
  const message =
    cause instanceof Error
      ? cause.message.trim()
      : typeof cause === "string"
        ? cause.trim()
        : "";
  if (
    /drizzlequeryerror|failed query:|internal_server_error|server_error|json parse error|unexpected (?:character|token).*</i.test(
      message,
    )
  ) {
    return REQUEST_ERROR_MESSAGE;
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
  let response: Response;
  try {
    response = await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (upstreamSignal?.aborted) throw cause;
    throw new Error(NETWORK_ERROR_MESSAGE, { cause });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }

  if (response.ok) return response;

  if (response.status >= 500 && response.status <= 599) {
    throw new Error(SERVER_UNAVAILABLE_MESSAGE);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/(?:application|text)\/(?:[\w.+-]*\+)?json\b/i.test(contentType)) {
    throw new Error(REQUEST_ERROR_MESSAGE);
  }

  return response;
};

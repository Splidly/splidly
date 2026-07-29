const appleSignInCancellationCode = "ERR_REQUEST_CANCELED";

export function isAppleSignInCancellation(cause: unknown) {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === appleSignInCancellationCode
  );
}

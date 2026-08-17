export type AppleTokenType = "refresh_token" | "access_token";

export interface AppleTokenRevocationInput {
  clientId: string;
  clientSecret: string;
  token: string;
  tokenType: AppleTokenType;
}

export async function revokeAppleToken(
  input: AppleTokenRevocationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      token: input.token,
      token_type_hint: input.tokenType,
    }),
  });
  if (!response.ok) {
    throw new Error(`Apple token revocation failed (${response.status})`);
  }
}

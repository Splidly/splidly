const productionUrl = "https://splidly.site";

export function resolvePublicUrl(
  name: string,
  configuredValue: string | undefined,
  fallback: string,
) {
  const value = configuredValue?.trim() || fallback;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http:// or https://`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not contain credentials, a query, or a hash`);
  }

  return url.toString().replace(/\/$/, "");
}

const defaultApiUrl = __DEV__ ? "http://localhost:4000" : productionUrl;

export const API_URL = resolvePublicUrl(
  "EXPO_PUBLIC_API_URL",
  process.env.EXPO_PUBLIC_API_URL,
  defaultApiUrl,
);
export const APP_URL = resolvePublicUrl(
  "EXPO_PUBLIC_APP_URL",
  process.env.EXPO_PUBLIC_APP_URL,
  productionUrl,
);

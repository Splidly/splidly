const publicFirebaseConfigPath = "apps/mobile/google-services.json";
const googleApiKey = /^AIza[0-9A-Za-z_-]{30,}$/;

// Firebase client API keys identify the public app; they are not credentials.
// Only their documented field in this exact Android config is exempted.
export function publicFirebaseScanText(path, text) {
  if (path !== publicFirebaseConfigPath) return null;
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    config?.configuration_version !== "1" ||
    typeof config.project_info?.project_id !== "string" ||
    !Array.isArray(config.client) ||
    config.client.length === 0
  ) return null;

  for (const client of config.client) {
    if (
      typeof client?.client_info?.android_client_info?.package_name !== "string" ||
      !Array.isArray(client.api_key)
    ) return null;
    for (const entry of client.api_key) {
      if (typeof entry?.current_key !== "string" || !googleApiKey.test(entry.current_key)) {
        return null;
      }
      entry.current_key = "PUBLIC_FIREBASE_API_KEY";
    }
  }
  return JSON.stringify(config);
}

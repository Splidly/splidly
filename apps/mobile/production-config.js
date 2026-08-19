const reverseDnsIdentifier =
  /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9][a-zA-Z0-9_-]*)+$/;

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required for production builds`);
  return value;
}

function productionHttpsUrl(env, key) {
  const value = required(env, key);
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    /(^|\.)(localhost|example\.(com|org|net))$/i.test(url.hostname)
  ) {
    throw new Error(`${key} must be a final public HTTPS URL`);
  }
  return url.origin;
}

function finalIdentifier(env, key) {
  const value = required(env, key);
  if (!reverseDnsIdentifier.test(value) || /(^|\.)example(\.|$)/i.test(value)) {
    throw new Error(`${key} must be a final reverse-DNS identifier`);
  }
  return value;
}

function resolveMobileBuildConfig(env) {
  const production =
    env.APP_ENV === "production" || env.EAS_BUILD_PROFILE === "production";
  const androidEnabled = env.ANDROID_ENABLED === "true";

  if (!production) {
    const appUrl = env.EXPO_PUBLIC_APP_URL ?? "https://splidly.example.com";
    return {
      androidPackage: env.ANDROID_PACKAGE ?? "com.example.splidly",
      androidEnabled,
      apiUrl: env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000",
      appUrl,
      googleIosReversedClientId:
        env.GOOGLE_IOS_REVERSED_CLIENT_ID ??
        "com.googleusercontent.apps.configure-me",
      iosBundleIdentifier: env.IOS_APP_ID ?? "com.example.splidly",
      production,
    };
  }

  const apiUrl = productionHttpsUrl(env, "EXPO_PUBLIC_API_URL");
  const appUrl = productionHttpsUrl(env, "EXPO_PUBLIC_APP_URL");
  const googleWebClientId = required(
    env,
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  );
  const googleIosClientId = required(
    env,
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  );
  const googleIosReversedClientId = required(
    env,
    "GOOGLE_IOS_REVERSED_CLIENT_ID",
  );
  const googleClientPattern =
    /^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/;
  if (
    !googleClientPattern.test(googleWebClientId) ||
    !googleClientPattern.test(googleIosClientId)
  ) {
    throw new Error(
      "Production Google client IDs must end in .apps.googleusercontent.com",
    );
  }
  const expectedReversedClientId = `com.googleusercontent.apps.${googleIosClientId.replace(
    /\.apps\.googleusercontent\.com$/,
    "",
  )}`;
  if (googleIosReversedClientId !== expectedReversedClientId) {
    throw new Error(
      "GOOGLE_IOS_REVERSED_CLIENT_ID must match EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
    );
  }
  if (env.EAS_BUILD_PLATFORM === "android" && !androidEnabled) {
    throw new Error(
      "Android production builds are disabled; set ANDROID_ENABLED=true after Android is release-ready",
    );
  }

  return {
    androidPackage: androidEnabled
      ? finalIdentifier(env, "ANDROID_PACKAGE")
      : "com.example.splidly",
    androidEnabled,
    apiUrl,
    appUrl,
    googleIosReversedClientId,
    iosBundleIdentifier: finalIdentifier(env, "IOS_APP_ID"),
    production,
  };
}

module.exports = { resolveMobileBuildConfig };

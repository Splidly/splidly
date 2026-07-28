import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import type { ExpoConfig } from "expo/config";

const rootEnvPath = resolve(__dirname, "../../.env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const publicUrl =
  process.env.EXPO_PUBLIC_APP_URL ?? "https://splidly.example.com";
const host = new URL(publicUrl).host;
const iosBundleIdentifier =
  process.env.IOS_APP_ID ?? "com.example.splidly";
const androidPackage =
  process.env.ANDROID_PACKAGE ?? "com.example.splidly";

const config: ExpoConfig = {
  name: "Splidly",
  slug: "splidly",
  scheme: "splidly",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  experiments: { typedRoutes: true },
  extra: {
    eas: {
      projectId: "7a8d0057-80ee-4695-a5bb-8113724c0d67",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-apple-authentication",
    "expo-image",
    "expo-localization",
    "./plugins/with-google-signin-modular-headers",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme:
          process.env.GOOGLE_IOS_REVERSED_CLIENT_ID ??
          "com.googleusercontent.apps.configure-me",
      },
    ],
    "./plugins/with-ios-scene-lifecycle",
  ],
  ios: {
    icon: "./assets/icons/splidly.icon",
    bundleIdentifier: iosBundleIdentifier,
    supportsTablet: true,
    usesAppleSignIn: true,
    associatedDomains: [`applinks:${host}`],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneClassName: "UIWindowScene",
              UISceneConfigurationName: "Default Configuration",
              UISceneDelegateClassName:
                "$(PRODUCT_MODULE_NAME).SceneDelegate",
            },
          ],
        },
      },
    },
  },
  android: {
    package: androidPackage,
    icon: "./assets/icons/android-legacy.png",
    adaptiveIcon: {
      foregroundImage: "./assets/icons/android-foreground.png",
      monochromeImage: "./assets/icons/android-monochrome.png",
      backgroundColor: "#E7F4EC",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host, pathPrefix: "/invite" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: { bundler: "metro" },
};

export default config;

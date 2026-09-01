import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import type { ExpoConfig } from "expo/config";
import { resolveMobileBuildConfig } from "./production-config";

const rootEnvPath = resolve(__dirname, "../../.env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const buildConfig = resolveMobileBuildConfig(process.env);
const host = new URL(buildConfig.appUrl).host;

const config: ExpoConfig = {
  name: "Splidly",
  slug: "splidly",
  scheme: "splidly",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  experiments: { typedRoutes: true },
  extra: {
    environment: buildConfig.production ? "production" : "development",
    eas: {
      projectId: "7a8d0057-80ee-4695-a5bb-8113724c0d67",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-apple-authentication",
    "expo-notifications",
    "expo-image",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Splidly uses your selected photo as a profile or group picture.",
        microphonePermission: false,
      },
    ],
    "expo-localization",
    "./plugins/with-google-signin-modular-headers",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme:
          buildConfig.googleIosReversedClientId,
      },
    ],
    "./plugins/with-ios-scene-lifecycle",
  ],
  ios: {
    icon: "./assets/icons/splidly.icon",
    bundleIdentifier: buildConfig.iosBundleIdentifier,
    supportsTablet: true,
    usesAppleSignIn: true,
    associatedDomains: [`applinks:${host}`],
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        "NSPrivacyCollectedDataTypeName",
        "NSPrivacyCollectedDataTypeEmailAddress",
        "NSPrivacyCollectedDataTypePhotosorVideos",
        "NSPrivacyCollectedDataTypeOtherFinancialInfo",
        "NSPrivacyCollectedDataTypeOtherUserContent",
        "NSPrivacyCollectedDataTypeUserID",
        "NSPrivacyCollectedDataTypeDeviceID",
        "NSPrivacyCollectedDataTypeOtherDiagnosticData",
      ].map((NSPrivacyCollectedDataType) => ({
        NSPrivacyCollectedDataType,
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: [
          "NSPrivacyCollectedDataTypePurposeAppFunctionality",
        ],
      })),
    },
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
    package: buildConfig.androidPackage,
    softwareKeyboardLayoutMode: "resize",
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

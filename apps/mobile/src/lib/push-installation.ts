import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const installationIdKey = "splidly-push-installation-id";

export async function getPushInstallationId() {
  const existing = await SecureStore.getItemAsync(installationIdKey);
  if (existing) return existing;
  const installationId = Crypto.randomUUID();
  await SecureStore.setItemAsync(installationIdKey, installationId);
  return installationId;
}

export function getExistingPushInstallationId() {
  return SecureStore.getItemAsync(installationIdKey);
}

export async function unregisterNativePushNotifications() {
  if (Platform.OS === "ios") {
    await Notifications.unregisterForNotificationsAsync();
  }
}

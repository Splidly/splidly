import * as SecureStore from "expo-secure-store";
import { clearRecentCurrencies } from "./currencies";
import { pendingInvite } from "./pending-invite";
import { clearPushInstallationId } from "./push-installation";

const authStorageKeys = [
  "splidly_cookie",
  "splidly_session_data",
  "splidly_last_login_method",
] as const;

export async function clearLocalAuthSession(): Promise<void> {
  await Promise.all(
    authStorageKeys.flatMap((key) => [
      SecureStore.deleteItemAsync(key),
      ...Array.from({ length: 32 }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${index}`),
      ),
    ]),
  );
}

export async function clearLocalAccountData(): Promise<void> {
  const results = await Promise.allSettled([
    clearLocalAuthSession(),
    pendingInvite.clear(),
    clearRecentCurrencies(),
    clearPushInstallationId(),
  ]);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
}

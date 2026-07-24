import * as SecureStore from "expo-secure-store";

const KEY = "splidly.pending-invite";

export const pendingInvite = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};


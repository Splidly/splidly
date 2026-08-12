export const NETWORK_ERROR_MESSAGE =
  "Splidly can’t reach the server. Check your connection or try mobile data. A VPN or Wi-Fi filter may be blocking the app.";

export const friendlyFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (cause) {
    throw new Error(NETWORK_ERROR_MESSAGE, { cause });
  }
};

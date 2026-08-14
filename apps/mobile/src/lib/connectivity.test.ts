import { networkStateIsOnline } from "./connectivity";

describe("networkStateIsOnline", () => {
  it("treats a disconnected or unreachable network as offline", () => {
    expect(networkStateIsOnline({ isConnected: false })).toBe(false);
    expect(
      networkStateIsOnline({
        isConnected: true,
        isInternetReachable: false,
      }),
    ).toBe(false);
  });

  it("does not flash an offline state while reachability is unresolved", () => {
    expect(networkStateIsOnline({})).toBe(true);
    expect(
      networkStateIsOnline({
        isConnected: true,
      }),
    ).toBe(true);
  });
});

import { profileNavigationState } from "./profile-navigation";

describe("profileNavigationState", () => {
  it("does not mistake a failed profile request for incomplete onboarding", () => {
    expect(
      profileNavigationState({
        data: undefined,
        error: new Error("Network request failed"),
        isPending: false,
      }),
    ).toBe("error");
  });

  it("distinguishes pending, incomplete, and onboarded profiles", () => {
    expect(profileNavigationState({ isPending: true })).toBe("pending");
    expect(
      profileNavigationState({ data: { onboardedAt: null }, isPending: false }),
    ).toBe("onboarding");
    expect(
      profileNavigationState({
        data: { onboardedAt: new Date() },
        isPending: false,
      }),
    ).toBe("ready");
  });
});

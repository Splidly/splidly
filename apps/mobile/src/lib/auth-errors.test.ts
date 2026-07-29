import { isAppleSignInCancellation } from "./auth-errors";

describe("isAppleSignInCancellation", () => {
  it("recognizes Expo's expected Apple sign-in cancellation", () => {
    expect(
      isAppleSignInCancellation({
        code: "ERR_REQUEST_CANCELED",
        message: "The user canceled the authorization attempt",
      }),
    ).toBe(true);
  });

  it("does not suppress genuine Apple sign-in failures", () => {
    expect(
      isAppleSignInCancellation({
        code: "ERR_REQUEST_FAILED",
        message: "Authorization failed",
      }),
    ).toBe(false);
    expect(isAppleSignInCancellation(new Error("Network failed"))).toBe(false);
  });
});

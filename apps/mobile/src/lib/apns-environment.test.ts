import * as Application from "expo-application";
import { getApnsEnvironment } from "./apns-environment";

jest.mock("expo-application", () => ({
  ApplicationReleaseType: {
    UNKNOWN: 0,
    SIMULATOR: 1,
    ENTERPRISE: 2,
    DEVELOPMENT: 3,
    AD_HOC: 4,
    APP_STORE: 5,
  },
  getIosApplicationReleaseTypeAsync: jest.fn(),
  getIosPushNotificationServiceEnvironmentAsync: jest.fn(),
}));

const getReleaseType = jest.mocked(
  Application.getIosApplicationReleaseTypeAsync,
);
const getServiceEnvironment = jest.mocked(
  Application.getIosPushNotificationServiceEnvironmentAsync,
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getApnsEnvironment", () => {
  it.each(["development", "production"] as const)(
    "uses the environment from the embedded provisioning profile: %s",
    async (environment) => {
      getServiceEnvironment.mockResolvedValue(environment);

      await expect(getApnsEnvironment()).resolves.toBe(environment);
      expect(getReleaseType).not.toHaveBeenCalled();
    },
  );

  it("uses production when App Store processing removed the profile", async () => {
    getServiceEnvironment.mockResolvedValue(null);
    getReleaseType.mockResolvedValue(Application.ApplicationReleaseType.APP_STORE);

    await expect(getApnsEnvironment()).resolves.toBe("production");
  });

  it("rejects an unresolved environment outside App Store distribution", async () => {
    getServiceEnvironment.mockResolvedValue(null);
    getReleaseType.mockResolvedValue(Application.ApplicationReleaseType.UNKNOWN);

    await expect(getApnsEnvironment()).rejects.toThrow(
      "Unable to determine the APNs environment for iOS release type 0",
    );
  });
});

import * as Application from "expo-application";

type ApnsEnvironment = Exclude<
  Application.PushNotificationServiceEnvironment,
  null
>;

export async function getApnsEnvironment(): Promise<ApnsEnvironment> {
  const environment =
    await Application.getIosPushNotificationServiceEnvironmentAsync();
  if (environment) return environment;

  const releaseType = await Application.getIosApplicationReleaseTypeAsync();
  if (releaseType === Application.ApplicationReleaseType.APP_STORE) {
    return "production";
  }

  throw new Error(
    `Unable to determine the APNs environment for iOS release type ${releaseType}`,
  );
}

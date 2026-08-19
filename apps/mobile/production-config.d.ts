export interface MobileBuildConfig {
  androidEnabled: boolean;
  androidPackage: string;
  apiUrl: string;
  appUrl: string;
  googleIosReversedClientId: string;
  iosBundleIdentifier: string;
  production: boolean;
}

export function resolveMobileBuildConfig(
  env: Record<string, string | undefined>,
): MobileBuildConfig;

const { withPodfile } = require("expo/config-plugins");

const modularHeaderPods = `
  # Google Sign-In's AppCheckCore Swift pod needs module maps for these
  # Objective-C dependencies when CocoaPods links pods as static libraries.
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

module.exports = function withGoogleSigninModularHeaders(config) {
  return withPodfile(config, (podfileConfig) => {
    const podfile = podfileConfig.modResults.contents;

    if (!podfile.includes("pod 'GoogleUtilities', :modular_headers => true")) {
      podfileConfig.modResults.contents = podfile.replace(
        /target ['"]Splidly['"] do\n/,
        (targetLine) => `${targetLine}${modularHeaderPods}\n`,
      );
    }

    return podfileConfig;
  });
};

const { withPodfile } = require("expo/config-plugins");

const modularHeaderPods = `
  # Google Sign-In's AppCheckCore Swift pod needs module maps for these
  # Objective-C dependencies when CocoaPods links pods as static libraries.
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

const deploymentTargetFloor = `
    # Privacy resource bundles can retain deployment targets unsupported by Xcode.
    minimum_ios = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '16.4')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current_ios = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current_ios && Gem::Version.new(current_ios) < minimum_ios
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios.to_s
        end
      end
    end
`;

module.exports = function withGoogleSigninModularHeaders(config) {
  return withPodfile(config, (podfileConfig) => {
    let podfile = podfileConfig.modResults.contents;

    if (!podfile.includes("pod 'GoogleUtilities', :modular_headers => true")) {
      podfile = podfile.replace(
        /target ['"]Splidly['"] do\n/,
        (targetLine) => `${targetLine}${modularHeaderPods}\n`,
      );
    }

    if (!podfile.includes("minimum_ios = Gem::Version.new")) {
      const hook = "post_install do |installer|\n";
      if (!podfile.includes(hook)) {
        throw new Error("Cannot configure iOS Pod deployment targets: post_install hook missing");
      }
      podfile = podfile.replace(hook, `${hook}${deploymentTargetFloor}\n`);
    }
    podfileConfig.modResults.contents = podfile;

    return podfileConfig;
  });
};

const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withOptionalWifi(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const features = manifest["uses-feature"] ?? [];
    const wifi = features.find(
      (feature) => feature.$?.["android:name"] === "android.hardware.wifi",
    );

    // Wi-Fi permissions can make Google Play infer a hardware requirement.
    // Splidly also works over mobile data or Ethernet.
    if (wifi) {
      wifi.$["android:required"] = "false";
    } else {
      features.push({
        $: {
          "android:name": "android.hardware.wifi",
          "android:required": "false",
        },
      });
    }
    manifest["uses-feature"] = features;
    return androidConfig;
  });
};

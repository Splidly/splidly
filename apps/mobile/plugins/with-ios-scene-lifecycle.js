const { withAppDelegate } = require("expo/config-plugins");

const legacyWindowBootstrap = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const sceneDelegate = `class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions(from: connectionOptions))
    self.window = window
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate else { return }

    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      if let sourceApplication = context.options.sourceApplication {
        options[.sourceApplication] = sourceApplication
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }
      _ = appDelegate.application(
        UIApplication.shared,
        open: context.url,
        options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate else { return }

    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  private func launchOptions(
    from connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]

    if let context = connectionOptions.urlContexts.first {
      launchOptions[.url] = context.url
      if let sourceApplication = context.options.sourceApplication {
        launchOptions[.sourceApplication] = sourceApplication
      }
      if let annotation = context.options.annotation {
        launchOptions[.annotation] = annotation
      }
    }

    if let userActivity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }

    return launchOptions.isEmpty ? nil : launchOptions
  }
}

`;

module.exports = function withIosSceneLifecycle(config) {
  return withAppDelegate(config, (appDelegateConfig) => {
    if (appDelegateConfig.modResults.language !== "swift") {
      throw new Error("Splidly's iOS scene lifecycle plugin requires a Swift AppDelegate");
    }

    let contents = appDelegateConfig.modResults.contents;

    if (contents.includes(legacyWindowBootstrap)) {
      contents = contents.replace(legacyWindowBootstrap, "");
    }

    if (!contents.includes("class SceneDelegate:")) {
      contents = contents.replace(
        "class ReactNativeDelegate:",
        `${sceneDelegate}class ReactNativeDelegate:`,
      );
    }

    appDelegateConfig.modResults.contents = contents;
    return appDelegateConfig;
  });
};

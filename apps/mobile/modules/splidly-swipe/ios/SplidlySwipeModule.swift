import ExpoModulesCore

public final class SplidlySwipeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SplidlySwipe")
    View(ActivityListView.self)
  }
}

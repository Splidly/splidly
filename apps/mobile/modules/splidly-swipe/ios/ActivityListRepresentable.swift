import SwiftUI

struct ActivityListRepresentable: UIViewControllerRepresentable {
  let sections: [ActivitySection]
  let completion: ActivitySwipeResult?
  let refreshCompletion: String?
  let refreshEnabled: Bool
  let bounces: Bool
  let onDeleteRequested: @MainActor (String, String) -> Void
  let onRefresh: @MainActor (String) -> Void
  let onScroll: @MainActor ([String: Any]) -> Void
  let onHostedLayout: @MainActor (String, CGFloat) -> Void

  func makeUIViewController(context: Context) -> ActivityListController {
    ActivityListController()
  }

  func updateUIViewController(_ controller: ActivityListController, context: Context) {
    controller.update(
      sections: sections,
      completion: completion,
      refreshCompletion: refreshCompletion,
      refreshEnabled: refreshEnabled,
      bounces: bounces,
      onDeleteRequested: onDeleteRequested,
      onRefresh: onRefresh,
      onScroll: onScroll,
      onHostedLayout: onHostedLayout
    )
  }

  static func dismantleUIViewController(_ controller: ActivityListController, coordinator: ()) {
    controller.cancelPendingSwipe()
  }
}

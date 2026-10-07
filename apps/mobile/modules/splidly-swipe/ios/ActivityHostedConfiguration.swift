import UIKit

struct ActivityHostedConfiguration: UIContentConfiguration {
  let content: ActivityHostedContent
  let onWidthChange: @MainActor (String, CGFloat) -> Void

  func makeContentView() -> any UIView & UIContentView {
    ActivityHostedContentView(configuration: self)
  }

  func updated(for state: any UIConfigurationState) -> Self { self }
}

import UIKit

final class ActivityHostedContentView: UIView, UIContentView {
  var configuration: any UIContentConfiguration {
    didSet { applyConfiguration() }
  }
  private var hostedView: UIView?
  private var hostedHeight: CGFloat = 1
  private var centerObservation: NSKeyValueObservation?
  private var boundsObservation: NSKeyValueObservation?

  init(configuration: ActivityHostedConfiguration) {
    self.configuration = configuration
    super.init(frame: .zero)
    clipsToBounds = true
    applyConfiguration()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  override var intrinsicContentSize: CGSize {
    CGSize(width: UIView.noIntrinsicMetric, height: max(1, hostedHeight))
  }

  private func applyConfiguration() {
    guard let configuration = configuration as? ActivityHostedConfiguration else { return }
    if hostedView !== configuration.content.view {
      centerObservation = nil
      boundsObservation = nil
      hostedView?.removeFromSuperview()
      hostedView = configuration.content.view
      addSubview(configuration.content.view)
      // Fabric can later apply the Host's position from the React tree. UIKit
      // owns its position inside this cell, so schedule a local layout whenever
      // Fabric moves or resizes it after the collection's layout pass.
      centerObservation = configuration.content.view.observe(\.center) { [weak self] _, _ in
        MainActor.assumeIsolated { self?.layoutHostedViewIfNeeded() }
      }
      boundsObservation = configuration.content.view.observe(\.bounds) { [weak self] _, _ in
        MainActor.assumeIsolated { self?.layoutHostedViewIfNeeded() }
      }
    }
    hostedHeight = configuration.content.height
    invalidateIntrinsicContentSize()
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard !bounds.isEmpty else { return }
    if hostedView?.frame != bounds { hostedView?.frame = bounds }
    if bounds.width > 0, let configuration = configuration as? ActivityHostedConfiguration {
      configuration.onWidthChange(configuration.content.key, bounds.width)
    }
  }

  private func layoutHostedViewIfNeeded() {
    if !bounds.isEmpty, hostedView?.frame != bounds { setNeedsLayout() }
  }
}

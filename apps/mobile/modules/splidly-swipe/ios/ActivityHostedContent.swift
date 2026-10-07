import UIKit

struct ActivityHostedContent: Equatable {
  let key: String
  let view: UIView
  let height: CGFloat

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.key == rhs.key && lhs.view === rhs.view && lhs.height == rhs.height
  }
}

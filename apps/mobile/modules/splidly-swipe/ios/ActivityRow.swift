import SwiftUI
import UIKit

struct ActivityRow {
  let key: String
  let content: AnyView
  let hostedContent: ActivityHostedContent?
  let canDelete: Bool
  let deletionDisabled: Bool
  var actionTitle: String = "Delete"
  var actionColor: UIColor? = nil
  var actionIcon: String = "trash"
}

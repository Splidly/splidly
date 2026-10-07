import SwiftUI

struct ActivityRow {
  let key: String
  let content: AnyView
  let hostedContent: ActivityHostedContent?
  let canDelete: Bool
  let deletionDisabled: Bool
}

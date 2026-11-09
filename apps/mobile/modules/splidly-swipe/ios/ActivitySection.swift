import SwiftUI

struct ActivitySection {
  let key: String
  let isOverview: Bool
  let header: ActivityHostedContent
  let rows: [ActivityRow]
  let footer: ActivityHostedContent?
  var headerTitle: String? = nil
  var footerTitle: String? = nil
}

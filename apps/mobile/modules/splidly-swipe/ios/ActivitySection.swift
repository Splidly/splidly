import SwiftUI

struct ActivitySection {
  let key: String
  let isOverview: Bool
  let header: ActivityHostedContent
  let rows: [ActivityRow]
  let footer: ActivityHostedContent?
}

import ExpoModulesCore
import SwiftUI

struct ActivityListView: ExpoSwiftUI.View {
  @ObservedObject var props: ActivityListProps

  var body: some View {
    let children = props.children ?? []
    let sections = props.sections.compactMap { section -> ActivitySection? in
      guard children.indices.contains(section.headerIndex),
        let headerView = children[section.headerIndex].uiView
      else { return nil }
      return ActivitySection(
        key: section.key,
        isOverview: section.isOverview,
        header: ActivityHostedContent(
          key: "header:\(section.key)", view: headerView, height: section.headerHeight
        ),
        rows: section.rows.compactMap { row in
          guard children.indices.contains(row.childIndex) else { return nil }
          let content: any View = children[row.childIndex].childView
          return ActivityRow(
            key: row.key,
            content: AnyView(content),
            hostedContent: row.canDelete
              ? nil
              : children[row.childIndex].uiView.map {
                ActivityHostedContent(key: "row:\(row.key)", view: $0, height: row.height)
              },
            canDelete: row.canDelete,
            deletionDisabled: row.deletionDisabled
          )
        },
        footer: section.footerIndex.flatMap {
          guard children.indices.contains($0), let view = children[$0].uiView else { return nil }
          return ActivityHostedContent(
            key: "footer:\(section.key)", view: view, height: section.footerHeight
          )
        }
      )
    }
    ActivityListRepresentable(
      sections: sections,
      completion: props.completion.map {
        ActivitySwipeResult(requestId: $0.requestId, deleted: $0.deleted)
      },
      refreshCompletion: props.refreshCompletion,
      refreshEnabled: props.refreshEnabled,
      bounces: props.bounces,
      onDeleteRequested: { key, requestId in
        props.onDeleteRequested(["rowKey": key, "requestId": requestId])
      },
      onRefresh: { requestId in props.onRefresh(["requestId": requestId]) },
      onScroll: { props.onScroll($0) },
      onHostedLayout: { key, width in
        props.onHostedLayout(["key": key, "width": width])
      }
    )
  }
}

import ExpoModulesCore

final class ActivityListProps: ExpoSwiftUI.ViewProps {
  @Field var sections: [ActivitySectionRecord] = []
  @Field var completion: ActivitySwipeResultRecord?
  @Field var refreshCompletion: String?
  @Field var refreshEnabled: Bool = false
  @Field var bounces: Bool = true
  var onDeleteRequested = EventDispatcher()
  var onRefresh = EventDispatcher()
  var onScroll = EventDispatcher()
  var onHostedLayout = EventDispatcher()
}

import ExpoModulesCore

struct ActivitySectionRecord: Record {
  @Field var key: String = ""
  @Field var isOverview: Bool = false
  @Field var headerIndex: Int = 0
  @Field var headerHeight: Double = 0
  @Field var headerTitle: String?
  @Field var footerTitle: String?
  @Field var rows: [ActivityRowRecord] = []
  @Field var footerIndex: Int?
  @Field var footerHeight: Double = 0
}

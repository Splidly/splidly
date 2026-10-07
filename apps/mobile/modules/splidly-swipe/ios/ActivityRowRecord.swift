import ExpoModulesCore

struct ActivityRowRecord: Record {
  @Field var key: String = ""
  @Field var childIndex: Int = 0
  @Field var canDelete: Bool = false
  @Field var deletionDisabled: Bool = false
  @Field var height: Double = 0
}

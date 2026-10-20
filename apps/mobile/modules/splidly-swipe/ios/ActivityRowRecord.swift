import ExpoModulesCore
import UIKit

struct ActivityRowRecord: Record {
  @Field var key: String = ""
  @Field var childIndex: Int = 0
  @Field var nativeContent: Bool = false
  @Field var canDelete: Bool = false
  @Field var deletionDisabled: Bool = false
  @Field var actionTitle: String = "Delete"
  @Field var actionColor: UIColor?
  @Field var actionIcon: String = "trash"
  @Field var height: Double = 0
}

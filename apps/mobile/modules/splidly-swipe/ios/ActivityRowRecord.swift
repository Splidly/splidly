import ExpoModulesCore
import UIKit

struct ActivityRowRecord: Record {
  @Field var key: String = ""
  @Field var childIndex: Int = 0
  @Field var nativeContent: Bool = false
  @Field var selectable: Bool = false
  @Field var canDelete: Bool = false
  @Field var deletionDisabled: Bool = false
  @Field var actionTitle: String = "Delete"
  @Field var actionColor: UIColor?
  @Field var actionIcon: String = "trash"
  @Field var height: Double = 0
  @Field var preview: ActivityPreviewRecord?
  @Field var previewActions: [ActivityPreviewActionRecord] = []
  @Field var settings: ActivitySettingsRowRecord?
}

struct ActivitySettingsRowRecord: Record, Equatable {
  @Field var title: String = ""
  @Field var value: String?
  @Field var subtitle: String?
  @Field var symbol: String = ""
  @Field var identity: Bool = false
  @Field var enabled: Bool = true
  @Field var destructive: Bool = false
  @Field var showsDisclosure: Bool = true
  @Field var imageUri: String?
  @Field var avatar: Bool = false
  @Field var avatarFallback: ActivityAvatarFallbackRecord?
  @Field var valueTone: String = "muted"
  @Field var balances: [ActivityBalanceRecord] = []
  @Field var disclosure: Bool = false
  @Field var toggleValue: Bool?
  @Field var details: [ActivitySettingsDetailRecord] = []

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.title == rhs.title && lhs.value == rhs.value && lhs.subtitle == rhs.subtitle
      && lhs.symbol == rhs.symbol && lhs.identity == rhs.identity && lhs.enabled == rhs.enabled
      && lhs.destructive == rhs.destructive && lhs.showsDisclosure == rhs.showsDisclosure
      && lhs.imageUri == rhs.imageUri && lhs.avatar == rhs.avatar && lhs.avatarFallback == rhs.avatarFallback
      && lhs.valueTone == rhs.valueTone && lhs.balances == rhs.balances
      && lhs.disclosure == rhs.disclosure && lhs.toggleValue == rhs.toggleValue
      && lhs.details == rhs.details
  }
}

struct ActivityBalanceRecord: Record, Equatable {
  @Field var label: String = ""
  @Field var value: String = ""
  @Field var color: UIColor = .secondaryLabel

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.label == rhs.label && lhs.value == rhs.value && lhs.color == rhs.color
  }
}

struct ActivityAvatarFallbackRecord: Record, Equatable {
  @Field var initials: String = ""
  @Field var backgroundColor: UIColor = .secondarySystemFill
  @Field var foregroundColor: UIColor = .secondaryLabel
  @Field var rounded: Bool = false

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.initials == rhs.initials && lhs.backgroundColor == rhs.backgroundColor
      && lhs.foregroundColor == rhs.foregroundColor && lhs.rounded == rhs.rounded
  }
}

struct ActivitySettingsDetailRecord: Record, Equatable {
  @Field var title: String = ""
  @Field var value: String = ""
  @Field var tone: String = "muted"

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.title == rhs.title && lhs.value == rhs.value && lhs.tone == rhs.tone
  }
}

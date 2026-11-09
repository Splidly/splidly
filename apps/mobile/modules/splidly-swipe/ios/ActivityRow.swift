import ExpoModulesCore
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
  var preview: ActivityPreviewRecord? = nil
  var previewActions: [ActivityPreviewActionRecord] = []
  var selectable: Bool = false
  var settings: ActivitySettingsRowRecord? = nil
}

struct ActivityPreviewActionRecord: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var symbol: String = ""
  @Field var destructive: Bool = false
  @Field var disabled: Bool = false
}

struct ActivityPreviewDetailRecord: Record {
  @Field var label: String = ""
  @Field var value: String = ""
  @Field var tone: String = "neutral"
  @Field var subtitle: String?
}

struct ActivityPreviewRecord: Record {
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var symbol: String = ""
  @Field var imageUrl: String?
  @Field var avatarFallback: ActivityAvatarFallbackRecord?
  @Field var headline: String = ""
  @Field var caption: String = ""
  @Field var tone: String = "neutral"
  @Field var details: [ActivityPreviewDetailRecord] = []
  @Field var debts: [ActivityPreviewDetailRecord] = []
  @Field var debtNote: String?
}

// A separate, read-only view keeps the source cell and its swipe state intact.
struct ActivityPreviewCard: View {
  let preview: ActivityPreviewRecord

  private func color(_ tone: String) -> Color {
    switch tone {
    case "positive": .green
    case "negative": .red
    default: .primary
    }
  }

  @ViewBuilder private var symbol: some View {
    if let avatar = preview.avatarFallback {
      Text(avatar.initials)
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(Color(uiColor: avatar.foregroundColor))
        .frame(width: 60, height: 60)
        .background(Color(uiColor: avatar.backgroundColor), in: Circle())
    } else {
      Image(systemName: preview.symbol)
        .font(.system(size: 25, weight: .semibold))
        .foregroundStyle(Color(uiColor: .systemIndigo))
        .frame(width: 60, height: 60)
        .background(Color(uiColor: .systemIndigo).opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
    }
  }

  private var localImage: UIImage? {
    guard let uri = preview.imageUrl else { return nil }
    if uri.hasPrefix("data:image/"), let payload = uri.split(separator: ",", maxSplits: 1).last,
      let data = Data(base64Encoded: String(payload)) { return UIImage(data: data) }
    if let url = URL(string: uri), url.isFileURL { return UIImage(contentsOfFile: url.path) }
    return nil
  }

  @ViewBuilder private var picture: some View {
    if let image = localImage {
      Image(uiImage: image).resizable().scaledToFill()
    } else {
      AsyncImage(url: preview.imageUrl.flatMap(URL.init(string:))) { image in
        image.resizable().scaledToFill()
      } placeholder: { symbol }
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 22) {
      HStack(alignment: .center, spacing: 14) {
        picture
          .frame(width: 60, height: 60)
          .clipShape(RoundedRectangle(cornerRadius: preview.avatarFallback == nil ? 18 : 30))
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 4) {
          Text(preview.title).font(.title3.weight(.bold)).fixedSize(horizontal: false, vertical: true)
          Text(preview.subtitle).font(.subheadline).foregroundStyle(.secondary)
        }
      }
      VStack(alignment: .leading, spacing: 4) {
        Text(preview.headline)
          .font(.system(.largeTitle, design: .rounded, weight: .bold))
          .foregroundStyle(color(preview.tone))
          .monospacedDigit()
          .fixedSize(horizontal: false, vertical: true)
        Text(preview.caption).font(.subheadline).foregroundStyle(.secondary)
      }
      if !preview.debts.isEmpty {
        VStack(alignment: .leading, spacing: 12) {
          Divider()
          Text("Who owes whom").font(.subheadline.weight(.semibold))
          ForEach(Array(preview.debts.enumerated()), id: \.offset) { _, debt in
            HStack(alignment: .firstTextBaseline, spacing: 16) {
              VStack(alignment: .leading, spacing: 3) {
                Text(debt.label).font(.subheadline)
                if let subtitle = debt.subtitle {
                  Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
              }
              Spacer(minLength: 0)
              Text(debt.value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color(debt.tone))
                .monospacedDigit()
                .fixedSize(horizontal: true, vertical: true)
            }
            .fixedSize(horizontal: false, vertical: true)
          }
          if let note = preview.debtNote {
            Text(note).font(.caption).foregroundStyle(.secondary)
          }
        }
      }
      if !preview.details.isEmpty {
        VStack(spacing: 12) {
          Divider()
          ForEach(Array(preview.details.enumerated()), id: \.offset) { _, detail in
            HStack(alignment: .firstTextBaseline, spacing: 16) {
              Text(detail.label).foregroundStyle(.secondary)
              Spacer(minLength: 0)
              Text(detail.value)
                .fontWeight(.medium)
                .foregroundStyle(color(detail.tone))
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
            }
            .font(.subheadline)
            .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
    }
    .padding(24)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color(uiColor: .secondarySystemGroupedBackground))
    .textSelection(.disabled)
  }
}

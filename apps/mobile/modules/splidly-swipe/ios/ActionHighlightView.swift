import ExpoModulesCore
import SwiftUI
import UIKit

final class ActionHighlightProps: ExpoSwiftUI.ViewProps {
  @Field var cornerRadius: CGFloat = 0
  @Field var backgroundColor: UIColor?
}

private struct ActionHighlightButtonStyle: ButtonStyle {
  let cornerRadius: CGFloat
  let backgroundColor: UIColor

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
      // Tint the surface behind the label so text and icons keep their colors.
      .background {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
          .fill(Color(uiColor: backgroundColor))
          .overlay {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
              .fill(configuration.isPressed ? Color(uiColor: .tertiarySystemFill) : .clear)
          }
          .allowsHitTesting(false)
          .accessibilityHidden(true)
      }
  }
}

struct ActionHighlightView: ExpoSwiftUI.View {
  @ObservedObject var props: ActionHighlightProps

  var body: some View {
    Children()
      .buttonStyle(ActionHighlightButtonStyle(
        cornerRadius: props.cornerRadius, backgroundColor: props.backgroundColor ?? .clear))
      .textSelection(.disabled)
  }
}

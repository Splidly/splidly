package expo.modules.splidlyswipe

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.views.ComposeProps
import java.util.Locale
import kotlin.math.roundToInt

data class GroupColorPickerProps(val color: android.graphics.Color? = null) : ComposeProps
data class GroupColorSelectedEvent(@Field val color: String) : Record

class GroupColorPickerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SplidlyColorPicker")
    View<GroupColorPickerProps>("ColorPickerView") {
      val onConfirm by Event<GroupColorSelectedEvent>()
      val onDismiss by Event<Unit>()
      Content { props ->
        GroupColorDialog(
          initialColor = props.color?.toArgb() ?: 0xFF5856D6.toInt(),
          onConfirm = { onConfirm(GroupColorSelectedEvent(it)) },
          onDismiss = { onDismiss(Unit) }
        )
      }
    }
  }
}

private fun colorHex(color: Color) = String.format(Locale.ROOT, "#%06X", color.toArgb() and 0xFFFFFF)
private fun colorHsv(color: Int) = FloatArray(3).also { android.graphics.Color.colorToHSV(color, it) }
private val hexPattern = Regex("^#[0-9A-F]{6}$")

@Composable
private fun GroupColorDialog(initialColor: Int, onConfirm: (String) -> Unit, onDismiss: () -> Unit) {
  val initial = remember(initialColor) { colorHsv(initialColor) }
  var hue by remember(initialColor) { mutableFloatStateOf(initial[0]) }
  var saturation by remember(initialColor) { mutableFloatStateOf(initial[1]) }
  var brightness by remember(initialColor) { mutableFloatStateOf(initial[2]) }
  var hex by remember(initialColor) { mutableStateOf(colorHex(Color(initialColor))) }
  val valid = hexPattern.matches(hex)
  val selectedColor = Color.hsv(hue, saturation, brightness)

  fun update(h: Float = hue, s: Float = saturation, v: Float = brightness) {
    hue = h.coerceIn(0f, 360f)
    saturation = s.coerceIn(0f, 1f)
    brightness = v.coerceIn(0f, 1f)
    hex = colorHex(Color.hsv(hue, saturation, brightness))
  }

  AlertDialog(
    onDismissRequest = onDismiss,
    containerColor = MaterialTheme.colorScheme.surface,
    title = { Text("Custom color", fontSize = 22.sp, fontWeight = FontWeight.SemiBold) },
    text = {
      Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
      ) {
        PickerCanvas(
          modifier = Modifier.fillMaxWidth().aspectRatio(1.5f).clip(RoundedCornerShape(14.dp))
            .semantics {
              contentDescription = "Saturation and brightness"
              stateDescription = "Saturation ${(saturation * 100).roundToInt()}%, brightness ${(brightness * 100).roundToInt()}%"
              customActions = listOf(
                CustomAccessibilityAction("Increase saturation") { update(s = saturation + 0.05f); true },
                CustomAccessibilityAction("Decrease saturation") { update(s = saturation - 0.05f); true },
                CustomAccessibilityAction("Increase brightness") { update(v = brightness + 0.05f); true },
                CustomAccessibilityAction("Decrease brightness") { update(v = brightness - 0.05f); true }
              )
            },
          onPosition = { point, bounds ->
            update(s = point.x / bounds.width, v = 1f - point.y / bounds.height)
          }
        ) {
          drawRect(Brush.horizontalGradient(listOf(Color.White, Color.hsv(hue, 1f, 1f))))
          drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color.Black)))
          val radius = 8.dp.toPx()
          val marker = Offset(
            (saturation * size.width).coerceIn(radius, size.width - radius),
            ((1f - brightness) * size.height).coerceIn(radius, size.height - radius)
          )
          drawCircle(Color.Black.copy(alpha = 0.45f), radius + 1.dp.toPx(), marker, style = Stroke(3.dp.toPx()))
          drawCircle(Color.White, radius, marker, style = Stroke(2.dp.toPx()))
        }

        PickerCanvas(
          modifier = Modifier.fillMaxWidth().height(48.dp).semantics {
            contentDescription = "Hue"
            progressBarRangeInfo = ProgressBarRangeInfo(hue, 0f..360f)
            setProgress { update(h = it); true }
          },
          onPosition = { point, bounds -> update(h = point.x / bounds.width * 360f) }
        ) {
          val trackHeight = 16.dp.toPx()
          drawRoundRect(
            brush = Brush.horizontalGradient(listOf(Color.Red, Color.Yellow, Color.Green, Color.Cyan, Color.Blue, Color.Magenta, Color.Red)),
            topLeft = Offset(0f, (size.height - trackHeight) / 2),
            size = Size(size.width, trackHeight),
            cornerRadius = CornerRadius(trackHeight / 2)
          )
          val radius = 11.dp.toPx()
          val marker = Offset(radius + hue / 360f * (size.width - 2 * radius), size.height / 2)
          drawCircle(Color.hsv(hue, 1f, 1f), radius, marker)
          drawCircle(Color.White, radius, marker, style = Stroke(3.dp.toPx()))
          drawCircle(Color.Black.copy(alpha = 0.2f), radius + 1.dp.toPx(), marker, style = Stroke(1.dp.toPx()))
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
          Spacer(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(selectedColor)
            .semantics { contentDescription = "Selected color ${colorHex(selectedColor)}" })
          OutlinedTextField(
            value = hex.removePrefix("#"),
            onValueChange = { raw ->
              hex = "#" + raw.removePrefix("#").take(6).uppercase(Locale.ROOT)
              if (hexPattern.matches(hex)) {
                val hsv = colorHsv(android.graphics.Color.parseColor(hex))
                hue = hsv[0]
                saturation = hsv[1]
                brightness = hsv[2]
              }
            },
            label = { Text("Hex color") },
            prefix = { Text("#") },
            singleLine = true,
            isError = !valid,
            supportingText = if (!valid) { { Text("Use six hex digits") } } else null,
            textStyle = MaterialTheme.typography.bodyLarge.copy(fontFamily = FontFamily.Monospace),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (valid) onConfirm(hex) }),
            modifier = Modifier.weight(1f)
          )
        }
      }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    confirmButton = { Button(enabled = valid, onClick = { onConfirm(hex) }) { Text("Done") } }
  )
}

/** Native drawing and pointer handling keep color dragging off the JS bridge. */
@Composable
private fun PickerCanvas(
  modifier: Modifier,
  onPosition: (Offset, IntSize) -> Unit,
  onDraw: DrawScope.() -> Unit
) {
  val positionChanged by rememberUpdatedState(onPosition)
  var bounds by remember { mutableStateOf(IntSize.Zero) }
  Canvas(
    modifier.onSizeChanged { bounds = it }.pointerInput(Unit) {
      awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        if (bounds.width > 0 && bounds.height > 0) positionChanged(down.position, bounds)
        down.consume()
        do {
          val event = awaitPointerEvent()
          val change = event.changes.firstOrNull { it.id == down.id }
          if (change != null) {
            if (change.pressed && bounds.width > 0 && bounds.height > 0) positionChanged(change.position, bounds)
            change.consume()
          }
        } while (event.changes.any { it.id == down.id && it.pressed })
      }
    },
    onDraw = onDraw
  )
}

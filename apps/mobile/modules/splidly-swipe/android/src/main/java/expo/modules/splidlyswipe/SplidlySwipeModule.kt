package expo.modules.splidlyswipe

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ComposeProps
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

data class ExpenseSwipeProps(
  val enabled: Boolean = true,
  val actionTitle: String = "Delete",
  val actionIcon: String = "trash",
  val closeRequest: Int = 0,
  val deleteLabel: String = "Delete expense",
  val backgroundColor: android.graphics.Color? = null
) : ComposeProps

class SplidlySwipeModule : Module() {
  // Opening a second row closes the previous one, including across native Hosts.
  private var openRow by mutableStateOf<Any?>(null)

  override fun definition() = ModuleDefinition {
    Name("SplidlySwipe")
    View<ExpenseSwipeProps>("ExpenseSwipeView") {
      val onDelete by Event<Unit>()
      val onRevealChange by Event<Map<String, Boolean>>()
      Content { props ->
        val row = remember { Any() }
        val scope = rememberCoroutineScope()
        val requestDelete by rememberUpdatedState { onDelete(Unit) }
        val enabled by rememberUpdatedState(props.enabled)
        val actionWidth = with(LocalDensity.current) { 88.dp.toPx() }
        val flingThreshold = with(LocalDensity.current) { 400.dp.toPx() }
        val direction = if (LocalLayoutDirection.current == LayoutDirection.Rtl) -1f else 1f
        var reveal by remember { mutableFloatStateOf(0f) }
        var dragging by remember { mutableStateOf(false) }
        var requesting by remember { mutableStateOf(false) }
        var settling by remember { mutableStateOf<Job?>(null) }

        fun settle(target: Float) {
          settling?.cancel()
          settling = scope.launch {
            animate(reveal, target, animationSpec = spring(dampingRatio = 1f, stiffness = 600f)) { value, _ ->
              reveal = value.coerceIn(0f, actionWidth)
            }
            if (target == 0f && openRow === row) openRow = null
          }
        }
        fun performAction() {
          if (!enabled || requesting) return
          requesting = true
          settling?.cancel()
          settling = scope.launch {
            // Restore the row before presenting its existing confirmation.
            animate(reveal, 0f, animationSpec = spring(dampingRatio = 1f, stiffness = 600f)) { value, _ ->
              reveal = value.coerceIn(0f, actionWidth)
            }
            if (openRow === row) openRow = null
            if (enabled) requestDelete()
            requesting = false
          }
        }
        LaunchedEffect(openRow, props.enabled) {
          if ((!props.enabled || openRow !== row) && reveal > 0f && !requesting) settle(0f)
        }
        DisposableEffect(Unit) {
          onDispose { if (openRow === row) openRow = null }
        }
        LaunchedEffect(props.closeRequest) {
          if (reveal > 0f && !requesting) settle(0f)
        }
        val isOpen = reveal > 0f
        LaunchedEffect(isOpen) { onRevealChange(mapOf("open" to isOpen)) }

        Box(Modifier.fillMaxWidth()
          .semantics {
            customActions = if (props.enabled) listOf(
              CustomAccessibilityAction(props.deleteLabel) { performAction(); true }
            ) else emptyList()
          }
          .draggable(
            state = rememberDraggableState { delta ->
              reveal = (reveal - delta * direction).coerceIn(0f, actionWidth)
            },
            orientation = Orientation.Horizontal,
            enabled = props.enabled && !requesting,
            onDragStarted = { settling?.cancel(); dragging = true; openRow = row },
            onDragStopped = { velocity ->
              dragging = false
              val openingVelocity = -velocity * direction
              val open = when {
                openingVelocity > flingThreshold -> true
                openingVelocity < -flingThreshold -> false
                else -> reveal >= actionWidth / 2f
              }
              // A swipe only reveals or closes. It never executes an action.
              settle(if (open) actionWidth else 0f)
            }
          )
        ) {
          if (props.enabled && reveal > 0f) {
            Box(Modifier.matchParentSize(), contentAlignment = Alignment.CenterEnd) {
              Column(
                modifier = Modifier.width(88.dp).fillMaxHeight().padding(4.dp)
                  .clip(RoundedCornerShape(14.dp))
                  .background(props.backgroundColor?.let { Color(it.toArgb()) } ?: Color.Red)
                  .clickable(enabled = !dragging && !requesting, role = Role.Button, onClickLabel = props.deleteLabel) { performAction() }
                  .semantics { contentDescription = props.deleteLabel }
                  .padding(horizontal = 4.dp, vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterVertically)
              ) {
                SwipeActionIcon(props.actionIcon)
                Text(props.actionTitle, color = Color.White, fontSize = 13.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium)
              }
            }
          }
          Box(Modifier.offset { IntOffset((-reveal * direction).roundToInt(), 0) }) {
            Children(composableScope)
            if (reveal > 0f && !dragging) {
              Box(Modifier.matchParentSize().clearAndSetSemantics { }.clickable { settle(0f) })
            }
          }
        }
      }
    }
  }
}

@Composable
private fun SwipeActionIcon(name: String) {
  Canvas(Modifier.size(24.dp).clearAndSetSemantics { }) {
    val scale = size.width / 24f
    val stroke = 1.8f * scale
    fun line(x1: Float, y1: Float, x2: Float, y2: Float) = drawLine(
      Color.White, Offset(x1 * scale, y1 * scale), Offset(x2 * scale, y2 * scale), stroke, StrokeCap.Round
    )
    when (name) {
      "archivebox" -> {
        drawRect(Color.White, Offset(4f * scale, 8f * scale), Size(16f * scale, 13f * scale), style = Stroke(stroke))
        drawRect(Color.White, Offset(3f * scale, 3f * scale), Size(18f * scale, 5f * scale), style = Stroke(stroke))
        line(9f, 12f, 15f, 12f)
      }
      "arrow.uturn.backward" -> {
        val path = Path().apply {
          moveTo(7f * scale, 7f * scale); lineTo(14f * scale, 7f * scale)
          cubicTo(23f * scale, 7f * scale, 23f * scale, 21f * scale, 14f * scale, 21f * scale)
        }
        drawPath(path, Color.White, style = Stroke(stroke, cap = StrokeCap.Round))
        line(7f, 7f, 12f, 2f); line(7f, 7f, 12f, 12f)
      }
      "person.badge.minus" -> {
        drawCircle(Color.White, 4f * scale, Offset(9f * scale, 7f * scale), style = Stroke(stroke))
        val path = Path().apply {
          moveTo(2f * scale, 21f * scale)
          cubicTo(2f * scale, 12f * scale, 16f * scale, 12f * scale, 16f * scale, 21f * scale)
        }
        drawPath(path, Color.White, style = Stroke(stroke, cap = StrokeCap.Round))
        line(17f, 11f, 23f, 11f)
      }
      else -> {
        line(4f, 6f, 20f, 6f); line(9f, 3f, 15f, 3f)
        line(6f, 6f, 7f, 21f); line(7f, 21f, 17f, 21f); line(17f, 21f, 18f, 6f)
        line(10f, 10f, 10f, 17f); line(14f, 10f, 14f, 17f)
      }
    }
  }
}

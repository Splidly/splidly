package expo.modules.splidlyswipe

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ComposeProps
import kotlinx.coroutines.launch

data class ExpenseSwipeProps(
  val enabled: Boolean = true,
  val deleteLabel: String = "Delete expense",
  val backgroundColor: android.graphics.Color? = null
) : ComposeProps

class SplidlySwipeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SplidlySwipe")

    View<ExpenseSwipeProps>("ExpenseSwipeView") {
      val onDelete by Event<Unit>()

      Content { props ->
        val enabled = rememberUpdatedState(props.enabled)
        val requestDelete = rememberUpdatedState { onDelete(Unit) }
        val state = rememberSwipeToDismissBoxState()
        val scope = rememberCoroutineScope()
        val dismiss = remember(state) {
          { value: SwipeToDismissBoxValue ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
              scope.launch {
                // Restore the native row before requesting confirmation. The
                // server owns removal, including cancellation and failures.
                state.reset()
                if (enabled.value) requestDelete.value()
              }
            }
          }
        }
        SwipeToDismissBox(
          state = state,
          enableDismissFromStartToEnd = false,
          enableDismissFromEndToStart = props.enabled,
          gesturesEnabled = props.enabled,
          onDismiss = dismiss,
          modifier = Modifier.semantics {
            customActions = if (props.enabled) listOf(
              CustomAccessibilityAction(props.deleteLabel) {
                requestDelete.value()
                true
              }
            ) else emptyList()
          },
          backgroundContent = {
            Box(
              modifier = Modifier.fillMaxSize()
                .clearAndSetSemantics { }
                .background(props.backgroundColor?.let { Color(it.toArgb()) } ?: Color.Red)
                .padding(horizontal = 24.dp),
              contentAlignment = Alignment.CenterEnd
            ) {
              Text("Delete", color = Color.White)
            }
          }
        ) {
          Children(composableScope)
        }
      }
    }
  }
}

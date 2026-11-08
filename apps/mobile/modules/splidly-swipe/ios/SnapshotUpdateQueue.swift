import Foundation

@MainActor
final class SnapshotUpdateQueue {
  typealias Operation = @MainActor (@escaping @MainActor () -> Void) -> Void
  private var pending: [Operation] = []
  private var running = false

  func enqueue(_ operation: @escaping Operation) {
    pending.append(operation)
    startNext()
  }

  private func startNext() {
    guard !running, !pending.isEmpty else { return }
    running = true
    let operation = pending.removeFirst()
    // UIKit can call completion synchronously, especially before first layout.
    // Neither an apply nor its successor may run on the caller's apply stack.
    DispatchQueue.main.async { [weak self] in
      var completed = false
      operation {
        guard !completed else { return }
        completed = true
        DispatchQueue.main.async { [weak self] in
          self?.running = false
          self?.startNext()
        }
      }
    }
  }
}

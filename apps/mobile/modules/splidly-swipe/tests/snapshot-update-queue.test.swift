import Foundation

@main
struct SnapshotUpdateQueueTests {
  @MainActor static func main() async {
    await synchronousReentrantCompletion()
    await asynchronousCompletion()
    print("SnapshotUpdateQueue: synchronous reentrancy, FIFO, duplicate completion and asynchronous serialization passed")
  }

  @MainActor private static func synchronousReentrantCompletion() async {
    let queue = SnapshotUpdateQueue()
    var events: [String] = []
    var depth = 0
    await withCheckedContinuation { (end: CheckedContinuation<Void, Never>) in
      queue.enqueue { finished in
        depth += 1
        events.append("first-enter")
        queue.enqueue { nextFinished in
          precondition(depth == 0, "A nested snapshot started on the first apply stack")
          events.append("nested")
          nextFinished()
        }
        finished()
        finished() // A duplicate UIKit completion must not drain twice.
        events.append("first-exit")
        depth -= 1
      }
      precondition(events.isEmpty, "A snapshot started synchronously during submit")
      queue.enqueue { finished in
        precondition(depth == 0)
        events.append("second")
        finished()
      }
      queue.enqueue { finished in
        events.append("third")
        finished()
        queue.enqueue { lastFinished in
          precondition(events == ["first-enter", "first-exit", "second", "third", "nested"])
          lastFinished()
          end.resume()
        }
      }
    }
  }

  @MainActor private static func asynchronousCompletion() async {
    let queue = SnapshotUpdateQueue()
    var finishFirst: (@MainActor () -> Void)?
    var secondStarted = false
    await withCheckedContinuation { (started: CheckedContinuation<Void, Never>) in
      queue.enqueue { finished in
        finishFirst = finished
        started.resume()
      }
      queue.enqueue { finished in
        secondStarted = true
        finished()
      }
    }
    precondition(!secondStarted, "A snapshot overlapped an unfinished async apply")
    finishFirst?()
    await withCheckedContinuation { (end: CheckedContinuation<Void, Never>) in
      queue.enqueue { finished in
        precondition(secondStarted)
        finished()
        end.resume()
      }
    }
  }
}

import Foundation
import SwiftUI

final class GestureStateManager: ObservableObject {
    private var isDragging = false
    private var dragStartTime: Date? = nil
    private var lastGestureEndTime: Date? = nil
    private var cleanupTask: DispatchWorkItem?

    func startDrag() {
        isDragging = true
        dragStartTime = Date()
    }

    func endDrag(didTriggerNavigation: Bool = false) {
        cleanupTask?.cancel()
        lastGestureEndTime = Date()
        isDragging = false

        let blockDuration: TimeInterval = didTriggerNavigation ? 0.5 : 0.1
        let task = DispatchWorkItem { [weak self] in
            self?.dragStartTime = nil
            self?.lastGestureEndTime = nil
        }
        cleanupTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + blockDuration, execute: task)
    }

    var shouldBlockTaps: Bool {
        if let endTime = lastGestureEndTime,
            Date().timeIntervalSince(endTime) < 0.5
        {
            return true
        }
        if isDragging { return true }
        if let startTime = dragStartTime,
            Date().timeIntervalSince(startTime) < 0.3
        {
            return true
        }
        return false
    }
}

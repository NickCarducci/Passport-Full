import SwiftUI

struct QuietButton<Label: View>: View {
    @EnvironmentObject private var gestureState: GestureStateManager
    let action: () -> Void
    let label: () -> Label

    var body: some View {
        Button(action: {
            if !gestureState.shouldBlockTaps {
                action()
            }
        }) {
            label()
        }
    }
}

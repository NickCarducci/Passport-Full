import SwiftUI

struct ScrollPositionTracker: View {
    enum Position {
        case top
        case bottom
    }

    let position: Position
    let coordinateSpaceName: String
    let screenHeight: CGFloat?
    let topThreshold: CGFloat
    let bottomThreshold: CGFloat
    @Binding var isAtEdge: Bool

    init(
        _ position: Position,
        in coordinateSpaceName: String,
        screenHeight: CGFloat? = nil,
        topThreshold: CGFloat = -10,
        bottomThreshold: CGFloat = 50,
        isAtEdge: Binding<Bool>
    ) {
        self.position = position
        self.coordinateSpaceName = coordinateSpaceName
        self.screenHeight = screenHeight
        self.topThreshold = topThreshold
        self.bottomThreshold = bottomThreshold
        self._isAtEdge = isAtEdge
    }

    var body: some View {
        GeometryReader { geo in
            let currentValue =
                position == .top
                ? geo.frame(in: .named(coordinateSpaceName)).minY
                : geo.frame(in: .named(coordinateSpaceName)).maxY

            Color.clear
                .onChange(of: currentValue) { _, newValue in
                    updateEdgeState(value: newValue)
                }
                .onAppear {
                    updateEdgeState(value: currentValue)
                }
                .onDisappear {
                    isAtEdge = false
                }
        }
        .frame(height: 1)
    }

    private func updateEdgeState(value: CGFloat) {
        switch position {
        case .top:
            isAtEdge = value >= topThreshold
        case .bottom:
            if let screenHeight = screenHeight {
                isAtEdge = value <= screenHeight + bottomThreshold
            } else {
                isAtEdge = value <= bottomThreshold
            }
        }
    }
}

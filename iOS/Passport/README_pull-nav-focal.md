# Pull Navigation - Focal Architecture Pattern

## Overview

This document describes a gesture-based navigation system using a **focal point architecture** where one central overlay sits atop multiple underlays that can be revealed through gestures. Unlike traditional carousel navigation, this pattern establishes a hub-and-spoke model with a single focal view as the primary interface.

## Focal Point Architecture

```
Central View (OVERLAY - Focal Point)
     ↑ Pull Down
     ↓ Top Underlay

     ← Swipe Right
Left Underlay A → Left Underlay B (Stacked)

     Swipe Left →
Right Underlay A ← Right Underlay B (Stacked)
```

### Key Concept: Focal vs Traditional

**Traditional Navigation:**
```
Page 1 ⟷ Page 2 ⟷ Page 3
(Horizontal carousel, all equal)
```

**Focal Navigation:**
```
       Top View (pull down)
          ↓ ↑
Left A ← Central → Right A
          ↓ ↑
Left B ←  Right B (stacked)
```

The **central view is the focal point** - it's always the primary interface that users return to. Underlays are **supporting contexts** revealed through gestures.

## Architecture

### View Hierarchy

```
ContentView
└── GeometryReader (screen dimensions)
    └── ZStack
        ├── UNDERLAY LAYER (Background)
        │   ├── TopView (revealed via pull-down)
        │   ├── LeftViewA (revealed via swipe-right)
        │   ├── LeftViewB (revealed via swipe-right from LeftViewA)
        │   ├── RightViewA (revealed via swipe-left)
        │   └── RightViewB (revealed via swipe-left from RightViewA)
        │
        ├── OVERLAY LAYER (Foreground - Focal)
        │   └── CentralView (always rendered)
        │
        └── CHROME LAYER (Always visible)
            ├── Header (adapts to current mode)
            └── Navigation Indicators (tappable shortcuts)
```

### State Management

```swift
enum UnderlayMode {
    case none       // Central view focal (default)
    case leftA      // Left view A revealed
    case leftB      // Left view B revealed
    case topView    // Top view pulled down
    case rightA     // Right view A revealed
    case rightB     // Right view B revealed
}

@State private var underlayMode: UnderlayMode = .none
@State private var gestureOffsets = GestureOffsetState()
@StateObject private var gestureState = GestureStateManager()
```

## Gesture System

### 1. Directional Gestures

Each underlay has specific reveal gestures:

| Underlay      | Reveal Gesture | Offset When Visible | Offset When Hidden       |
| ------------- | -------------- | ------------------- | ------------------------ |
| Top View      | Pull Down      | y: 0                | y: -screenHeight         |
| Left View A   | Swipe Right    | x: 0                | x: -screenWidth          |
| Left View B   | Swipe Right    | x: 0                | x: -screenWidth          |
| Right View A  | Swipe Left     | x: 0                | x: screenWidth           |
| Right View B  | Swipe Left     | x: 0                | x: screenWidth           |
| Central View  | (Focal)        | x/y: 0              | (moves opposite of active underlay) |

### 2. Jitter-Resistant Latch Logic

**Problem:** Touchscreen jitter can cause accidental navigation when scrolling.

**Solution:** Wait for 5+ points of movement in ONE direction before latching:

```swift
@State private var isGestureStarted = false
@State private var isPullAllowed = false

.onChanged { value in
    // LATCH LOGIC: Wait for meaningful movement before latching direction
    if !isGestureStarted {
        // Only latch once there's meaningful movement (> 5 points)
        if abs(verticalDrag) > 5 || abs(horizontalDrag) > 5 {
            isGestureStarted = true
            gestureState.startDrag()

            // CRITICAL: Check DOMINANT direction to avoid jitter
            let isDraggingDown = verticalDrag > 0 && abs(verticalDrag) > abs(horizontalDrag)

            // Latch pull permission based on scroll position and DOMINANT direction
            isPullAllowed = isAtTop && isDraggingDown
        } else {
            // Too early to determine direction, skip this frame
            return
        }
    }

    // Determine if primarily vertical or horizontal
    let isVertical = abs(verticalDrag) > abs(horizontalDrag)

    if isVertical && isPullAllowed {
        verticalPullOffset = verticalDrag
    } else if !isVertical {
        horizontalSwipeOffset = horizontalDrag
    }
}
```

**Why abs() is critical:**
- Real devices produce jitter: small opposite-direction noise
- Example: User swipes down, but touch reports: +5px, +8px, -1px, +12px
- Without `abs()`, that -1px could incorrectly latch as "swiping up"
- With `abs()`, we check MAGNITUDE: |+5| > threshold? |+8| > threshold? etc.

### 3. Offset Calculation System

#### Modular Underlay System

```swift
struct UnifiedUnderlay: View {
    let mode: UnderlayMode
    @Binding var underlayMode: UnderlayMode
    @Binding var horizontalSwipeOffset: CGFloat
    @Binding var verticalPullOffset: CGFloat

    var body: some View {
        UnderlayContainer(
            content: contentView,
            navigationHints: navigationHints,
            gestureConfig: gestureConfiguration
        )
    }

    private var gestureConfiguration: GestureConfiguration? {
        switch mode {
        case .leftA:
            return .init(
                swipeLeft: .init { underlayMode = .none },
                pullDown: .init(condition: { isAtTop }) {
                    underlayMode = .leftB
                }
            )
        case .topView:
            return .init(
                pullUp: .init(condition: { isAtBottom }) {
                    underlayMode = .none
                }
            )
        // ... other cases
        }
    }
}
```

#### Offset Helper Functions

```swift
private func horizontalOffset(
    for view: String,
    restPosition: CGFloat, // -1 for left, +1 for right, 0 for center
    activeIn activeModes: [UnderlayMode],
    screenWidth: CGFloat
) -> CGFloat {
    let restOffset = restPosition * screenWidth

    // If this view is active, it should be at 0 + gesture offset
    if activeModes.contains(underlayMode) {
        return gestureOffsets.horizontal
    }

    // If at focal point and swiping toward this view
    if underlayMode == .none {
        if restPosition < 0 && gestureOffsets.horizontal > 0 {
            // Swiping right to reveal left view
            return restOffset + gestureOffsets.horizontal
        } else if restPosition > 0 && gestureOffsets.horizontal < 0 {
            // Swiping left to reveal right view
            return restOffset + gestureOffsets.horizontal
        }
    }

    return restOffset
}
```

**Example Usage:**
```swift
.offset(
    x: horizontalOffset(
        for: "leftViewA",
        restPosition: -1,        // Left side
        activeIn: [.leftA],      // Active when in leftA mode
        screenWidth: screenGeometry.size.width
    ),
    y: underlayMode == .leftA ? 0 : screenGeometry.size.height
)
```

### 4. Interactive Transitions

All transitions are **interactive** - the user's finger controls the offset in real-time:

```swift
.offset(
    x: centralViewOffset(screenWidth: screenGeometry.size.width),
    y: underlayMode == .none ? gestureOffsets.vertical : 0
)
.animation(nil, value: gestureOffsets.horizontal)
.animation(nil, value: gestureOffsets.vertical)
.transaction { transaction in
    // Disable animations during dragging for immediate feedback
    if gestureOffsets.horizontal != 0 || gestureOffsets.vertical != 0 {
        transaction.animation = nil
    }
}
```

**Why `.animation(nil)`?**
- Prevents SwiftUI from animating offset changes during drag
- User's finger directly controls position = feels responsive
- Only animate on `.onEnded` when resetting

### 5. Navigation Triggering

```swift
.onEnded { value in
    var didTriggerNavigation = false

    // Check horizontal swipes (2:1 ratio for clarity)
    if abs(horizontalDrag) > abs(verticalDrag) * 2.0 {
        if horizontalDrag < -50 {
            underlayMode = .rightA
            didTriggerNavigation = true
        } else if horizontalDrag > 50 {
            underlayMode = .leftA
            didTriggerNavigation = true
        }
    }
    // Check vertical pulls
    else if isPullAllowed && verticalDrag > 120 {
        underlayMode = .topView
        didTriggerNavigation = true
    }

    gestureState.endDrag(didTriggerNavigation: didTriggerNavigation)

    if !didTriggerNavigation {
        // Reset with spring if gesture didn't complete
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            gestureOffsets.horizontal = 0
            gestureOffsets.vertical = 0
        }
    }
}
```

## Preventing Tap-Through

### The Problem

During swipe navigation, buttons on the destination view can queue tap events and fire after navigation completes.

### The Solution: QuietButton + GestureStateManager

**1. Use QuietButton for all interactive elements:**

```swift
// ❌ Regular Button - can tap-through
Button(action: { showDetail = true }) {
    Text("View Details")
}

// ✅ QuietButton - automatically blocks during gestures
QuietButton(action: { showDetail = true }) {
    Text("View Details")
}
```

**2. GestureStateManager tracks gesture state:**

```swift
class GestureStateManager: ObservableObject {
    // CRITICAL: NOT @Published to ensure synchronous reads
    // @Published causes async updates which creates race conditions
    private var isDragging = false
    private var dragStartTime: Date? = nil
    private var lastGestureEndTime: Date? = nil

    // Track cleanup task to prevent race conditions
    private var cleanupTask: DispatchWorkItem?

    func startDrag() {
        isDragging = true
        dragStartTime = Date()
    }

    func endDrag(didTriggerNavigation: Bool = false) {
        // Cancel any pending cleanup task FIRST
        cleanupTask?.cancel()

        // Set lastGestureEndTime BEFORE isDragging for immediate blocking
        lastGestureEndTime = Date()
        isDragging = false

        // Block taps for 0.5s after navigation, 0.1s otherwise
        let blockDuration: TimeInterval = didTriggerNavigation ? 0.5 : 0.1

        let task = DispatchWorkItem { [weak self] in
            self?.dragStartTime = nil
            self?.lastGestureEndTime = nil
        }
        cleanupTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + blockDuration, execute: task)
    }

    var shouldBlockTaps: Bool {
        // Check lastGestureEndTime FIRST for immediate blocking
        if let endTime = lastGestureEndTime,
           Date().timeIntervalSince(endTime) < 0.5 {
            return true
        }

        // Block during active drag
        if isDragging { return true }

        // Block during initial drag period
        if let startTime = dragStartTime,
           Date().timeIntervalSince(startTime) < 0.3 {
            return true
        }

        return false
    }
}
```

**3. QuietButton checks before executing:**

```swift
struct QuietButton<Label: View>: View {
    @EnvironmentObject private var gestureState: GestureStateManager

    let action: () -> Void
    let label: () -> Label

    var body: some View {
        Button(action: {
            // Only execute if taps are not blocked
            if !gestureState.shouldBlockTaps {
                action()
            }
        }) {
            label()
        }
    }
}
```

**4. Environment injection ensures single shared instance:**

```swift
// Root View - Create single instance
@StateObject private var gestureState = GestureStateManager()

// Inject into central view
CentralViewWithGestures(...)
    .environmentObject(gestureState)

// Inject into all underlays
UnderlayContainer(...) {
    AnyView(contentView
        .environmentObject(gestureState)
    )
}
```

**Critical: Single Instance Requirement**
- ✅ ONE `@StateObject` in root view creates the instance
- ✅ ALL views use `@EnvironmentObject` to receive it
- ❌ NEVER create new instances with `@StateObject` in child views
- ❌ Multiple instances cause tap-through (gestures update one, buttons read another)

**Benefits:**
- ✅ No `.disabled()` styling - full visual customization
- ✅ Synchronous state checking prevents race conditions
- ✅ Cleanup task cancellation prevents stuck blocking states
- ✅ Works for all buttons across all views
- ✅ Variable blocking duration (0.5s for navigation, 0.1s for scrolls)

## Scroll Position Detection - THE CRITICAL FIX

### The Problem: Both Conditions True Simultaneously

**CRITICAL BUG that only appears on real devices:**

Logs showed impossible state: `pullDownCond=true pullUpCond=true`

This caused pull navigation to trigger mid-scroll instead of only at edges.

### Root Cause: Multiple Views in Memory

SwiftUI's `switch mode` statement creates ALL view cases simultaneously, even though only one is displayed:

```swift
// ❌ PROBLEM: All views exist at once
switch mode {
case .leftA:
    LeftViewA(isAtTop: $isAtTop)  // Has TOP tracker
case .leftB:
    LeftViewB(isAtBottom: $isAtBottom)  // Has BOTTOM tracker
// ...
}
```

When viewing LeftViewA, BOTH views exist:
- LeftViewA's `ScrollPositionTracker(.top)` updates `$isAtTop`
- LeftViewB's `ScrollPositionTracker(.bottom)` updates `$isAtBottom`
- **Result:** Both conditions can be true = navigation triggers incorrectly!

### The Solution: Four-Layer Defense

#### 1. View Identity Management (Force Destruction)

```swift
switch mode {
case .leftA:
    LeftViewA(isAtTop: $isAtTop)
        .id("leftA-\(mode.hashValue)")  // ✅ Forces view destruction on mode change
case .leftB:
    LeftViewB(isAtBottom: $isAtBottom)
        .id("leftB-\(mode.hashValue)")  // ✅ Forces view destruction on mode change
}
```

**Why this works:**
- `.id()` tells SwiftUI to treat this as a NEW view when mode changes
- Old view (and its ScrollPositionTracker) is **destroyed**
- Only ONE view's tracker exists at a time

#### 2. Tracker Lifecycle Reset

```swift
struct ScrollPositionTracker: View {
    @Binding var isAtEdge: Bool

    var body: some View {
        GeometryReader { geo in
            Color.clear
                .onChange(of: currentValue) { _, newValue in
                    updateEdgeState(value: newValue)
                }
                .onAppear {
                    updateEdgeState(value: currentValue)
                }
                .onDisappear {
                    // ✅ CRITICAL: Reset when tracker is destroyed
                    isAtEdge = false
                }
        }
        .frame(height: 1)
    }
}
```

**Why this works:**
- When view is destroyed, `.onDisappear` fires immediately
- Resets the binding to `false` before new view's tracker initializes

#### 3. Mode Change Reset

```swift
struct UnifiedUnderlay: View {
    @State private var isAtTop = false
    @State private var isAtBottom = false

    var body: some View {
        UnderlayContainer(...)
            .onChange(of: mode) { oldMode, newMode in
                // ✅ CRITICAL: Reset both states when mode changes
                isAtTop = false
                isAtBottom = false
            }
    }
}
```

**Why this works:**
- Proactively resets BOTH conditions when switching views
- Happens before new view's tracker begins updating

#### 4. One Tracker Per View

**CRITICAL ARCHITECTURE RULE:**

Each view uses ONLY the tracker it needs:

| View           | Tracks TOP | Tracks BOTTOM | Navigation Purpose                     |
| -------------- | ---------- | ------------- | -------------------------------------- |
| LeftViewA      | ✅ Yes     | ❌ No         | Pull DOWN to navigate to LeftViewB     |
| LeftViewB      | ❌ No      | ✅ Yes        | Pull UP to navigate to LeftViewA       |
| RightViewA     | ✅ Yes     | ❌ No         | Pull DOWN to navigate to RightViewB    |
| TopView        | ❌ No      | ✅ Yes        | Pull UP to navigate to CentralView     |
| CentralView    | ✅ Yes     | ❌ No         | Pull DOWN to navigate to TopView       |

**Implementation:**

```swift
// ✅ LeftViewA - Only tracks TOP
struct LeftViewA: View {
    @Binding var isAtTop: Bool  // Only ONE binding

    var body: some View {
        ScrollView {
            LazyVStack {
                ScrollPositionTracker(.top, in: "leftAScrollSpace", isAtEdge: $isAtTop)
                // content...
            }
        }
        .coordinateSpace(name: "leftAScrollSpace")
    }
}

// ✅ LeftViewB - Only tracks BOTTOM
struct LeftViewB: View {
    @Binding var isAtBottom: Bool  // Only ONE binding

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                LazyVStack {
                    // content...
                    ScrollPositionTracker(.bottom, in: "leftBScrollSpace",
                                         screenHeight: geometry.size.height,
                                         isAtEdge: $isAtBottom)
                }
            }
            .coordinateSpace(name: "leftBScrollSpace")
        }
    }
}
```

### ScrollPositionTracker Implementation

```swift
struct ScrollPositionTracker: View {
    let position: Position
    let coordinateSpaceName: String
    let screenHeight: CGFloat?
    let topThreshold: CGFloat
    let bottomThreshold: CGFloat
    @Binding var isAtEdge: Bool

    enum Position {
        case top
        case bottom
    }

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
            let currentValue = position == .top
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
                    // CRITICAL: Reset state when tracker is destroyed
                    isAtEdge = false
                }
        }
        .frame(height: 1)
    }

    private func updateEdgeState(value: CGFloat) {
        switch position {
        case .top:
            // TOP tracker: User has scrolled to top of content
            // Marker's minY should be at or near 0 (visible at top of viewport)
            // Negative threshold (default: -10) allows for bounce tolerance
            isAtEdge = value >= topThreshold

        case .bottom:
            // BOTTOM tracker: User has scrolled to bottom of content
            // Marker's maxY should be visible within screen height
            // Positive threshold (default: +50) allows for bounce tolerance
            if let screenHeight = screenHeight {
                isAtEdge = value <= screenHeight + bottomThreshold
            } else {
                isAtEdge = value <= bottomThreshold
            }
        }
    }
}
```

### Verification: Reading the Logs

**Before the fix:**
```
16:43:59.847 Latch: pullDownCond=true pullUpCond=true  // ❌ IMPOSSIBLE STATE
16:44:07.863 Latch: pullDownCond=true pullUpCond=true  // ❌ Both trackers active!
```

**After the fix:**
```
17:27:08.620 Latch: pullDownCond=true pullUpCond=false   // ✅ Only at top
17:27:13.058 Latch: pullDownCond=false pullUpCond=true   // ✅ Only at bottom
17:27:23.066 Latch: pullDownCond=false pullUpCond=true   // ✅ Only at bottom
17:27:39.079 Latch: pullDownCond=false pullUpCond=true   // ✅ Only at bottom
```

The fix ensures only ONE condition is true at a time, preventing mid-scroll navigation triggers.

## Background App Freeze Prevention

**Problem:** App freezes when returning from background due to stuck gesture states.

**Solution:** Reset gesture state on scene phase change:

```swift
@Environment(\.scenePhase) private var scenePhase

.onChange(of: scenePhase) { oldPhase, newPhase in
    if oldPhase == .background && newPhase == .active {
        // Reset any stuck gesture states
        gestureOffsets.horizontal = 0
        gestureOffsets.vertical = 0
        gestureState.endDrag()
    }
}
```

## Navigation Indicators

### Overlay Indicators (Central View)

```swift
if underlayMode == .none {
    VStack {
        // Top: Pull down hint
        QuietButton(action: {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                underlayMode = .topView
            }
        }) {
            HStack {
                Image(systemName: "chevron.down")
                Text("Pull Down")
            }
        }
        .padding(.top, 70)

        Spacer()

        // Bottom: Swipe hints
        HStack {
            QuietButton(action: { underlayMode = .leftA }) {
                Text("← Left")
            }

            Spacer()

            QuietButton(action: { underlayMode = .rightA }) {
                Text("Right →")
            }
        }
    }
}
```

### Pull Indicators (Underlays)

```swift
VStack {
    HStack {
        Image(systemName: "arrow.down.circle.fill")
        Text("Pull for Navigation")
    }
    .offset(y: verticalPullOffset - 100)
    .opacity(isAtTop ? 1 : 0)
    .animation(.interactiveSpring, value: verticalPullOffset)

    Spacer()
}
.allowsHitTesting(false)
```

## Key Differences from Traditional Navigation

| Aspect                | Traditional Carousel          | Focal Architecture               |
| --------------------- | ----------------------------- | -------------------------------- |
| **Navigation Model**  | Carousel (equal pages)        | Hub & spoke (focal + underlays)  |
| **View Lifecycle**    | Pages lazy-loaded             | All views always rendered        |
| **Gesture Hierarchy** | Per-page gestures             | Global gesture on ZStack         |
| **State Management**  | `currentPage` index           | `underlayMode` enum              |
| **Offset Calculation**| Simple: `index * width`       | Modular: `horizontalOffset()`    |
| **Tap Blocking**      | N/A (no overlapping views)    | `QuietButton` + `GestureStateManager` |
| **Pull Direction**    | Up/down only                  | All 4 directions + pull-down     |
| **Scroll Tracking**   | Two trackers per view         | **One tracker per view**         |
| **View Identity**     | N/A                           | **`.id()` forces destruction**   |

## Testing Checklist

- [ ] Pull down at top reveals top view
- [ ] Swipe left reveals right view stack
- [ ] Swipe right reveals left view stack
- [ ] Indicators show only when at appropriate edges
- [ ] Interactive transitions follow finger
- [ ] Spring animations reset smoothly on release
- [ ] No tap-through on destination views after navigation
- [ ] Background/foreground doesn't freeze gestures
- [ ] Jitter doesn't trigger wrong navigation
- [ ] Haptic feedback fires on navigation
- [ ] All underlays can navigate back to focal point
- [ ] **CRITICAL:** Never see `pullDownCond=true pullUpCond=true` in logs
- [ ] Pull navigation only triggers at edges, not mid-scroll

## Performance Notes

- All underlays rendered at all times = higher memory usage
- Trade-off: Instant navigation, no loading states
- Use `LazyVStack` in all scrollable lists
- Keep gesture callbacks lightweight
- `Color.clear` for position trackers (zero cost)
- `.allowsHitTesting(false)` on all overlays prevents touch overhead
- **NEVER** use `.allowsHitTesting(!gestureState.shouldBlockTaps)` - causes 50+ checks per gesture

## Troubleshooting

### Tap-Through Issues

**Symptom:** Buttons work first time, then tap-through occurs during/after swipes

**Root Cause:** Multiple GestureStateManager instances
- Gesture handler updates instance A
- QuietButton reads from instance B
- Result: `shouldBlockTaps` always returns `false`

**Solution:**
```swift
// ✅ CORRECT - One instance in root view
@StateObject private var gestureState = GestureStateManager()

// ✅ Inject into ALL child views
CentralViewWithGestures(...).environmentObject(gestureState)
UnderlayContainer(...) { contentView.environmentObject(gestureState) }

// ❌ WRONG - Creates new instance
@StateObject private var gestureState = GestureStateManager()
```

### Pull Navigation Triggers Mid-Scroll

**Symptom:** Pull navigation activates when scrolling in middle of list, not just at edges

**Root Cause:** Both `isAtTop` and `isAtBottom` are true simultaneously

**Verification:** Check logs for impossible state:
```
pullDownCond=true pullUpCond=true  // ❌ BUG - both should never be true
```

**Solution:** Apply all four layers of defense:
1. Add `.id()` modifiers to views in switch statement
2. Ensure `.onDisappear` resets `isAtEdge = false` in ScrollPositionTracker
3. Add `.onChange(of: mode)` reset in UnifiedUnderlay
4. Use only ONE tracker per view (not both)

### Race Conditions

**Symptom:** `endDrag()` sets state, but `shouldBlockTaps` immediately returns `false`

**Root Cause #1:** Using `@Published` properties
- `@Published` causes async updates via Combine
- QuietButton reads stale values during button action callback

**Solution:** Remove `@Published`, use private properties for synchronous reads

**Root Cause #2:** Cleanup task clearing state too early
- Old gesture's cleanup runs after new gesture's `endDrag()`
- Clears the state we just set

**Solution:** Cancel previous cleanup task before setting new state:
```swift
cleanupTask?.cancel()
lastGestureEndTime = Date()
```

### Performance Issues / Freezing

**Symptom:** App freezes during rapid swipes, watchdog SIGSTOP

**Root Cause:** Excessive `shouldBlockTaps` checks
- `.allowsHitTesting(!gestureState.shouldBlockTaps)` on overlay
- Checks on every render frame (50+ per gesture)

**Solution:** Remove modifier, rely on QuietButton action callbacks:
```swift
// ❌ WRONG - Checks every render
.allowsHitTesting(!gestureState.shouldBlockTaps)

// ✅ CORRECT - Only checks when tapped
QuietButton(action: { /* checked here */ }) { ... }
```

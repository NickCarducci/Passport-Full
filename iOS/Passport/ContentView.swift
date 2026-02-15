//
//  ContentView.swift
//  Passport
//
//  Created by Nicholas Carducci on 9/7/24.
//
import Foundation
//import PromiseKit
import SwiftUI
import CodeScanner
import AVFoundation
import Firebase
import FirebaseAuth

let db = Firestore.firestore()
//import FirebaseMessaging
struct ContentView: View {
    //@AppStorage("username") var username: String = ""

    @Environment(\.scenePhase) var scenePhase
    @StateObject private var gestureState = GestureStateManager()

    @State var alertCamera = "Go to Settings, Passport, and then Allow Passport to Access: Camera"
    @State var address = ""
    @State var promptAddress = false
    @State var fullName = ""
    @State var username = ""
    @State var studentId = ""
    @State var addressLine1 = ""
    @State var addressLine2 = ""
    @State var city = ""
    @State var state = ""
    @State var zipCode = ""
    @State var phoneNumber = ""
    @State var countryCodeNumber = "+1"
    @State var country = ""
    @State var smsTextCode = ""
    #if targetEnvironment(simulator)
        @State var deniedCamera = true
    #else
        @State var deniedCamera = false
    #endif
    @State var loggedin = true
    @State var verificationId = ""
    @State var verifiable = false
    @State var testing = false
    //@State var session: User = User(coder: NSCoder())!
    @State private var showSimulatorAlert = false
    @State private var showPermissionAlert = false
    @State private var showScannerErrorAlert = false
    @State private var showDisabledAlert = false
    @State private var showLogoutConfirm = false
    @State private var authListenerHandle: AuthStateDidChangeListenerHandle?
    @State private var verticalDragOffset: CGFloat = 0
    @State private var horizontalDragOffset: CGFloat = 0
    @State private var isGestureStarted = false
    @State private var isPullAllowed = false
    #if targetEnvironment(simulator)
        @State private var cameraEnabled = false
    #else
        @State private var cameraEnabled = true
    #endif
    @State private var isAtTop = false
    @State private var showAuthErrorAlert = false
    @State private var authErrorMessage = "Sign-in failed. Please try again."
    @State private var isSigningIn = false
    @State private var microsoftProvider: OAuthProvider?
    @State private var authUIDelegate: AuthUIPresenter?
    @State private var authDebug = "idle"

    @State private var rocks = [Event]()
    @State private var leaders = [Leader]()
    @State public var underlayMode: UnderlayMode = .home
    @State public var openedEvent: String = ""
    @State public var eventTitle: String = "Scholarship week"
    @State public var eventBody: String = ""
    @State private var showEventDetail = false
    @State private var selectedEvent: Event?

    init() {
        #if DEBUG
            if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
                if FirebaseApp.app() == nil {
                    FirebaseApp.configure()
                }
            }
        #endif
    }

    func signOut() {
        //if Auth.auth().currentUser != nil {
        do {
            try Auth.auth().signOut()
            DispatchQueue.main.async {
                withAnimation(.spring()) {
                    // Clear view state for clean previews/logins
                    rocks = []
                    leaders = []
                    showEventDetail = false
                    selectedEvent = nil
                    eventTitle = "Scholarship week"
                    eventBody = ""
                    fullName = ""
                    username = ""
                    studentId = ""
                    addressLine1 = ""
                    addressLine2 = ""
                    city = ""
                    state = ""
                    zipCode = ""
                    address = ""
                    verifiable = false
                    testing = false
                    underlayMode = .home
                    loggedin = false
                    defaults.removeObject(forKey: "Address")
                    defaults.removeObject(forKey: "FullName")
                }
            }
        } catch {
            print(error)
            authErrorMessage = error.localizedDescription
            showAuthErrorAlert = true
        }
        //}

    }
    func signIn(prompt: String? = nil) {
        isSigningIn = true
        authDebug = "starting"
        let provider = OAuthProvider(providerID: "microsoft.com")
        // Keep a strong reference while the web auth session is in flight.
        microsoftProvider = provider
        if let prompt = prompt {
            provider.customParameters = ["tenant": "organizations", "prompt": prompt]
        } else {
            provider.customParameters = ["tenant": "organizations"]
        }

        guard let viewController = getTopViewController() else {
            isSigningIn = false
            microsoftProvider = nil
            authUIDelegate = nil
            authDebug = "no presenter"
            authErrorMessage = "Could not present the sign-in screen. Please try again."
            showAuthErrorAlert = true
            return
        }

        let uiDelegate = AuthUIPresenter(presentingViewController: viewController)
        authUIDelegate = uiDelegate
        authDebug = "presenting web auth"
        provider.getCredentialWith(uiDelegate) { credential, error in
            DispatchQueue.main.async {
                isSigningIn = false
                microsoftProvider = nil
                authUIDelegate = nil
                authDebug = "callback received"
            }
            if let error = error {
                print("Microsoft Sign-In Error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    authErrorMessage = error.localizedDescription
                    showAuthErrorAlert = true
                }
                return
            }

            if let credential = credential {
                DispatchQueue.main.async {
                    authDebug = "signing into Firebase"
                }
                Auth.auth().signIn(with: credential) { authResult, error in
                    if let error = error {
                        print("Firebase Auth Error: \(error.localizedDescription)")
                        DispatchQueue.main.async {
                            authErrorMessage = error.localizedDescription
                            showAuthErrorAlert = true
                        }
                    }
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
            if isSigningIn {
                isSigningIn = false
                microsoftProvider = nil
                authUIDelegate = nil
                authDebug = "timeout before web auth"
                authErrorMessage = "Sign-in did not start. Please try again."
                showAuthErrorAlert = true
            }
        }
    }
    private func getTopViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let keyWindow =
            scenes
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
        guard let root = keyWindow?.rootViewController else { return nil }
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        if let nav = top as? UINavigationController {
            return nav.visibleViewController ?? nav
        }
        if let tab = top as? UITabBarController {
            return tab.selectedViewController ?? tab
        }
        return top
    }
    func getEvents() {
        if !rocks.isEmpty { return }
        let db = Firestore.firestore()
        db.collection("events")  //.whereField("city", isEqualTo: placename)
            .getDocuments { (querySnapshot, error) in
                if let error = error {
                    print("Error getting documents: \(error)")
                } else {
                    if querySnapshot!.documents.isEmpty {
                        return print("is empty")
                    }

                    for document in querySnapshot!.documents {
                        //print("\(document.documentID): \(document.data())")
                        let event = Event(
                            id: document.documentID, title: document["title"] as? String ?? "",
                            date: document["date"] as? String ?? "",
                            location: document["location"] as? String ?? "",
                            descriptionLink: document["descriptionLink"] as? String ?? "")
                        //print(post)

                        rocks.append(event)

                    }
                    rocks.sort {
                        dateFromString(date: $0.date) < dateFromString(date: $1.date)
                    }
                }
            }
    }
    func getLeaders() {
        leaders = []
        let db = Firestore.firestore()
        db.collection("leaders")  //.whereField("city", isEqualTo: placename)
            .order(by: "eventsAttended", descending: false)
            .getDocuments { (querySnapshot, error) in
                if let error = error {
                    print("Error getting documents: \(error)")
                } else {
                    if querySnapshot!.documents.isEmpty {
                        return print("is empty")
                    }

                    for document in querySnapshot!.documents {
                        //print("\(document.documentID): \(document.data())")
                        let leader = Leader(
                            id: document.documentID,
                            eventsAttended: document["eventsAttended"] as? Int64 ?? 0,
                            username: document["username"] as? String ?? "")
                        //print(post)

                        leaders.append(leader)

                    }
                    leaders.sort {
                        $0.eventsAttended > $1.eventsAttended
                    }
                }
            }
    }
    func openEvent(eventId: String) {

        Task {
            db.collection("events").document(eventId)
                .addSnapshotListener { documentSnapshot, error in
                    guard let document = documentSnapshot else {
                        print("Error fetching document: \(error!)")
                        return
                    }
                    guard let data = document.data() else {
                        print("Document data was empty.")
                        return
                    }
                    print("Current data: \(data)")
                    let event = Event(
                        id: document.documentID, title: document["title"] as? String ?? "",
                        date: document["date"] as? String ?? "",
                        location: document["location"] as? String ?? "",
                        descriptionLink: document["descriptionLink"] as? String ?? "")
                    eventTitle = event.title
                    eventBody = event.date + ": " + event.location
                }
        }
    }
    func extractEventId(from raw: String) -> String {
        // Handle full URLs like https://pass.contact/event/abc123
        if let range = raw.range(of: "/event/") {
            let after = raw[range.upperBound...]
            // Strip query params if any
            if let q = after.firstIndex(of: "?") {
                return String(after[..<q])
            }
            return String(after)
        }
        // Already a bare event ID
        return raw
    }

    func attendEvent(eventId: String, address: String, fullName: String) {
        guard let user = Auth.auth().currentUser else { return }
        Task {
            guard let idToken = try? await user.getIDToken() else {
                print("Failed to get ID token")
                return
            }

            // Step 1: Get one-time code
            let codeBody = try? JSONSerialization.data(withJSONObject: ["eventId": eventId])
            var codeReq = URLRequest(url: URL(string: "https://pass.contact/api/code")!)
            codeReq.httpMethod = "POST"
            codeReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
            codeReq.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
            codeReq.httpBody = codeBody

            guard let (codeData, _) = try? await URLSession.shared.data(for: codeReq),
                let codeRes = try? JSONDecoder().decode(CodeResponse.self, from: codeData)
            else {
                print("Code request failed")
                return
            }

            if codeRes.message == "already attended." {
                DispatchQueue.main.async {
                    withAnimation(.spring()) {
                        self.eventTitle = "already attended."
                        self.underlayMode = .list
                        presentEventDetail(eventId: eventId)
                    }
                }
                return
            }

            guard let code = codeRes.code else {
                print("No code returned: \(codeRes.message ?? "")")
                return
            }

            // Step 2: Attend with code
            let attendBody = try? JSONSerialization.data(withJSONObject: [
                "eventId": eventId,
                "code": code,
                "fullName": fullName,
                "address": address,
            ])
            var attendReq = URLRequest(url: URL(string: "https://pass.contact/api/attend")!)
            attendReq.httpMethod = "POST"
            attendReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
            attendReq.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
            attendReq.httpBody = attendBody

            guard let (attendData, _) = try? await URLSession.shared.data(for: attendReq),
                let messenger = try? JSONDecoder().decode(Message.self, from: attendData)
            else {
                print("Attend request failed")
                return
            }

            DispatchQueue.main.async {
                withAnimation(.spring()) {
                    if messenger.message == "attended" {
                        self.eventTitle = messenger.message + " " + messenger.title
                    } else {
                        self.eventTitle = messenger.message
                    }
                    self.underlayMode = .list
                    presentEventDetail(eventId: eventId)
                }
            }
        }
    }
    let logo = Image("PassportWeek_Logo")
    let defaults = UserDefaults.standard
    var body: some View {
        ZStack(alignment: .bottom) {
            if loggedin {
                // Focal Architecture: Views are layered and moved via offsets
                profileView
                    .offset(x: profileOffsetX())
                    .zIndex(1)

                listView
                    .offset(x: listOffsetX(), y: listOffsetY())
                    .zIndex(2)

                homeView
                    .offset(y: homeOffsetY())
                    .zIndex(1)

                leaderboardView
                    .background(Color(uiColor: .systemBackground))
                    .offset(x: leaderboardOffsetX())
                    .zIndex(1)

            } else {
                loginView
                    .zIndex(4)
            }

            // Bottom fade: transparent to opaque white as it approaches the edge
            GeometryReader { proxy in
                let fadeHeight = 180 + proxy.safeAreaInsets.bottom
                LinearGradient(
                    gradient: Gradient(stops: [
                        .init(color: Color.white.opacity(0.0), location: 0.0),
                        .init(color: Color.white.opacity(0.5), location: 0.6),
                        .init(color: Color.white.opacity(0.85), location: 1.0),
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: fadeHeight)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
            .zIndex(3)

            GeometryReader { proxy in
                let fadeHeight = 180 + proxy.safeAreaInsets.bottom
                let tapHeight = max(0, fadeHeight - proxy.safeAreaInsets.bottom)
                QuietButton(action: {
                    withAnimation(.spring()) {
                        if underlayMode != .list {
                            underlayMode = .list
                        } else {
                            underlayMode = .home
                        }
                    }
                }) {
                    VStack(spacing: 8) {
                        Spacer()
                        if underlayMode != .home {
                            Text(underlayMode == .list ? "scan" : "back")
                                .font(Font.system(size: 15))
                                .fontWeight(.semibold)
                                .foregroundColor(.primary)
                                .padding(.bottom, max(12, proxy.safeAreaInsets.bottom + 8))
                        }
                    }
                    .frame(height: tapHeight)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
            .safeAreaInset(edge: .bottom) {
                Color.clear.frame(height: 0)
            }
            .zIndex(3)

        }
        .ignoresSafeArea()
        .environmentObject(gestureState)
        .onOpenURL { url in
            _ = Auth.auth().canHandle(url)
        }
        .onAppear {
            self.authListenerHandle = Auth.auth().addStateDidChangeListener { _, user in
                withAnimation {
                    loggedin = (user != nil)
                }
            }
        }
        .onDisappear {
            if let handle = self.authListenerHandle {
                Auth.auth().removeStateDidChangeListener(handle)
            }
        }
        .simultaneousGesture(
            DragGesture()
                .onChanged { value in
                    let hDrag = value.translation.width
                    let vDrag = value.translation.height

                    // LATCH LOGIC: Wait for meaningful movement before locking direction
                    if !isGestureStarted {
                        if abs(hDrag) > 5 || abs(vDrag) > 5 {
                            isGestureStarted = true
                            gestureState.startDrag()
                            let isVertical = abs(vDrag) > abs(hDrag)
                            let isDraggingDown = vDrag > 0 && isVertical
                            let isDraggingUp = vDrag < 0 && isVertical

                            // Allow vertical pulls only from list-top upward to bottom row, or from home downward
                            isPullAllowed =
                                (underlayMode == .list && isAtTop && isDraggingUp)
                                || (underlayMode == .home && isDraggingDown)
                        } else {
                            return
                        }
                    }

                    // If vertical becomes dominant after latch, re-evaluate pull allowance.
                    if abs(vDrag) > abs(hDrag) {
                        if underlayMode == .list && isAtTop && vDrag < 0 {
                            isPullAllowed = true
                        } else if underlayMode == .home && vDrag > 0 {
                            isPullAllowed = true
                        }
                    }

                    if abs(vDrag) > abs(hDrag) {
                        // Vertical Pull: List <-> Home
                        if isPullAllowed {
                            verticalDragOffset = vDrag
                        }
                    } else {
                        // Horizontal Swipe: Profile <-> List <-> Leaderboard
                        if underlayMode == .list {
                            horizontalDragOffset = hDrag
                        } else if underlayMode == .profile && hDrag < 0 {
                            horizontalDragOffset = hDrag
                        } else if underlayMode == .leaderboard && hDrag > 0 {
                            horizontalDragOffset = hDrag
                        }
                    }
                }
                .onEnded { value in
                    let hDrag = value.translation.width
                    let vDrag = value.translation.height
                    var didTriggerNavigation = false

                    withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                        if abs(hDrag) > abs(vDrag) * 2.0 {
                            switch underlayMode {
                            case .list:
                                if hDrag > 80 {
                                    underlayMode = .profile
                                    didTriggerNavigation = true
                                } else if hDrag < -80 {
                                    underlayMode = .leaderboard
                                    didTriggerNavigation = true
                                }
                            case .profile:
                                if hDrag < -80 {
                                    underlayMode = .list
                                    didTriggerNavigation = true
                                }
                            case .leaderboard:
                                if hDrag > 80 {
                                    underlayMode = .list
                                    didTriggerNavigation = true
                                }
                            case .home:
                                break
                            }
                        } else if isPullAllowed {
                            if underlayMode == .list && vDrag < -120 {
                                underlayMode = .home
                                didTriggerNavigation = true
                            } else if underlayMode == .home && vDrag > 120 {
                                underlayMode = .list
                                didTriggerNavigation = true
                            }
                        }
                        verticalDragOffset = 0
                        horizontalDragOffset = 0
                        isGestureStarted = false
                        isPullAllowed = false
                    }
                    gestureState.endDrag(didTriggerNavigation: didTriggerNavigation)
                }
        )
        .onChange(of: scenePhase) { oldPhase, newPhase in
            handleScenePhaseChange(newPhase)
        }
        .onChange(of: underlayMode) { _, newMode in
            // Reset edge state on mode change to prevent stale trackers.
            isAtTop = false
            if newMode == .home {
                checkCameraPermissions()
            }
        }
        .onChange(of: loggedin) { _, isLoggedIn in
            if isLoggedIn && underlayMode == .home {
                checkCameraPermissions()
            }
            if isLoggedIn {
                getEvents()
                getLeaders()
            }
        }
        .alert("Sign-In Error", isPresented: $showAuthErrorAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(authErrorMessage)
        }
    }

    @ViewBuilder
    private var listView: some View {
        VStack(alignment: .leading) {
            HStack {
                QuietButton(action: { withAnimation(.spring()) { underlayMode = .profile } }) {
                    Image(systemName: "person.crop.circle").font(.title2)
                }
                Spacer()
                Text("Events").font(.title).bold()
                Spacer()
                QuietButton(action: { withAnimation(.spring()) { underlayMode = .leaderboard } }) {
                    Image(systemName: "list.number").font(.title2)
                }
            }
            .padding()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ScrollPositionTracker(.top, in: "listScroll", isAtEdge: $isAtTop)
                    ForEach($rocks.indices, id: \.self) { index in
                        EventView(
                            title: $rocks[index].title,
                            location: $rocks[index].location,
                            date: $rocks[index].date,
                            descriptionLink: $rocks[index].descriptionLink,
                            onTap: {
                                handleEventTap(event: rocks[index])
                            },
                            onLongPress: {
                                presentEventDetail(event: rocks[index])
                            }
                        )
                        Divider()
                    }
                }
                .padding(.bottom, 70)
            }
            .coordinateSpace(name: "listScroll")
        }
        .padding(.bottom, 10)
        .safeAreaInset(edge: .top) {
            Color.clear.frame(height: 50)
        }
        .onAppear { getEvents() }
        .sheet(isPresented: $showEventDetail) {
            if let event = selectedEvent {
                EventDetailView(event: event, isPresented: $showEventDetail)
            }
        }
    }

    @ViewBuilder
    private var profileView: some View {
        ZStack {
            VStack(alignment: .leading) {
                Text("Profile").font(.title).bold().padding()
                Form {
                    Section(footer: Text("Your username is shown on the leaderboard.")) {
                        TextField("Username", text: $username)
                            .font(Font.system(size: 15))
                            .fontWeight(.semibold)
                    }
                    Section(footer: Text("Enter your mailing address in case you win a gift card."))
                    {
                        TextField(
                            "Full Name \(defaults.object(forKey: "FullName") as? String ?? "Jane Doe")",
                            text: $fullName
                        )
                        .font(Font.system(size: 15))
                        .fontWeight(.semibold)
                        .onChange(of: fullName) { verifiable = false }
                        HStack {
                            Text("Student ID")
                            Spacer()
                            Text(
                                Auth.auth().currentUser?.email?.components(separatedBy: "@").first
                                    ?? "Not Signed In"
                            )
                            .foregroundColor(.secondary)
                        }
                        TextField("Line 1", text: $addressLine1)
                            .font(Font.system(size: 15))
                            .fontWeight(.semibold)
                            .onChange(of: addressLine1) { verifiable = false }
                        TextField("Line 2", text: $addressLine2)
                            .font(Font.system(size: 15))
                            .fontWeight(.semibold)
                            .onChange(of: addressLine2) { verifiable = false }
                        TextField("City", text: $city)
                            .font(Font.system(size: 15))
                            .fontWeight(.semibold)
                            .onChange(of: city) { verifiable = false }
                        TextField("State", text: $state)
                            .font(Font.system(size: 15))
                            .fontWeight(.semibold)
                            .onChange(of: state) { verifiable = false }
                        TextField("Zip Code", text: $zipCode)
                            .font(Font.system(size: 15))
                            .fontWeight(.semibold)
                            .onChange(of: zipCode) { verifiable = false }
                    }
                    Section {
                        QuietButton(action: {
                            if addressLine2 == "" {
                                address = "\(addressLine1), \(city), \(state) \(zipCode)"
                            } else {
                                address =
                                    "\(addressLine1), \(addressLine2), \(city), \(state) \(zipCode)"
                            }
                            defaults.set(address, forKey: "Address")
                            defaults.set(fullName, forKey: "FullName")
                            let slug =
                                Auth.auth().currentUser?.email?.components(separatedBy: "@").first
                                ?? ""
                            if !slug.isEmpty {
                                db.collection("leaders").document(slug).setData(
                                    ["username": username], merge: true)
                            }
                        }) {
                            Text("Save")
                        }
                    }
                    Section {
                        #if targetEnvironment(simulator)
                            Toggle("Enable Camera", isOn: .constant(false))
                                .disabled(true)
                        #else
                            Toggle("Enable Camera", isOn: $cameraEnabled)
                        #endif
                        QuietButton(action: {
                            showLogoutConfirm = true
                        }) {
                            Text("Logout")
                                .foregroundColor(.red)
                        }
                    }
                    Section {
                        Color.clear.frame(height: 40)
                    }
                }
            }

            if testing {
                QuietButton(action: { signOut() }) {
                    Color(red: 0.0, green: 0.27, blue: 0.51).opacity(0.28)
                        .overlay(
                            VStack(spacing: 8) {
                                Text("Scholarship Week")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                Text("at Monmouth University")
                                    .font(.subheadline)
                                Text("Exit Preview Mode")
                                    .font(.headline)
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .contentShape(Rectangle())
                        .ignoresSafeArea(.container, edges: [.top, .bottom])
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .background(Color(uiColor: .systemBackground))
        .safeAreaInset(edge: .top) {
            Color.clear.frame(height: 50)
        }
        .confirmationDialog(
            "Log out of Passport?",
            isPresented: $showLogoutConfirm,
            titleVisibility: .visible
        ) {
            Button("Log Out", role: .destructive) {
                signOut()
            }
            Button("Cancel", role: .cancel) {}
        }
        .padding(.bottom, 10)
        .onAppear { loadUsername() }
    }

    func loadUsername() {
        let slug = Auth.auth().currentUser?.email?.components(separatedBy: "@").first ?? ""
        if !slug.isEmpty {
            db.collection("leaders").document(slug).getDocument { doc, error in
                if let doc = doc, doc.exists {
                    username = doc.data()?["username"] as? String ?? ""
                }
            }
        }
    }

    func presentEventDetail(event: Event) {
        selectedEvent = event
        showEventDetail = true
    }

    func presentEventDetail(eventId: String) {
        if let event = rocks.first(where: { $0.id == eventId }) {
            presentEventDetail(event: event)
            return
        }
        db.collection("events").document(eventId).getDocument { doc, error in
            guard let doc = doc, doc.exists else { return }
            let event = Event(
                id: doc.documentID,
                title: doc["title"] as? String ?? "",
                date: doc["date"] as? String ?? "",
                location: doc["location"] as? String ?? "",
                descriptionLink: doc["descriptionLink"] as? String ?? ""
            )
            DispatchQueue.main.async {
                presentEventDetail(event: event)
            }
        }
    }

    func handleEventTap(event: Event) {
        if !event.descriptionLink.isEmpty && isValidHttpsUrl(event.descriptionLink) {
            // Open URL in Safari if valid HTTPS
            if let url = URL(string: event.descriptionLink) {
                UIApplication.shared.open(url)
            }
        } else {
            // Show event detail view with directions
            presentEventDetail(event: event)
        }
    }

    func isValidHttpsUrl(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString),
            let scheme = url.scheme,
            let host = url.host
        else {
            return false
        }
        return scheme == "https" && !host.isEmpty
    }

    @ViewBuilder
    private var leaderboardView: some View {
        VStack(alignment: .leading) {
            Text("Leaderboard").font(.title).bold().padding()
            List {
                ForEach($leaders.indices, id: \.self) { index in
                    LeaderView(
                        studentId: leaders[index].id, username: leaders[index].username,
                        eventsAttended: $leaders[index].eventsAttended)
                }
                Color.clear.frame(height: 40)
            }
        }
        .onAppear { getLeaders() }
        .background(Color(uiColor: .systemBackground))
        .padding(.bottom, 10)
        .safeAreaInset(edge: .top) {
            Color.clear.frame(height: 50)
        }
    }

    @ViewBuilder
    private var loginView: some View {
        VStack(spacing: 20) {
            logo
                .resizable()
                .scaledToFit()
                .frame(width: 200)
                .padding(.bottom, 50)

            Text("Monmouth University Passport")
                .font(.title2)
                .fontWeight(.bold)

            QuietButton(action: { signIn() }) {
                HStack {
                    Image(systemName: "envelope.fill")
                    Text(isSigningIn ? "Opening Microsoft..." : "Sign in with Microsoft")
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .padding(.horizontal, 40)
            .disabled(isSigningIn)

            QuietButton(action: { signIn(prompt: "select_account") }) {
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Switch Account")
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color(uiColor: .secondarySystemBackground))
                .foregroundColor(.blue)
                .cornerRadius(10)
            }
            .padding(.horizontal, 40)
            .disabled(isSigningIn)

            Text("Auth: \(authDebug)")
                .font(.caption2)
                .foregroundColor(.secondary)

            Text("Please use your student email to sign in.")
                .font(.caption)
                .foregroundColor(.secondary)

            QuietButton(action: {
                withAnimation {
                    testing = true
                    loggedin = true
                }
            }) {
                Text("Preview (TDD)")
            }
            .padding(.top, 20)
            .foregroundColor(.blue)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemBackground))
    }

    @ViewBuilder
    private var homeView: some View {
        ZStack {
            if underlayMode == .home && cameraEnabled && !deniedCamera {
                CodeScannerView(codeTypes: [.qr], simulatedData: "PUCYMbQTTVlmTitXH8nO") {
                    response in
                    handleScannerResponse(response)
                }
            } else {
                Color(uiColor: .systemBackground).edgesIgnoringSafeArea(.all)
            }

            VStack {
                Spacer()

                if !eventBody.isEmpty {
                    Text(eventBody)
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 10).fill(Color.black.opacity(0.6))
                        )
                        .foregroundColor(.white)
                        .padding(.bottom, 40)
                }
            }
        }
        .safeAreaInset(edge: .top) {
            Color.clear.frame(height: 50)
        }
        .overlay(alignment: .top) {
            headerView
                .padding()
        }
        .alert("Simulator Mode", isPresented: $showSimulatorAlert) {
            Button("OK") {
                withAnimation(.spring()) {
                    underlayMode = .list
                }
            }
        } message: {
            Text("Camera is not available on the simulator. Redirecting to event list.")
        }
        .alert("Enable Camera Access?", isPresented: $showPermissionAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Back to List", role: .cancel) {
                withAnimation(.spring()) {
                    underlayMode = .list
                }
            }
        } message: {
            Text("Camera access is required to scan QR codes.")
        }
        .alert("Scanner Error", isPresented: $showScannerErrorAlert) {
            Button("OK") {
                withAnimation(.spring()) {
                    underlayMode = .list
                }
            }
        } message: {
            Text(alertCamera)
        }
        .alert("Scanner Disabled", isPresented: $showDisabledAlert) {
            Button("Go to Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Back to List", role: .cancel) {
                withAnimation(.spring()) {
                    underlayMode = .list
                }
            }
        } message: {
            Text("You've previously disabled the camera from viewing QR codes.")
        }
    }

    private var headerView: some View {
        HStack {
            QuietButton(action: { withAnimation(.spring()) { underlayMode = .list } }) {
                Image(systemName: "list.dash")
                    .font(.title)
                    .foregroundColor(.blue)
            }
            Spacer()
            Text(displayEventTitle)
                .font(.headline)
                .foregroundColor(deniedCamera ? .primary : .white)
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .safeAreaInset(edge: .top) {
            Color.clear.frame(height: 50)
        }
    }

    private var displayEventTitle: String {
        if eventTitle == "Scholarship week"
            && underlayMode == .home
            && cameraEnabled
            && !deniedCamera
        {
            return "Scan an event-host's QR code now"
        }
        return eventTitle
    }

    private func handleScannerResponse(_ response: Result<ScanResult, ScanError>) {
        switch response {
        case .success(let result):
            let eventId = extractEventId(from: result.string)
            let savedAddress = defaults.object(forKey: "Address") as? String ?? ""
            let savedFullName = defaults.object(forKey: "FullName") as? String ?? ""
            if Auth.auth().currentUser != nil {
                attendEvent(eventId: eventId, address: savedAddress, fullName: savedFullName)
            }
        case .failure(let error):
            withAnimation(.spring()) {
                deniedCamera = true
                alertCamera = error.localizedDescription + ". Try again."
                showScannerErrorAlert = true
            }
        }
    }

    private func listOffsetX() -> CGFloat {
        let base: CGFloat
        switch underlayMode {
        case .profile:
            base = UIScreen.screenWidth
        case .leaderboard:
            base = -UIScreen.screenWidth
        default:
            base = 0
        }
        return base + horizontalDragOffset
    }

    private func listOffsetY() -> CGFloat {
        let base = underlayMode == .home ? -UIScreen.screenHeight : 0
        return base + verticalDragOffset
    }

    private func profileOffsetX() -> CGFloat {
        let base = underlayMode == .profile ? 0 : -UIScreen.screenWidth
        let drag =
            (underlayMode == .list && horizontalDragOffset > 0)
                || (underlayMode == .profile && horizontalDragOffset < 0)
            ? horizontalDragOffset
            : 0
        return base + drag
    }

    private func leaderboardOffsetX() -> CGFloat {
        let base = underlayMode == .leaderboard ? 0 : UIScreen.screenWidth
        let drag =
            (underlayMode == .list && horizontalDragOffset < 0)
                || (underlayMode == .leaderboard && horizontalDragOffset > 0)
            ? horizontalDragOffset
            : 0
        return base + drag
    }

    private func homeOffsetY() -> CGFloat {
        let base = underlayMode == .home ? 0 : UIScreen.screenHeight
        let drag =
            (underlayMode == .list && verticalDragOffset < 0)
                || (underlayMode == .home && verticalDragOffset > 0)
            ? verticalDragOffset
            : 0
        return base + drag
    }

    private func handleScenePhaseChange(_ newPhase: ScenePhase) {
        if newPhase == .active {
            print("Active")
            if underlayMode == .home {
                checkCameraPermissions()
            }
            verticalDragOffset = 0
            horizontalDragOffset = 0
            isGestureStarted = false
            isPullAllowed = false
        } else if newPhase == .inactive {
            print("Inactive")
        } else if newPhase == .background {
            print("Background")
        }
    }

    private func checkCameraPermissions() {
        Task {
            // Delay to allow the view transition to complete so the home screen is visible behind the alert
            try? await Task.sleep(nanoseconds: 500_000_000)

            if !cameraEnabled {
                await MainActor.run {
                    deniedCamera = true
                    showDisabledAlert = true
                }
                return
            }

            #if targetEnvironment(simulator)
                await MainActor.run {
                    showSimulatorAlert = true
                }
            #else
                let status = AVCaptureDevice.authorizationStatus(for: .video)
                if status == .authorized {
                    await MainActor.run {
                        withAnimation(.spring()) {
                            deniedCamera = false
                        }
                    }
                } else if status == .notDetermined {
                    let granted = await AVCaptureDevice.requestAccess(for: .video)
                    await MainActor.run {
                        withAnimation(.spring()) {
                            deniedCamera = !granted
                            if !granted {
                                showPermissionAlert = true
                            }
                        }
                    }
                } else {
                    await MainActor.run {
                        withAnimation(.spring()) {
                            deniedCamera = true
                            showPermissionAlert = true
                        }
                    }
                }
            #endif
        }
    }
}

#Preview {
    ContentView()
}

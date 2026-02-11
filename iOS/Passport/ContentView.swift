//
//  ContentView.swift
//  Passport
//
//  Created by Nicholas Carducci on 9/7/24.
//
import Foundation
import AVFoundation
//import PromiseKit
import SwiftUI
import Firebase
import FirebaseAuth
import CodeScanner
let db = Firestore.firestore()
//import FirebaseMessaging
extension UIScreen{
   static var screenWidth: CGFloat {
       (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.width ?? 0
   }
   static var screenHeight: CGFloat {
       (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.height ?? 0
   }
   static var screenSize: CGSize {
       (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.size ?? .zero
   }
}
func dateFromString (date: String) -> Date {
    // create dateFormatter with UTC time format
    let dateFormatter = DateFormatter()
    dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
    let date = dateFormatter.date(from: date) ?? Date.now
    return date
}
struct ScrollPositionTracker: View {
    let coordinateSpaceName: String
    @Binding var isAtEdge: Bool
    
    var body: some View {
        GeometryReader { proxy in
            let frame = proxy.frame(in: .named(coordinateSpaceName))
            Color.clear
                .onAppear { update(frame) }
                .onChange(of: frame) { _, newFrame in update(newFrame) }
        }
        .frame(height: 1)
    }
    
    private func update(_ frame: CGRect) {
        // Detect if the bottom marker is within the viewport (plus a small buffer)
        let isBottomVisible = frame.maxY <= UIScreen.screenHeight + 50
        if isAtEdge != isBottomVisible {
            isAtEdge = isBottomVisible
        }
    }
}
struct EventView: View {
    @Binding public var title:String
    @Binding public var location:String
    @Binding public var date:String
    @Binding public var descriptionLink:String
    @Environment(\.colorScheme) var colorScheme
    let defaults = UserDefaults.standard
    var body: some View {
        HStack{
            Link("\(dateFromString(date:date)) \(title): \(location)",
                 destination: URL(string: descriptionLink)!)
                .foregroundStyle(colorScheme == .dark ? .white : .black)
                .padding(10)
        }
    }
}
struct Message {
    var message: String
    var title: String
}
extension Message: Decodable {
    enum CodingKeys: String, CodingKey {
        case message = "message"
        case title = "title"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.message = try podcastContainer.decode(String.self, forKey: .message)
        self.title = try podcastContainer.decode(String.self, forKey: .title)
    }
}
struct Event {
    var id: String
    var title: String
    var date: String
    var location: String
    var attendees: Array<String>
    var descriptionLink: String
}
extension Event: Decodable {
    enum CodingKeys: String, CodingKey {
        case id = "id"
        case title = "title"
        case date = "date"
        case location = "location"
        case attendees = "attendees"
        case descriptionLink = "descriptionLink"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try podcastContainer.decode(String.self, forKey: .id)
        self.title = try podcastContainer.decode(String.self, forKey: .title)
        self.date = try podcastContainer.decode(String.self, forKey: .date)
        self.location = try podcastContainer.decode(String.self, forKey: .location)
        self.attendees = try podcastContainer.decode(Array.self, forKey: .attendees)
        self.descriptionLink = try podcastContainer.decode(String.self, forKey: .descriptionLink)
    }
}
struct LeaderView: View {
    public var studentId: String
    public var username: String
    @Binding public var eventsAttended:Int64
    var body: some View {
        HStack{
            Text("\(!username.isEmpty ? username : studentId): \(eventsAttended)")
                .padding(10)
        }
    }
}
struct Leader {
    var id: String
    var eventsAttended: Int64
    var username: String
}
extension Leader: Decodable {
    enum CodingKeys: String, CodingKey {
        case id = "id"
        case eventsAttended = "eventsAttended"
        case username = "username"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try podcastContainer.decode(String.self, forKey: .id)
        self.eventsAttended = try podcastContainer.decode(Int64.self, forKey: .eventsAttended)
        self.username = (try? podcastContainer.decode(String.self, forKey: .username)) ?? ""
    }
}

struct Leaders {
    var features: Array<Leader>
}
extension Leaders: Decodable {
    enum CodingKeys: String, CodingKey {
        case features = "features"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.features = try podcastContainer.decode([Leader].self, forKey: .features)
    }
}
enum FirebaseError: Error {
    case Error
    case VerificatrionEmpty
}
struct ContentView: View {
    //@AppStorage("username") var username: String = ""
    
    @Environment(\.scenePhase) var scenePhase
    
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
    @State private var authListenerHandle: AuthStateDidChangeListenerHandle?
    @State private var verticalDragOffset: CGFloat = 0
    @State private var horizontalDragOffset: CGFloat = 0
    @State private var isGestureStarted = false
    #if targetEnvironment(simulator)
    @State private var cameraEnabled = false
    #else
    @State private var cameraEnabled = true
    #endif
    @State private var isAtBottom = false
    
    @State private var rocks = [Event]()
    @State private var leaders = [Leader]()
    @State public var show: String = "home"
    @State public var openedEvent: String = ""
    @State public var eventTitle: String = "Scholarship week"
    @State public var eventBody: String = ""

    init() {}

    func signOut(){
        //if Auth.auth().currentUser != nil {
            do {
                try Auth.auth().signOut()
            }
            catch {
              print (error)
            }
        //}
    
    }
    func signIn() {
        let provider = OAuthProvider(providerID: "microsoft.com")
        provider.customParameters = ["tenant": "organizations"]
        
        provider.getCredentialWith(nil) { credential, error in
            if let error = error {
                print("Microsoft Sign-In Error: \(error.localizedDescription)")
                return
            }
            
            if let credential = credential {
                Auth.auth().signIn(with: credential) { authResult, error in
                    if let error = error {
                        print("Firebase Auth Error: \(error.localizedDescription)")
                    }
                }
            }
        }
    }
    func getEvents () {
        if !rocks.isEmpty { return }
        let db = Firestore.firestore()
        db.collection("events")//.whereField("city", isEqualTo: placename)
            .getDocuments() { (querySnapshot, error) in
                        if let error = error {
                                print("Error getting documents: \(error)")
                        } else {
                                if querySnapshot!.documents.isEmpty {
                                    return print("is empty")
                                }
                            
                                for document in querySnapshot!.documents {
                                        //print("\(document.documentID): \(document.data())")
                                    let event = Event(id: document.documentID,title: document["title"] as? String ?? "", date: document["date"] as? String ?? "",location: document["location"] as? String ?? "",attendees: document["attendees"] as? Array<String> ?? [],descriptionLink: document["descriptionLink"] as? String ?? "")
                                    //print(post)
                                    
                                    rocks.append(event)
                                    
                                }
                            rocks.sort {
                                dateFromString(date: $0.date) < dateFromString(date: $1.date)
                            }
                        }
                }
    }
    func getLeaders () {
        leaders = []
        let db = Firestore.firestore()
        db.collection("leaders")//.whereField("city", isEqualTo: placename)
            .order(by: "eventsAttended", descending: false)
            .getDocuments() { (querySnapshot, error) in
                        if let error = error {
                                print("Error getting documents: \(error)")
                        } else {
                                if querySnapshot!.documents.isEmpty {
                                    return print("is empty")
                                }
                            
                                for document in querySnapshot!.documents {
                                        //print("\(document.documentID): \(document.data())")
                                    let leader = Leader(id: document.documentID, eventsAttended: document["eventsAttended"] as? Int64 ?? 0, username: document["username"] as? String ?? "")
                                    //print(post)
                                    
                                    leaders.append(leader)
                                    
                                }
                            leaders.sort {
                                $0.eventsAttended > $1.eventsAttended
                            }
                        }
                }
        /*let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        leaderboard = []
        let urlString = "https://"
        let url = URL(string: urlString)!
        print("searching \(urlString)")
        //let (data, _) = try await URLSession.shared.data(from: url)
        
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            //if error != nil { return print(error) }
            if let data = data{
                do {
                   let leaders = try decoder.decode(Leaders.self, from: data)
                    print("found \(leaders)")
                    //place = try decoder.decode(Place.self, from: data)
                    //print(place)
                    DispatchQueue.main.async {
                        if leaders.features.count == 0 {return}
                        leaderboard = leaders.features
                        //print(post)
                        /*leaders.features.forEach { body in

                            leaderboard.append(Leader(id: body["id"]as? String ?? "", eventsAttended: body["eventsAttended"] as? Int64 ?? 0))
                        }*/
                    }
                } catch {
                    print(error)
                }
            }
        }
        task.resume()*/
    }
    func openEvent (eventId: String) {
        
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
                  let event = Event(id: document.documentID,title: document["title"] as? String ?? "", date: document["date"] as? String ?? "",location: document["location"] as? String ?? "",attendees: document["attendees"] as? Array<String> ?? [],descriptionLink: document["descriptionLink"] as? String ?? "")
                  eventTitle = event.title
                  eventBody = event.date + ": " + event.location
              }
        }
    }
    func attendEvent (eventId:String, studentId:String, address:String, fullName:String) {
        //if studentId == "" {return}
        Task {
            let parameterDictionary = ["eventId" : eventId, "studentId": studentId,
                                       "address": address,
                                       "fullName": fullName]
            let urlString = "https://pass.contact/api/attend"
            let url = URL(string: urlString)!
            print("searching \(urlString)")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("aplication/x-www-form-urlencoded", forHTTPHeaderField: "String")
            guard let httpBody = try? JSONSerialization.data(withJSONObject: parameterDictionary, options: []) else {
                return
            }
            request.httpBody = httpBody
            /*let postString = "eventId=\(eventId)&studentId=\(studentId)"
            request.httpBody = postString.data(using: .utf8)*/
            //let (data, _) = try await URLSession.shared.data(from: url)
            
            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                //if error != nil { return print(error) }
                if let data = data{
                    do {
                        let messenger = try JSONDecoder().decode(Message.self, from: data)
                        print("found \(messenger)")
                        DispatchQueue.main.async {
                            withAnimation(.spring()) {
                                if messenger.message == "attended" || messenger.message == "already attended." {
                                    if messenger.message == "attended" {
                                        eventTitle = messenger.message + " " + messenger.title
                                    } else {
                                        eventTitle = messenger.message
                                    }
                                    show = "list"
                                }
                            }
                        }
                    
                    } catch {
                        print(error)
                    }
                }
            }
            task.resume()
            /*let docRef = db.collection("events").document(eventId)
            
            do {
                let document = try await docRef.getDocument()
                if document.exists {
                    alertCamera = "Thank you"
                    let dataDescription = document.data().map(String.init(describing:)) ?? "nil"
                    print("Document data: \(dataDescription)")
                    let event = Event(id: document.documentID,title: document["title"] as? String ?? "", date: document["date"] as? String ?? "",location: document["location"] as? String ?? "",attendees: document["attendees"] as? Array<String> ?? [],descriptionLink: document["descriptionLink"] as? String ?? "")
                    let savedStudentId = defaults.object(forKey:"StudentId") as? String ?? String()
                    if savedStudentId == "" || event.attendees.contains(savedStudentId) {
                        return
                    }
                    
                    let eventRef = db.collection("events").document(eventId)
                    
                    // Set the "capital" field of the city 'DC'
                    do {
                        try await eventRef.updateData([
                            "attendees": FieldValue.arrayUnion([savedStudentId])
                        ])
                        print("Document successfully updated")
                    } catch {
                        print("Error updating document: \(error)")
                    }
                    
                    let leadersRef = db.collection("leaders").document(savedStudentId)
                    
                    // Set the "capital" field of the city 'DC'
                    let savedFullName = defaults.object(forKey:"FullName") as? String ?? String()
                    let savedAddress = defaults.object(forKey:"Address") as? String ?? String()
                    do {

                        let document = try await leadersRef.getDocument()
                        if document.exists {
                            try await leadersRef.updateData([
                                "eventsAttended": FieldValue.increment(Int64(1)),
                                "fullName": savedFullName,
                                "address": savedAddress
                            ])
                            print("Document successfully updated")
                        } else {
                            try await leadersRef.setData([
                                "eventsAttended": FieldValue.increment(Int64(1)),
                                "fullName": savedFullName,
                                "address": savedAddress
                            ])
                            print("Document successfully added")
                        }
                    } catch {
                        print("Error updating document: \(error)")
                    }
                    
                } else {
                    alertCamera = "Event doesn't exist"
                    print("Document does not exist")
                }
            } catch {
                alertCamera = "Event doesn't exist"
                print("Error getting document: \(error)")
            }*/
            
        }
    }
    let logo = Image("PassportWeek_Logo")
    let defaults = UserDefaults.standard
    var body: some View {
        ZStack(alignment: .bottom) {
            if loggedin {
                // Focal Architecture: Views are layered and moved via offsets
                profileView
                    .offset(x: (show == "profile" ? 0 : -UIScreen.screenWidth) + horizontalDragOffset)
                    .zIndex(show == "profile" ? 2 : 1)

                listView
                    .offset(x: (show == "profile" ? UIScreen.screenWidth : show == "leaderboard" ? -UIScreen.screenWidth : 0) + horizontalDragOffset)
                    .offset(y: (show == "home" ? -UIScreen.screenHeight : 0) + verticalDragOffset)
                    .zIndex(show == "list" ? 3 : 1)
                
                homeView
                    .offset(y: (show == "home" ? 0 : UIScreen.screenHeight) + verticalDragOffset)
                    .zIndex(show == "home" ? 3 : 1)

                leaderboardView
                    .background(Color(uiColor: .systemBackground))
                    .offset(x: (show == "leaderboard" ? 0 : UIScreen.screenWidth) + horizontalDragOffset)
                    .zIndex(show == "leaderboard" ? 2 : 1)

                backButton
                    .padding(.bottom, 10)
                    .zIndex(3)
            } else {
                loginView
                    .zIndex(4)
            }
            
            if testing {
                Text(Auth.auth().currentUser?.email ?? "Not logged in")
                    .padding()
                    .background(Color.black.opacity(0.7))
                    .foregroundColor(.white)
            }
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
        .gesture(
            DragGesture()
                .onChanged { value in
                    let hDrag = value.translation.width
                    let vDrag = value.translation.height
                    
                    // LATCH LOGIC: Wait for meaningful movement before locking direction
                    if !isGestureStarted {
                        if abs(hDrag) > 5 || abs(vDrag) > 5 {
                            isGestureStarted = true
                        }
                    }
                    
                    if isGestureStarted {
                        if abs(hDrag) > abs(vDrag) {
                            // Horizontal Swipe: Profile <-> List <-> Leaderboard
                            if show == "list" {
                                horizontalDragOffset = hDrag
                            } else if show == "profile" && hDrag < 0 {
                                horizontalDragOffset = hDrag
                            } else if show == "leaderboard" && hDrag > 0 {
                                horizontalDragOffset = hDrag
                            }
                        } else {
                            // Vertical Pull: List <-> Camera
                            if show == "list" && isAtBottom && vDrag < 0 {
                                verticalDragOffset = vDrag
                            } else if show == "home" && vDrag > 0 {
                                verticalDragOffset = vDrag
                            }
                        }
                    }
                }
                .onEnded { value in
                    let hDrag = value.translation.width
                    let vDrag = value.translation.height
                    
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                        if abs(hDrag) > abs(vDrag) {
                            if show == "list" {
                                if hDrag < -100 { show = "leaderboard" }
                                else if hDrag > 100 { show = "profile" }
                            } else if show == "profile" && hDrag < -100 {
                                show = "list"
                            } else if show == "leaderboard" && hDrag > 100 {
                                show = "list"
                            }
                        } else {
                            if show == "list" && isAtBottom && vDrag < -100 { show = "home" }
                            else if show == "home" && vDrag > 100 { show = "list" }
                        }
                        verticalDragOffset = 0
                        horizontalDragOffset = 0
                        isGestureStarted = false
                    }
                }
        )
        .onChange(of: scenePhase) { oldPhase, newPhase in
            handleScenePhaseChange(newPhase)
        }
        .onChange(of: show) { oldShow, newShow in
            if newShow == "home" {
                checkCameraPermissions()
            }
        }
    }

    @ViewBuilder
    private var listView: some View {
        VStack(alignment: .leading) {
            HStack {
                Button(action: { withAnimation(.spring()) { show = "profile" } }) {
                    Image(systemName: "person.crop.circle").font(.title2)
                }
                Spacer()
                Text("Events").font(.title).bold()
                Spacer()
                Button(action: { withAnimation(.spring()) { show = "leaderboard" } }) {
                    Image(systemName: "list.number").font(.title2)
                }
            }
            .padding()
            
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach($rocks.indices, id: \.self) { index in
                        EventView(title: $rocks[index].title, location: $rocks[index].location, date: $rocks[index].date, descriptionLink: $rocks[index].descriptionLink)
                        Divider()
                    }
                    ScrollPositionTracker(coordinateSpaceName: "listScroll", isAtEdge: $isAtBottom)
                }
            }
            .coordinateSpace(name: "listScroll")
        }
        .onAppear { getEvents() }
    }

    @ViewBuilder
    private var profileView: some View {
        VStack(alignment: .leading) {
            Text("Profile").font(.title).bold().padding(.horizontal)
            Form {
                Section(footer: Text("Your username is shown on the leaderboard.")) {
                    TextField("Username", text: $username)
                        .font(Font.system(size: 15))
                        .fontWeight(.semibold)
                }
                Section(footer: Text("Enter your mailing address in case you win a gift card.")) {
                    TextField("Full Name \(defaults.object(forKey: "FullName") as? String ?? "Jane Doe")", text: $fullName)
                        .font(Font.system(size: 15))
                        .fontWeight(.semibold)
                        .onChange(of: fullName) { verifiable = false }
                    HStack {
                        Text("Student ID")
                        Spacer()
                        Text(Auth.auth().currentUser?.email?.components(separatedBy: "@").first ?? "Not Signed In")
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
                    Button("Save") {
                        if addressLine2 == "" {
                            address = "\(addressLine1), \(city), \(state) \(zipCode)"
                        } else {
                            address = "\(addressLine1), \(addressLine2), \(city), \(state) \(zipCode)"
                        }
                        defaults.set(address, forKey: "Address")
                        defaults.set(fullName, forKey: "FullName")
                        let slug = Auth.auth().currentUser?.email?.components(separatedBy: "@").first ?? ""
                        if !slug.isEmpty {
                            db.collection("leaders").document(slug).setData(["username": username], merge: true)
                        }
                    }
                }
                Section {
                    #if targetEnvironment(simulator)
                    Toggle("Enable Camera", isOn: .constant(false))
                        .disabled(true)
                    #else
                    Toggle("Enable Camera", isOn: $cameraEnabled)
                    #endif
                    Button("Logout", role: .destructive) {
                        signOut()
                    }
                }
            }
        }
        .background(Color(uiColor: .systemBackground))
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

    @ViewBuilder
    private var leaderboardView: some View {
        VStack(alignment: .leading) {
            Text("Leaderboard").font(.title).bold().padding()
            List {
                ForEach($leaders.indices, id: \.self) { index in
                    LeaderView(studentId: leaders[index].id, username: leaders[index].username, eventsAttended: $leaders[index].eventsAttended)
                }
            }
        }
        .onAppear { getLeaders() }
        .background(Color(uiColor: .systemBackground))
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
            
            Button(action: { signIn() }) {
                HStack {
                    Image(systemName: "envelope.fill")
                    Text("Sign in with Microsoft")
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .padding(.horizontal, 40)
            
            Text("Please use your student email to sign in.")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Button("Preview (TDD)") {
                withAnimation { loggedin = true }
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
            if cameraEnabled && !deniedCamera {
                CodeScannerView(codeTypes: [.qr], simulatedData: "PUCYMbQTTVlmTitXH8nO") { response in
                    handleScannerResponse(response)
                }
                .edgesIgnoringSafeArea(.all)
            } else {
                Color(uiColor: .systemBackground).edgesIgnoringSafeArea(.all)
            }
            
            VStack {
                HStack {
                    Button(action: { withAnimation(.spring()) { show = "list" } }) {
                        Image(systemName: "list.dash")
                            .font(.title)
                            .foregroundColor(.blue)
                    }
                    Spacer()
                    Text(eventTitle)
                        .font(.headline)
                        .foregroundColor(deniedCamera ? .primary : .white)
                    Spacer()
                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(.top, 60)
                .padding(.horizontal)
                
                Spacer()
                
                if !eventBody.isEmpty {
                    Text(eventBody)
                        .padding()
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color.black.opacity(0.6)))
                        .foregroundColor(.white)
                        .padding(.bottom, 40)
                }
            }
        }
        .onAppear { checkCameraPermissions() }
        .alert("Simulator Mode", isPresented: $showSimulatorAlert) {
            Button("OK") {
                withAnimation(.spring()) {
                    show = "list"
                }
            }
        } message: {
            Text("Camera is not available on the simulator. Redirecting to event list.")
        }
        .alert("Camera Permission", isPresented: $showPermissionAlert) {
            Button("OK") {
                withAnimation(.spring()) {
                    show = "list"
                }
            }
        } message: {
            Text("Camera access is required to scan QR codes. Please enable it in Settings.")
        }
        .alert("Scanner Error", isPresented: $showScannerErrorAlert) {
            Button("OK") {
                withAnimation(.spring()) {
                    show = "list"
                }
            }
        } message: {
            Text(alertCamera)
        }
        .alert("Camera Disabled", isPresented: $showDisabledAlert) {
            Button("OK") {
                withAnimation(.spring()) {
                    show = "list"
                }
            }
        } message: {
            Text("Please enable the camera in your profile settings to scan QR codes.")
        }
    }

    private func handleScannerResponse(_ response: Result<ScanResult, ScanError>) {
        switch response {
        case .success(let result):
            let studentIdSlug = Auth.auth().currentUser?.email?.components(separatedBy: "@").first ?? ""
            let savedAddress = defaults.object(forKey: "Address") as? String ?? ""
            let savedFullName = defaults.object(forKey: "FullName") as? String ?? ""
            if !studentIdSlug.isEmpty {
                attendEvent(eventId: result.string, studentId: studentIdSlug, address: savedAddress, fullName: savedFullName)
            }
        case .failure(let error):
            withAnimation(.spring()) {
                deniedCamera = true
                alertCamera = error.localizedDescription + ". Try again."
                showScannerErrorAlert = true
            }
        }
    }

    @ViewBuilder
    private var backButton: some View {
        if show != "home" {
            Text(show == "list" ? "scan" : "back")
                .font(Font.system(size: 15))
                .fontWeight(.semibold)
                .onTapGesture {
                    withAnimation(.spring()) {
                        if show != "list" {
                            show = "list"
                        } else {
                            show = "home"
                        }
                    }
                }
        }
    }

    private func handleScenePhaseChange(_ newPhase: ScenePhase) {
        if newPhase == .active {
            print("Active")
            checkCameraPermissions()
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

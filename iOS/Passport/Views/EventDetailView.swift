import SwiftUI
import FirebaseAuth

struct EventDetailView: View {
    let event: Event
    @Binding var isPresented: Bool
    @Environment(\.colorScheme) var colorScheme
    @State private var attendanceStatus: String? = nil

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 24) {
                Text(event.title)
                    .font(.title)
                    .bold()
                    .padding(.top, 32)

                Text(dateFromString(date: event.date), style: .date)
                    .font(.body)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Location:")
                        .font(.headline)
                    Text(event.location)
                        .font(.body)
                }

                if let attendanceStatus = attendanceStatus {
                    Text(attendanceStatus)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                QuietButton(action: {
                    openDirections(to: event.location)
                }) {
                    HStack {
                        Image(systemName: "map.fill")
                        Text("Get Directions")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .padding(.top, 8)

                Spacer()

                QuietButton(action: {
                    isPresented = false
                }) {
                    Text("Back")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .foregroundColor(.blue)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color(uiColor: .systemBackground))
            .navigationBarHidden(true)
        }
        .onAppear {
            loadAttendanceStatus()
        }
    }

    private func openDirections(to location: String) {
        let encodedLocation =
            location.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? location

        if let url = URL(string: "http://maps.apple.com/?q=\(encodedLocation)") {
            UIApplication.shared.open(url)
        } else {
            if let url = URL(
                string: "https://www.google.com/maps/search/?api=1&query=\(encodedLocation)")
            {
                UIApplication.shared.open(url)
            }
        }
    }

    private func loadAttendanceStatus() {
        guard let user = Auth.auth().currentUser else {
            attendanceStatus = nil
            return
        }
        Task {
            do {
                let idToken = try await user.getIDToken()
                var components = URLComponents(string: "https://pass.contact/api/status")
                components?.queryItems = [
                    URLQueryItem(name: "eventId", value: event.id)
                ]
                guard let url = components?.url else { return }
                var request = URLRequest(url: url)
                request.httpMethod = "GET"
                request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")

                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode)
                else {
                    await MainActor.run { attendanceStatus = nil }
                    return
                }
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                let hasAttended = json?["hasAttended"] as? Bool
                await MainActor.run {
                    if let hasAttended = hasAttended {
                        attendanceStatus = hasAttended ? "✓ Already Attended" : "Not Attended Yet"
                    } else {
                        attendanceStatus = nil
                    }
                }
            } catch {
                await MainActor.run { attendanceStatus = nil }
            }
        }
    }
}

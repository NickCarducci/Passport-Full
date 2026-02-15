import SwiftUI

struct LeaderView: View {
    public var studentId: String
    public var username: String
    @Binding public var eventsAttended: Int64
    var body: some View {
        HStack {
            Text("\(!username.isEmpty ? username : "Anonymous"): \(eventsAttended)")
                .padding(10)
        }
    }
}

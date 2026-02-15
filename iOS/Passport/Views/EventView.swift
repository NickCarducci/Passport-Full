import SwiftUI

struct EventView: View {
    @Binding public var title: String
    @Binding public var location: String
    @Binding public var date: String
    @Binding public var descriptionLink: String
    var onTap: () -> Void
    var onLongPress: (() -> Void)? = nil
    @Environment(\.colorScheme) var colorScheme
    let defaults = UserDefaults.standard
    var body: some View {
        QuietButton(action: onTap) {
            HStack {
                Text("\(dateFromString(date:date)) \(title): \(location)")
                    .foregroundStyle(colorScheme == .dark ? .white : .black)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(PlainButtonStyle())
        .onLongPressGesture {
            onLongPress?()
        }
    }
}

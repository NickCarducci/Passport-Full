import UIKit

extension UIScreen {
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

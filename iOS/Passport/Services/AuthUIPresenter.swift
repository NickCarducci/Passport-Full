import UIKit
import FirebaseAuth

final class AuthUIPresenter: NSObject, AuthUIDelegate {
    weak var presentingViewController: UIViewController?

    init(presentingViewController: UIViewController) {
        self.presentingViewController = presentingViewController
    }

    func present(
        _ viewController: UIViewController,
        animated: Bool,
        completion: (() -> Void)?
    ) {
        presentingViewController?.present(
            viewController,
            animated: animated,
            completion: completion
        )
    }

    func dismiss(animated: Bool, completion: (() -> Void)?) {
        presentingViewController?.dismiss(animated: animated, completion: completion)
    }
}

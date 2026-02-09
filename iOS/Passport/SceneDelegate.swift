//
//  SceneDelegate.swift
//  Passport
//
//  Created by Nicholas Carducci on 9/13/24.
//

import SwiftUI
import FirebaseAuth

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  //var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
             options connectionOptions: UIScene.ConnectionOptions) {
      //guard let windowScene = (scene as? UIWindowScene) else { return }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
      if let incomingURL = userActivity.webpageURL {
        handleIncomingDynamicLink(incomingURL)
      }
    }
    private func handleIncomingDynamicLink(_ incomingURL: URL) {
      let _ = incomingURL.absoluteString
    }
    // Implementing this delegate method is needed when swizzling is disabled.
    // Without it, reCAPTCHA's login view controller will not dismiss.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for urlContext in URLContexts {
          let url = urlContext.url
          _ = Auth.auth().canHandle(url)
        }
    // URL not auth related; it should be handled separately.
    }


}

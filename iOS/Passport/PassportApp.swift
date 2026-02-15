//
//  PassportApp.swift
//  Passport
//
//  Created by Nicholas Carducci on 9/7/24.
//

import SwiftUI
import FirebaseCore
import FirebaseAuth
import FirebaseMessaging

@main
struct PassportApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
/*struct FBConfiguration {
    static var config: PlistConfig = {
        guard let url = Bundle.main.url(forResource: "Info", withExtension: "plist") else {
            fatalError("Couldn't find Info.plist file.")
        }
        do {
            let decoder = PropertyListDecoder()
            let data = try Data(contentsOf: url)
            return try decoder.decode(PlistConfig.self, from: data)
        } catch let error {
            //fatalError("Couldn't parse Config.plist data. \(error.localizedDescription)")
            fatalError("\(error)")
        }
    }()
}

struct PlistConfig: Codable {
    let firebaseApiKey: String
    let firebaseGcmSenderId: String
    let firebasePListVersion: String
    let firebaseBundleId: String
    let firebaseProjectId: String
    let firebaseStorageBucket: String
    let firebaseAppId: String

    enum CodingKeys: String, CodingKey {
        case firebaseApiKey = "FIRE_API_KEY"
        case firebaseGcmSenderId = "FIRE_GCM_SENDER_ID"
        case firebasePListVersion = "FIRE_PLIST_VERSION"
        case firebaseBundleId = "FIRE_BUNDLE_ID"
        case firebaseProjectId = "FIRE_PROJECT_ID"
        case firebaseStorageBucket = "FIRE_STORAGE_BUCKET"
        case firebaseAppId = "FIRE_GOOGLE_APP_ID"
    }
}

extension PlistConfig {
    func toJSON() -> String? {
        let encoder = JSONEncoder()
        do {
            let jsonData = try encoder.encode(self)
            let jsonString = String(data: jsonData, encoding: .utf8)
            //print("jsonString \(jsonString)")
            return jsonString
        } catch {
            print("Error encoding PlistConfig to JSON: \(error)")
            return nil
        }
    }
}*/

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        
        /*let plist = FBConfiguration.config
        let options = FirebaseOptions(googleAppID: plist.firebaseAppId, gcmSenderID: plist.firebaseGcmSenderId)
        options.apiKey = plist.firebaseApiKey
        options.projectID = plist.firebaseProjectId*/
        FirebaseApp.configure()
        
        print("application is starting up. ApplicationDelegate didFinishLaunchingWithOptions.")
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        print("Yay! Got a device token 🥳 \(deviceToken)")

        Auth.auth().setAPNSToken(deviceToken, type: .unknown)//.sandbox
        //Messaging.messaging().setAPNSToken(deviceToken, type: .sandbox)
    }
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification notification: [AnyHashable : Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        
        if Auth.auth().canHandleNotification(notification) {
            print("Can handle notifications")
            completionHandler(.noData)
            return
        }
    }
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Called when a new scene session is being created.
        // Use this method to select a configuration to create the new scene with.
        return UISceneConfiguration(
          name: "Default Configuration",
          sessionRole: connectingSceneSession.role
        )
          /*let sceneConfig: UISceneConfiguration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
          sceneConfig.delegateClass = SceneDelegate.self
          return sceneConfig*/
      }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
             options connectionOptions: UIScene.ConnectionOptions) {
      guard let windowScene = (scene as? UIWindowScene) else { return }
        window = UIWindow(windowScene: windowScene)
        window?.makeKeyAndVisible()
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
      if let incomingURL = userActivity.webpageURL {
          let _ = incomingURL.absoluteString
      }
    }
    // Implementing this delegate method is needed when swizzling is disabled.
    // Without it, reCAPTCHA's login view controller will not dismiss.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for urlContext in URLContexts {
          let url = urlContext.url
          let _ = Auth.auth().canHandle(url)
        }
    // URL not auth related; it should be handled separately.
    }
}

# iOS Account Settings Integration

## Add Account Settings Menu

You need to add a way for users to access `https://pass.contact/account` from your iOS app.

### Option 1: Add to Settings/Profile View (Recommended)

If you have a profile or settings view, add a button/link:

**SwiftUI Example:**
```swift
import SwiftUI
import SafariServices

struct ProfileView: View {
    @State private var showingAccountSettings = false

    var body: some View {
        List {
            // ... your existing profile content

            Section(header: Text("Account Management")) {
                Button(action: {
                    showingAccountSettings = true
                }) {
                    HStack {
                        Text("Account Settings")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.gray)
                    }
                }
            }
        }
        .sheet(isPresented: $showingAccountSettings) {
            SafariView(url: URL(string: "https://pass.contact/account")!)
        }
    }
}

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        return SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
```

**UIKit Example:**
```swift
import UIKit
import SafariServices

class ProfileViewController: UIViewController {

    override fun viewDidLoad() {
        super.viewDidLoad()

        let accountButton = UIButton(type: .system)
        accountButton.setTitle("Account Settings", for: .normal)
        accountButton.addTarget(self, action: #selector(openAccountSettings), for: .touchUpInside)

        // Add button to your view hierarchy
        // ...
    }

    @objc private func openAccountSettings() {
        guard let url = URL(string: "https://pass.contact/account") else { return }
        let safariVC = SFSafariViewController(url: url)
        present(safariVC, animated: true)
    }
}
```

### Option 2: Add to Navigation Bar (Alternative)

Add a settings button to your navigation bar:

**SwiftUI:**
```swift
.navigationBarItems(trailing:
    Button(action: {
        showingAccountSettings = true
    }) {
        Image(systemName: "gearshape")
    }
)
```

**UIKit:**
```swift
override func viewDidLoad() {
    super.viewDidLoad()

    let settingsButton = UIBarButtonItem(
        image: UIImage(systemName: "gearshape"),
        style: .plain,
        target: self,
        action: #selector(openAccountSettings)
    )
    navigationItem.rightBarButtonItem = settingsButton
}
```

### Option 3: Embed WebView (Not Recommended)

Only use if you want a native feel, but Safari is preferred by Apple:

**SwiftUI + WebKit:**
```swift
import SwiftUI
import WebKit

struct AccountSettingsView: View {
    var body: some View {
        WebView(url: URL(string: "https://pass.contact/account")!)
            .navigationTitle("Account Settings")
    }
}

struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        return WKWebView()
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        webView.load(request)
    }
}
```

## Add Camera Permission Description

**Required:** Add to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to scan QR codes at Scholarship Week events for attendance verification.</string>
```

Or in Xcode:
1. Open Info.plist
2. Add new row
3. Key: **Privacy - Camera Usage Description**
4. Value: **We need access to your camera to scan QR codes at Scholarship Week events for attendance verification.**

## Testing Checklist

Before submitting to App Store:
- [ ] Account Settings button/link is visible in the app
- [ ] Tapping it opens Safari or WebView to `https://pass.contact/account`
- [ ] Web page loads correctly
- [ ] Data export (CSV) downloads work
- [ ] Privacy/Terms/Rules links work
- [ ] Camera permission description is in Info.plist
- [ ] Camera permission dialog shows correct message

## App Store Review Notes

When submitting, if reviewers ask about account deletion, provide these notes:

**Account Deletion Instructions:**
1. Open the app
2. Navigate to Profile/Settings
3. Tap "Account Settings"
4. Follow the deletion instructions on the web page
5. Alternatively, users can email sayists@icloud.com

**Account Deletion URL:**
`https://pass.contact/account`

## Alternative: Deep Link to Web Settings

If you want a more native integration:

1. **Add URL Scheme** to Info.plist:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>mupassport</string>
        </array>
    </dict>
</array>
```

2. **Handle Deep Links** in SceneDelegate/AppDelegate:
```swift
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url,
          url.scheme == "mupassport",
          url.host == "account" else { return }

    // Navigate to account settings
    openAccountSettings()
}
```

3. **Web can deep link back** with: `mupassport://account`

But this is **optional complexity** - simple Safari view is recommended.

## Minimal Implementation

**Bare minimum for App Store approval:**

```swift
// Somewhere in your app (Settings/Profile view)
Button("Account Settings") {
    if let url = URL(string: "https://pass.contact/account") {
        UIApplication.shared.open(url)
    }
}
```

This opens in Safari browser and meets Apple's requirements.

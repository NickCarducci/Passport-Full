# Permissions & Age Requirements for App Store Submission

## Camera Permission Handling

### ✅ Android - Already Handled

Your Android app uses **Google ML Kit Barcode Scanner** which automatically handles camera permissions. The permission is declared in your manifest:

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
```

**You don't need PermissionKit** - ML Kit handles this automatically when `scanner.startScan()` is called.

The scanner will:
1. Request camera permission if not granted
2. Show system permission dialog
3. Handle denial gracefully

### iOS - Required Info.plist Entry

Add to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to scan QR codes at Scholarship Week events for attendance verification.</string>
```

**You don't need a permission framework** - iOS handles this automatically when you first access the camera.

## Age Range Declaration

### ✅ What You Have

Your Official Rules already state:
- Minimum age: **18 years old**
- Parental consent required for under 18
- No data collection from children under 13 (COPPA compliant)

### Google Play Console - Age Rating

When filling out the **Content Rating** questionnaire:

**Target Age Group:**
- Primary: 18-24 (college students)
- Also acceptable: 17+ or 18+

**ESRB/IARC Questions:**
- Does your app appeal to children? **NO**
- Minimum age: **18+** (or 17+ if you allow under-18 with parental consent)

**Data Safety Section:**
- Age range: **18 and older**
- Or select: **Ages 13-17** with note "Parental consent required"

### Apple App Store Connect - Age Rating

In **App Information → Age Rating**:

Answer the content questionnaire:
- Made for Kids? **NO**
- Age rating will likely be: **4+** or **9+** (educational content)

In **General Information**:
- Minimum age: You can't directly set this, but your Terms of Service handle it

**Important:** Apple doesn't have a "must be 18+" enforcement like alcohol apps. Your Terms enforce the age requirement, which is sufficient for educational apps.

## Do You Need Permission Libraries?

### ❌ Don't Need PermissionKit (Android)

**Why:**
- ML Kit Barcode Scanner handles camera permission automatically
- Android system handles permission dialogs
- Adding a library adds unnecessary complexity

**If you ever need manual permission handling:**
```kotlin
// Using ActivityCompat (built-in Android)
if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
    != PackageManager.PERMISSION_GRANTED) {
    ActivityCompat.requestPermissions(this,
        arrayOf(Manifest.permission.CAMERA),
        CAMERA_REQUEST_CODE)
}
```

### ❌ Don't Need Permission Library (iOS)

**Why:**
- iOS automatically prompts when you access camera
- System handles all permission logic
- Your Info.plist description is all you need

## Internet Permission (Android)

Already declared in your manifest:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

This doesn't require runtime permission - it's install-time only.

## Play Store Data Safety Declaration

You'll need to fill this out in Play Console:

### Data Collected:
1. **Email Address**
   - Collected: YES
   - Purpose: Account management, fraud prevention
   - User can request deletion: YES

2. **User IDs (Student ID)**
   - Collected: YES
   - Purpose: App functionality (attendance tracking)
   - User can request deletion: YES

3. **Name (Display name)**
   - Collected: YES (optional)
   - Purpose: App functionality (leaderboard)
   - User can request deletion: YES

4. **App Activity (Events attended)**
   - Collected: YES
   - Purpose: App functionality, analytics
   - User can request deletion: YES

### Data Sharing:
- Shared with third parties? **NO** (Firebase is your service provider, not third party)
- Sold? **NO**
- Used for advertising? **NO**
- Used for analytics? **YES** (internal only)

### Security Practices:
- Data encrypted in transit? **YES** (HTTPS/TLS)
- Data encrypted at rest? **YES** (Firebase)
- Users can request deletion? **YES** (via account settings)
- Data deletion URL: `https://pass.contact/account`

## App Store Connect - App Privacy

When filling out **App Privacy**:

### Data Types Collected:
1. **Contact Info → Email Address**
   - Linked to user: YES
   - Used for tracking: NO
   - Purposes: App functionality, fraud prevention

2. **Identifiers → User ID**
   - Linked to user: YES
   - Used for tracking: NO
   - Purposes: App functionality

3. **User Content → Other User Content**
   - Linked to user: YES
   - Used for tracking: NO
   - Purposes: App functionality (attendance records)

### Account Deletion:
- Method: In-app menu → Account Settings
- URL: `https://pass.contact/account`

## Summary: What You Need to Do

### For Google Play Submission:
- [ ] Content Rating: Select 18+ (or 17+ with parental consent note)
- [ ] Data Safety: Fill out form (see above)
- [ ] Privacy Policy URL: `https://pass.contact/privacy`
- [ ] Account deletion URL: `https://pass.contact/account`

### For Apple App Store Submission:
- [ ] Add `NSCameraUsageDescription` to Info.plist
- [ ] Fill out App Privacy questionnaire (see above)
- [ ] Age Rating: Answer "Made for Kids?" = NO
- [ ] Privacy Policy URL: `https://pass.contact/privacy`

### You DON'T Need:
- ❌ PermissionKit or any permission library
- ❌ Special age verification in the app
- ❌ Additional consent flows (Terms handle age requirement)
- ❌ Runtime permission code (ML Kit handles it)

## Camera Permission Best Practice

If you want to show a custom message BEFORE the system permission dialog:

**Android (Optional Enhancement):**
```kotlin
private fun requestCameraWithExplanation() {
    if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
        // Show explanation
        AlertDialog.Builder(this)
            .setTitle("Camera Access Needed")
            .setMessage("We need camera access to scan QR codes at events.")
            .setPositiveButton("OK") { _, _ ->
                ActivityCompat.requestPermissions(this,
                    arrayOf(Manifest.permission.CAMERA),
                    CAMERA_REQUEST_CODE)
            }
            .show()
    } else {
        // First time - request directly
        launchScanner()
    }
}
```

**But this is optional** - ML Kit already handles it gracefully.

## Testing Age Restrictions

Neither store actively blocks users by age for non-restricted content (this isn't alcohol/gambling):
- Your **Terms of Service** legally enforce the 18+ requirement
- Your **Official Rules** state parental consent needed for under 18
- This is legally sufficient for an educational app

If you wanted stricter enforcement, you'd need age verification on signup, but **that's not required** for this use case.

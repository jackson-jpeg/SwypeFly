# SoGoJet TestFlight Guide

Step-by-step instructions to archive and upload to TestFlight from your MacBook.

---

## 1. Pre-Archive Checklist

Before you archive, confirm these settings in Xcode:

- [ ] **Bundle ID** is `com.sogojet.app` (select the SoGoJet target > General > Bundle Identifier)
- [ ] **Version** is `1.0.0` and **Build** is `1` (General > Identity)
- [ ] **Team** is set to `2MU4PC84GZ` (Signing & Capabilities > Team dropdown)
- [ ] **Signing** is set to "Automatically manage signing" (recommended)
- [ ] **Sign in with Apple** capability is enabled:
  - Go to https://developer.apple.com/account/resources/identifiers
  - Find `com.sogojet.app` and click it
  - Under Capabilities, check "Sign in with Apple" and save
- [ ] In Xcode, Signing & Capabilities tab shows "Sign in with Apple" listed
- [ ] Entitlements in Xcode match what is enabled in the Developer Portal (no extras, no missing ones)

## 2. Archive from Xcode

1. Open `SoGoJet.xcodeproj` in Xcode
2. In the top toolbar, click the device/simulator selector
3. Choose **Any iOS Device (arm64)** (you cannot archive for a simulator)
4. Go to **Product > Archive**
5. Wait for the build and archive to complete -- this may take a few minutes
6. When done, the Organizer window opens automatically with your new archive selected

If the archive fails, check the build errors in the Issue Navigator (Cmd+5).

## 3. Upload to App Store Connect

1. In the **Organizer** window (Window > Organizer if it didn't open), select your archive
2. Click **Distribute App**
3. Choose **App Store Connect** and click Next
4. Choose **Upload** (not Export) and click Next
5. Leave the default options checked (bitcode, symbol upload) and click Next
6. Xcode will validate the archive -- fix any errors if they appear
7. Click **Upload**
8. Wait for the upload to finish -- you'll see a success message

The build takes 5-30 minutes to process on Apple's side before it shows up in App Store Connect.

## 4. TestFlight Setup in App Store Connect

1. Go to https://appstoreconnect.apple.com and sign in
2. Click **My Apps** and select **SoGoJet**
3. Click the **TestFlight** tab at the top
4. Your uploaded build should appear under "iOS Builds" (wait if it's still processing)
5. If the build shows a yellow "Missing Compliance" warning, click it and answer the export compliance questions (select "No" for encryption if you only use HTTPS)
6. Under **Internal Testing** or **External Testing**, click the **+** to create a new group
7. Name it (e.g., "Beta Testers") and click Create
8. Click **Add Testers**, enter email addresses, and click Add
9. Select the build to test and click it to add it to the group
10. **First build only:** Apple requires Beta App Review -- click "Submit for Review" and wait (usually 24-48 hours)
11. Once approved, testers get an email invite to install via the TestFlight app

## 5. Common Issues and Fixes

### Provisioning Profile Problems

- **"No profiles for com.sogojet.app"**: Go to Xcode > Settings > Accounts > select your team > Download Manual Profiles. Or toggle "Automatically manage signing" off and back on.
- **Wrong team selected**: Make sure team `2MU4PC84GZ` is selected, not a personal team.
- **Expired profile**: Xcode > Settings > Accounts > Download Manual Profiles to refresh.

### Missing Capabilities

- **"Sign in with Apple" entitlement error**: The capability must be enabled both in the Apple Developer Portal (for the App ID) AND in Xcode (Signing & Capabilities tab). If either is missing, the archive will fail or upload will be rejected.
- **Entitlement mismatch**: Compare Signing & Capabilities in Xcode with what's enabled at developer.apple.com/account/resources/identifiers for your App ID. They must match exactly.

### Privacy Manifest Warnings

- Apple now requires a privacy manifest (`PrivacyInfo.xcprivacy`) for apps and certain SDKs.
- If you get a warning email after upload about missing privacy manifests, add or update the file in the Xcode project.
- Common required declarations: tracking domains, API usage reasons (UserDefaults, file timestamp, etc.).

### Sign in with Apple Requirements

- The App ID must have "Sign in with Apple" enabled in the Developer Portal before archiving.
- The entitlement in the app must specify `com.sogojet.app` as the primary App ID.
- If using a Services ID for web-based sign-in, configure it separately in the Developer Portal.
- Test on a real device before uploading -- Sign in with Apple does not work in Simulator.

---

**Quick reference -- the full flow:**

```
Xcode: Verify settings > Product > Archive > Distribute App > Upload
App Store Connect: TestFlight tab > Create group > Add testers > Submit for review
```

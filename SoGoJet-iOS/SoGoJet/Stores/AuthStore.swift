import Foundation
import Observation
import AuthenticationServices
import UIKit

// MARK: - OAuth Presentation Context

/// Provides the window anchor for ASWebAuthenticationSession.
/// Required on iOS 18+ or the OAuth popup immediately fails with error 2.
final class OAuthPresentationContext: NSObject,
    ASWebAuthenticationPresentationContextProviding,
    ASAuthorizationControllerPresentationContextProviding
{
    static let shared = OAuthPresentationContext()

    private var anchor: ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })?
            .windows.first(where: { $0.isKeyWindow })
            ?? ASPresentationAnchor()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor
    }
}

// MARK: - Auth Store
// Manages user authentication via Sign in with Apple, Google, and TikTok.
// Uses Clerk OAuth for Google/TikTok, direct Apple Sign In for Apple.
// Persists session to Keychain for secure cross-launch persistence.

@MainActor
@Observable
final class AuthStore: NSObject {
    // MARK: State
    var isAuthenticated: Bool = false
    var userId: String?
    var userName: String?
    var userEmail: String?
    var isLoading: Bool = false
    var authError: String?

    /// JWT token for authenticating API requests
    private(set) var authToken: String? {
        didSet { APIClient.authToken = authToken }
    }

    /// Strong references to keep auth sessions alive during async flows
    private var currentAuthController: ASAuthorizationController?
    private var currentWebAuthSession: ASWebAuthenticationSession?

    private let tokenKey = "sg_auth_token"
    private let userIdKey = "sg_user_id"
    private let userNameKey = "sg_user_name"
    private let userEmailKey = "sg_user_email"

    // MARK: Init

    override init() {
        super.init()
        restoreSession()
    }

    // MARK: Sign In with Apple

    func signInWithApple() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = OAuthPresentationContext.shared
        currentAuthController = controller
        controller.performRequests()
        isLoading = true
        authError = nil
    }

    /// Handle an already-completed Apple credential (from SignInWithAppleButton).
    func handleAppleCredential(_ credential: ASAuthorizationAppleIDCredential) {
        isLoading = true
        authError = nil
        let identityToken = credential.identityToken ?? Data()
        let email = credential.email
        let fullName = credential.fullName

        Task {
            await authenticateWithBackend(
                identityToken: identityToken,
                fullName: fullName,
                email: email
            )
        }
    }

    // MARK: Sign In with OAuth (Google, TikTok)

    func signInWithGoogle() {
        startOAuthFlow(provider: "oauth_google")
    }

    func signInWithTikTok() {
        startOAuthFlow(provider: "oauth_tiktok")
    }

    private let clerkDomain = "clerk.sogojet.com"
    private let oauthCallbackScheme = "sogojet"

    private func startOAuthFlow(provider: String) {
        isLoading = true
        authError = nil

        let redirectUri = "\(oauthCallbackScheme)://oauth-callback"
        guard let clerkOAuthURL = URL(string: "https://\(clerkDomain)/oauth/authorize?strategy=\(provider)&redirect_url=\(redirectUri.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? redirectUri)") else {
            isLoading = false
            authError = "Sign in failed. Please try again."
            return
        }

        let session = ASWebAuthenticationSession(
            url: clerkOAuthURL,
            callbackURLScheme: oauthCallbackScheme
        ) { [weak self] callbackURL, error in
            Task { @MainActor in
                guard let self else { return }
                self.currentWebAuthSession = nil

                if let error {
                    self.isLoading = false
                    if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                        return // User canceled
                    }
                    self.authError = "Sign in failed. Please try again."
                    #if DEBUG
                    print("[Auth] OAuth error: \(error.localizedDescription)")
                    #endif
                    return
                }

                guard let callbackURL,
                      let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
                    self.isLoading = false
                    self.authError = "Sign in failed. Please try again."
                    return
                }

                // Extract the rotating_token or code from callback
                if let token = components.queryItems?.first(where: { $0.name == "__clerk_status" })?.value,
                   token == "completed",
                   let sessionToken = components.queryItems?.first(where: { $0.name == "rotating_token" })?.value {
                    // Clerk completed the OAuth — we have a session token
                    await self.handleOAuthToken(sessionToken)
                } else if let code = components.queryItems?.first(where: { $0.name == "code" })?.value {
                    // Got an authorization code — exchange it via backend
                    await self.exchangeOAuthCode(code: code, redirectUri: redirectUri)
                } else if let ticket = components.queryItems?.first(where: { $0.name == "__clerk_ticket" })?.value {
                    // Got a Clerk ticket — exchange it
                    await self.handleOAuthToken(ticket)
                } else {
                    // Try to extract session from the callback URL
                    #if DEBUG
                    print("[Auth] OAuth callback URL: \(callbackURL)")
                    #endif
                    self.isLoading = false
                    self.authError = "Sign in failed. Please try again."
                }
            }
        }

        session.prefersEphemeralWebBrowserSession = false
        session.presentationContextProvider = OAuthPresentationContext.shared
        currentWebAuthSession = session
        session.start()
    }

    private func handleOAuthToken(_ token: String) async {
        do {
            let response: AuthResponse = try await APIClient.shared.fetch(
                .authOAuth(code: token, redirectUri: "\(oauthCallbackScheme)://oauth-callback")
            )

            self.authToken = response.sessionToken
            self.userId = response.userId
            self.userName = response.name
            self.userEmail = response.email
            self.isAuthenticated = true
            self.isLoading = false

            saveSession(
                token: response.sessionToken,
                userId: response.userId,
                name: response.name,
                email: response.email
            )

            #if DEBUG
            print("[Auth] OAuth signed in: \(self.userName ?? "Unknown") (\(self.userEmail ?? "no email"))")
            #endif
        } catch {
            #if DEBUG
            print("[Auth] OAuth token exchange failed: \(error.localizedDescription)")
            #endif
            self.isLoading = false
            self.authError = "Sign in failed. Please try again."
        }
    }

    private func exchangeOAuthCode(code: String, redirectUri: String) async {
        do {
            let response: AuthResponse = try await APIClient.shared.fetch(
                .authOAuth(code: code, redirectUri: redirectUri)
            )

            self.authToken = response.sessionToken
            self.userId = response.userId
            self.userName = response.name
            self.userEmail = response.email
            self.isAuthenticated = true
            self.isLoading = false

            saveSession(
                token: response.sessionToken,
                userId: response.userId,
                name: response.name,
                email: response.email
            )

            #if DEBUG
            print("[Auth] OAuth signed in: \(self.userName ?? "Unknown") (\(self.userEmail ?? "no email"))")
            #endif
        } catch {
            #if DEBUG
            print("[Auth] OAuth code exchange failed: \(error.localizedDescription)")
            #endif
            self.isLoading = false
            self.authError = "Sign in failed. Please try again."
        }
    }

    // MARK: Sign Out

    func signOut() {
        isAuthenticated = false
        userId = nil
        userName = nil
        userEmail = nil
        authToken = nil

        UserDefaults.standard.removeObject(forKey: userIdKey)
        UserDefaults.standard.removeObject(forKey: userNameKey)
        UserDefaults.standard.removeObject(forKey: userEmailKey)
        KeychainHelper.delete(key: tokenKey)
    }

    // MARK: Guest Mode

    func continueAsGuest() {
        // Set hasOnboarded but don't authenticate
        // The user can browse and save but can't book
        isAuthenticated = false
    }

    // MARK: Session Persistence

    private func restoreSession() {
        if let token = KeychainHelper.read(key: tokenKey),
           let userId = UserDefaults.standard.string(forKey: userIdKey) {
            self.authToken = token
            self.userId = userId
            self.userName = UserDefaults.standard.string(forKey: userNameKey)
            self.userEmail = UserDefaults.standard.string(forKey: userEmailKey)
            self.isAuthenticated = true
        }
    }

    private func saveSession(token: String, userId: String, name: String?, email: String?) {
        KeychainHelper.save(key: tokenKey, value: token)
        UserDefaults.standard.set(userId, forKey: userIdKey)
        if let name { UserDefaults.standard.set(name, forKey: userNameKey) }
        if let email { UserDefaults.standard.set(email, forKey: userEmailKey) }
    }

    // MARK: Backend Auth

    /// Exchange Apple identity token for a Clerk session token via the backend.
    private func authenticateWithBackend(identityToken: Data, fullName: PersonNameComponents?, email: String?) async {
        guard let tokenString = String(data: identityToken, encoding: .utf8) else {
            authError = "Invalid Apple ID token"
            isLoading = false
            return
        }

        do {
            // Call backend to exchange Apple token for Clerk session
            let response: AuthResponse = try await APIClient.shared.fetch(
                .auth(
                    identityToken: tokenString,
                    givenName: fullName?.givenName,
                    familyName: fullName?.familyName,
                    email: email
                )
            )

            self.authToken = response.sessionToken
            self.userId = response.userId
            self.userName = response.name
            self.userEmail = response.email
            self.isAuthenticated = true
            self.isLoading = false

            saveSession(
                token: response.sessionToken,
                userId: response.userId,
                name: response.name,
                email: response.email
            )

            #if DEBUG
            print("[Auth] Signed in: \(self.userName ?? "Unknown") (\(self.userEmail ?? "no email")) clerk_id=\(response.userId)")
            #endif
        } catch {
            #if DEBUG
            print("[Auth] Backend auth failed: \(error.localizedDescription)")
            #endif
            self.isLoading = false
            self.authError = "Sign in failed — server error. Try Google or continue as guest."
        }
    }
}

// MARK: - Auth Response

private struct AuthResponse: Codable {
    let sessionToken: String
    let userId: String
    let email: String?
    let name: String?
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthStore: ASAuthorizationControllerDelegate {
    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { @MainActor in
            currentAuthController = nil
            if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
                let identityToken = credential.identityToken ?? Data()
                let email = credential.email
                let fullName = credential.fullName

                await authenticateWithBackend(
                    identityToken: identityToken,
                    fullName: fullName,
                    email: email
                )
            }
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        Task { @MainActor in
            currentAuthController = nil
            isLoading = false
            if (error as? ASAuthorizationError)?.code == .canceled {
                // User canceled — don't show error
                return
            }
            let nsError = error as NSError
            if nsError.domain == "com.apple.AuthenticationServices.AuthorizationError" && nsError.code == 1000 {
                authError = "Apple Sign In unavailable. Try Google, or check that Sign in with Apple is enabled in Xcode → Signing & Capabilities."
            } else {
                authError = "Sign in failed. Please try again."
            }
            #if DEBUG
            print("[Auth] Error: \(error.localizedDescription) (domain=\(nsError.domain) code=\(nsError.code))")
            print("[Auth] Bundle ID: \(Bundle.main.bundleIdentifier ?? "nil")")
            print("[Auth] Hint: Ensure 'Sign in with Apple' capability is in Xcode → Signing & Capabilities, then clean build (Cmd+Shift+K) and rebuild.")
            #endif
        }
    }
}

// MARK: - Keychain Helper

private enum KeychainHelper {
    static func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

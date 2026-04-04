import Foundation
import Observation
import AuthenticationServices
import UIKit
import Clerk

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
    private var errorClearTask: Task<Void, Never>?

    private let tokenKey = StorageKeys.Auth.token
    private let userIdKey = StorageKeys.Auth.userId
    private let userNameKey = StorageKeys.Auth.userName
    private let userEmailKey = StorageKeys.Auth.userEmail

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

    // MARK: Sign In with OAuth (Google, TikTok) via Clerk SDK

    func signInWithGoogle() {
        startClerkOAuth(provider: .google)
    }

    func signInWithTikTok() {
        startClerkOAuth(provider: .tiktok)
    }

    private func startClerkOAuth(provider: OAuthProvider) {
        isLoading = true
        authError = nil

        Task {
            do {
                let result = try await SignIn.authenticateWithRedirect(
                    strategy: .oauth(provider: provider)
                )

                // After successful OAuth, Clerk SDK updates Clerk.shared.session automatically.
                // Extract the session token (JWT) for our backend API calls.
                guard let clerkSession = Clerk.shared.session else {
                    SGLogger.auth.error("OAuth completed but no Clerk session found")
                    self.isLoading = false
                    self.setErrorWithAutoClear("Sign in failed. Please try again.")
                    return
                }

                let token = try await clerkSession.getToken()?.jwt ?? ""
                let user = Clerk.shared.user

                // Exchange the Clerk session token with our backend
                let response: AuthResponse = try await APIClient.shared.fetch(
                    .authOAuth(code: token, redirectUri: "clerk-sdk")
                )

                self.authToken = response.sessionToken
                self.userId = response.userId
                self.userName = response.name ?? [user?.firstName, user?.lastName].compactMap { $0 }.joined(separator: " ")
                self.userEmail = response.email ?? user?.emailAddresses.first?.emailAddress
                self.isAuthenticated = true
                self.isLoading = false

                saveSession(
                    token: response.sessionToken,
                    userId: response.userId,
                    name: self.userName,
                    email: self.userEmail
                )

                SGLogger.auth.debug("OAuth signed in: \(self.userName ?? "Unknown") (\(self.userEmail ?? "no email"))")
            } catch let error as ClerkClientError {
                SGLogger.auth.error("Clerk OAuth failed: \(error.localizedDescription)")
                self.isLoading = false
                if error.localizedDescription.lowercased().contains("cancel") {
                    return // User canceled
                }
                self.setErrorWithAutoClear("Sign in failed. Please try again.")
            } catch {
                SGLogger.auth.error("OAuth failed: \(error.localizedDescription)")
                self.isLoading = false
                if error.localizedDescription.lowercased().contains("cancel") {
                    return
                }
                self.setErrorWithAutoClear("Sign in failed. Please try again.")
            }
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

    // MARK: OAuth Callback Parsing

    enum OAuthCallbackResult {
        case completed(token: String)
        case codeExchange(code: String)
        case ticket(value: String)
        case failed
    }

    nonisolated static func parseOAuthCallback(_ components: URLComponents) -> OAuthCallbackResult {
        let items = components.queryItems ?? []

        if let status = items.first(where: { $0.name == "__clerk_status" })?.value,
           status == "completed",
           let token = items.first(where: { $0.name == "rotating_token" })?.value {
            return .completed(token: token)
        }

        if let code = items.first(where: { $0.name == "code" })?.value {
            return .codeExchange(code: code)
        }

        if let ticket = items.first(where: { $0.name == "__clerk_ticket" })?.value {
            return .ticket(value: ticket)
        }

        return .failed
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

            SGLogger.auth.debug("Signed in: \(self.userName ?? "Unknown") (\(self.userEmail ?? "no email")) clerk_id=\(response.userId)")
        } catch {
            SGLogger.auth.error("Backend auth failed: \(error.localizedDescription)")
            self.isLoading = false
            self.setErrorWithAutoClear("Sign in failed — server error. Try Google or continue as guest.")
        }
    }

    /// Set authError and auto-clear after 8 seconds.
    private func setErrorWithAutoClear(_ message: String) {
        authError = message
        errorClearTask?.cancel()
        errorClearTask = Task {
            try? await Task.sleep(nanoseconds: 8_000_000_000)
            guard !Task.isCancelled else { return }
            authError = nil
        }
    }

    // MARK: - Auth Response

    private struct AuthResponse: Codable {
        let sessionToken: String
        let userId: String
        let email: String?
        let name: String?
    }

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
                self.setErrorWithAutoClear("Apple Sign In unavailable. Try Google or continue as guest.")
            } else {
                self.setErrorWithAutoClear("Sign in failed. Please try again.")
            }
            SGLogger.auth.error("Apple Sign In error: \(error.localizedDescription) (domain=\(nsError.domain) code=\(nsError.code)) bundleID=\(Bundle.main.bundleIdentifier ?? "nil"). Ensure 'Sign in with Apple' capability is in Xcode → Signing & Capabilities.")
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

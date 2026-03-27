import Foundation
import Observation
import AuthenticationServices

// MARK: - Auth Store
// Manages user authentication state using Sign in with Apple.
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
    private(set) var authToken: String?

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
        controller.performRequests()
        isLoading = true
        authError = nil
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
            // Fallback: use Apple token directly if backend auth fails
            #if DEBUG
            print("[Auth] Backend auth failed, using Apple token: \(error.localizedDescription)")
            #endif
            let name = [fullName?.givenName, fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")

            self.authToken = tokenString
            self.userId = "apple_\(tokenString.prefix(20))"
            self.userName = name.isEmpty ? nil : name
            self.userEmail = email
            self.isAuthenticated = true
            self.isLoading = false

            saveSession(
                token: tokenString,
                userId: self.userId!,
                name: self.userName,
                email: self.userEmail
            )
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
            isLoading = false
            if (error as? ASAuthorizationError)?.code == .canceled {
                // User canceled — don't show error
                return
            }
            authError = "Sign in failed. Please try again."
            #if DEBUG
            print("[Auth] Error: \(error.localizedDescription)")
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

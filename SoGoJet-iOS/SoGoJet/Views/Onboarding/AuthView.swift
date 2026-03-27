import SwiftUI
import AuthenticationServices

// MARK: - Auth View
// Beautiful split-flap themed sign-in screen.
// Animated departure board welcomes the user before auth.

struct AuthView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(SettingsStore.self) private var settings

    @State private var animateTitle = false
    @State private var animateSubtitle = false
    @State private var showButtons = false
    @State private var currentWord = 0

    private let rotatingWords = ["EXPLORE", "DISCOVER", "ESCAPE", "WANDER", "FLY"]

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Animated split-flap title
                VStack(spacing: 16) {
                    SplitFlapRow(
                        text: "SOGOJET",
                        maxLength: 7,
                        size: .lg,
                        color: Color.sgWhite,
                        alignment: .center,
                        animate: animateTitle,
                        staggerMs: 60
                    )

                    // Rotating word under the title
                    SplitFlapRow(
                        text: rotatingWords[currentWord],
                        maxLength: 8,
                        size: .md,
                        color: Color.sgYellow,
                        alignment: .center,
                        animate: animateSubtitle,
                        staggerMs: 40,
                        animationID: currentWord
                    )
                }
                .padding(.bottom, 24)

                // Tagline
                Text("Find cheap flights.\nSwipe, save, book.")
                    .font(SGFont.body(size: 17))
                    .foregroundStyle(Color.sgWhiteDim)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .opacity(showButtons ? 1 : 0)

                Spacer()

                // Auth buttons
                if showButtons {
                    VStack(spacing: 12) {
                        // Sign in with Apple
                        SignInWithAppleButton(.signIn) { request in
                            request.requestedScopes = [.fullName, .email]
                        } onCompletion: { result in
                            switch result {
                            case .success(let auth):
                                handleAppleSignIn(auth)
                            case .failure:
                                break // handled by delegate
                            }
                        }
                        .signInWithAppleButtonStyle(.white)
                        .frame(height: 52)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .disabled(auth.isLoading)

                        // Sign in with Google
                        Button {
                            HapticEngine.light()
                            auth.signInWithGoogle()
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "g.circle.fill")
                                    .font(.system(size: 20))
                                Text("Continue with Google")
                                    .font(SGFont.bodyBold(size: 16))
                            }
                            .foregroundStyle(Color.sgBg)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(auth.isLoading)
                        .accessibilityLabel("Sign in with Google")

                        // Sign in with TikTok
                        Button {
                            HapticEngine.light()
                            auth.signInWithTikTok()
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "play.rectangle.fill")
                                    .font(.system(size: 18))
                                Text("Continue with TikTok")
                                    .font(SGFont.bodyBold(size: 16))
                            }
                            .foregroundStyle(Color.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color(red: 0.07, green: 0.07, blue: 0.07))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(Color.sgBorder, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(auth.isLoading)
                        .accessibilityLabel("Sign in with TikTok")

                        // Continue as guest
                        Button {
                            HapticEngine.light()
                            auth.continueAsGuest()
                            settings.hasOnboarded = true
                        } label: {
                            Text("Continue as Guest")
                                .font(SGFont.bodyBold(size: 15))
                                .foregroundStyle(Color.sgMuted)
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(Color.sgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .strokeBorder(Color.sgBorder, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Continue without signing in")

                        // Loading indicator
                        if auth.isLoading {
                            ProgressView()
                                .tint(Color.sgYellow)
                                .padding(.top, 8)
                        }

                        // Error message
                        if let error = auth.authError {
                            Text(error)
                                .font(SGFont.body(size: 13))
                                .foregroundStyle(Color.sgRed)
                                .multilineTextAlignment(.center)
                                .padding(.top, 4)
                        }
                    }
                    .padding(.horizontal, 32)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                Spacer().frame(height: 50)

                // Terms
                if showButtons {
                    HStack(spacing: 4) {
                        Text("By continuing, you agree to our")
                        if let url = URL(string: "https://sogojet.com/legal/terms") {
                            Link("Terms", destination: url)
                        }
                        Text("and")
                        if let url = URL(string: "https://sogojet.com/legal/privacy") {
                            Link("Privacy Policy", destination: url)
                        }
                    }
                    .font(.system(size: 10))
                    .foregroundStyle(Color.sgMuted.opacity(0.5))
                    .tint(Color.sgYellow)
                    .padding(.horizontal, 40)
                    .padding(.bottom, 16)
                }
            }
        }
        .onAppear {
            startAnimationSequence()
        }
    }

    // MARK: - Animation Sequence

    private func startAnimationSequence() {
        // Phase 1: Title flips in (0.3s delay)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            animateTitle = true
        }

        // Phase 2: Rotating word starts (1s delay)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            animateSubtitle = true
            startWordRotation()
        }

        // Phase 3: Buttons slide up (1.5s delay)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                showButtons = true
            }
        }
    }

    private func startWordRotation() {
        Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                guard !Task.isCancelled else { break }
                withAnimation {
                    currentWord = (currentWord + 1) % rotatingWords.count
                }
            }
        }
    }

    // MARK: - Apple Sign In

    private func handleAppleSignIn(_ authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              credential.identityToken != nil else { return }

        Task {
            // The AuthStore's delegate methods handle the actual authentication
            auth.signInWithApple()
        }
    }
}

#Preview {
    AuthView()
        .environment(AuthStore())
        .environment(SettingsStore())
}

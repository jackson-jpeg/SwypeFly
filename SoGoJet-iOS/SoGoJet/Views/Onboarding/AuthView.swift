import SwiftUI
import AuthenticationServices

// MARK: - Auth View
// Split-flap themed sign-in screen with LivingBoard background.

struct AuthView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(SettingsStore.self) private var settings

    @State private var animateTitle = false
    @State private var animateSubtitle = false
    @State private var showButtons = false
    @State private var currentWord = 0
    @State private var cyclingTask: Task<Void, Never>?

    private let rotatingWords = ["EXPLORE", "DISCOVER", "ESCAPE", "WANDER", "FLY"]

    var body: some View {
        ZStack {
            // Living board behind everything
            LivingBoardBackground()

            VStack(spacing: 0) {
                Spacer()

                // Brand mark
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

                Text(String(localized: "auth.tagline"))
                    .font(SGFont.accent(size: 17))
                    .foregroundStyle(Color.sgWhiteDim)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .opacity(showButtons ? 1 : 0)

                Spacer()

                // Auth buttons
                if showButtons {
                    VStack(spacing: 12) {
                        // Sign in with Apple (native ASButton)
                        SignInWithAppleButton(.signIn) { request in
                            request.requestedScopes = [.fullName, .email]
                        } onCompletion: { result in
                            switch result {
                            case .success(let authorization):
                                if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
                                    auth.handleAppleCredential(credential)
                                }
                            case .failure(let error):
                                if (error as? ASAuthorizationError)?.code != .canceled {
                                    auth.authError = String(localized: "auth.sign_in_failed")
                                }
                            }
                        }
                        .signInWithAppleButtonStyle(.white)
                        .frame(height: 52)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .disabled(auth.isLoading)

                        // Google — SGButton secondary
                        SGButton(
                            action: {
                                HapticEngine.light()
                                auth.signInWithGoogle()
                            },
                            style: .secondary,
                            size: .regular,
                            isEnabled: !auth.isLoading
                        ) {
                            HStack(spacing: Spacing.sm) {
                                Image(systemName: "g.circle.fill")
                                    .font(.system(size: 18))
                                Text(String(localized: "auth.continue_google"))
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .accessibilityLabel("Sign in with Google")

                        // TikTok — SGButton ghost
                        SGButton(
                            action: {
                                HapticEngine.light()
                                auth.signInWithTikTok()
                            },
                            style: .ghost,
                            size: .regular,
                            isEnabled: !auth.isLoading
                        ) {
                            HStack(spacing: Spacing.sm) {
                                Image(systemName: "play.rectangle.fill")
                                    .font(.system(size: 16))
                                Text(String(localized: "auth.continue_tiktok"))
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .accessibilityLabel("Sign in with TikTok")

                        // Continue as guest — ghost
                        SGButton(
                            action: {
                                HapticEngine.light()
                                auth.continueAsGuest()
                                settings.hasOnboarded = true
                            },
                            style: .ghost,
                            size: .regular
                        ) {
                            Text(String(localized: "auth.continue_guest"))
                                .frame(maxWidth: .infinity)
                        }
                        .accessibilityLabel("Continue without signing in")

                        if auth.isLoading {
                            ProgressView()
                                .tint(Color.sgYellow)
                                .padding(.top, 8)
                        }

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

                if showButtons {
                    HStack(spacing: 4) {
                        Text(String(localized: "auth.terms_prefix"))
                        if let url = URL(string: "https://sogojet.com/legal/terms") {
                            Link(String(localized: "auth.terms_link"), destination: url)
                        }
                        Text(String(localized: "auth.terms_and"))
                        if let url = URL(string: "https://sogojet.com/legal/privacy") {
                            Link(String(localized: "auth.privacy_link"), destination: url)
                        }
                    }
                    .font(.system(size: 10))
                    .foregroundStyle(Color.sgMuted.opacity(0.8))
                    .tint(Color.sgYellow)
                    .padding(.horizontal, 40)
                    .padding(.bottom, 16)
                }
            }
        }
        .onAppear { startAnimationSequence() }
        .onDisappear {
            cyclingTask?.cancel()
            cyclingTask = nil
        }
    }

    // MARK: - Animation Sequence

    private func startAnimationSequence() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            animateTitle = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            animateSubtitle = true
            startWordRotation()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(SGSpring.silky) {
                showButtons = true
            }
        }
    }

    private func startWordRotation() {
        cyclingTask?.cancel()
        cyclingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                guard !Task.isCancelled else { break }
                withAnimation {
                    currentWord = (currentWord + 1) % rotatingWords.count
                }
            }
        }
    }
}

#Preview {
    AuthView()
        .environment(AuthStore())
        .environment(SettingsStore())
}

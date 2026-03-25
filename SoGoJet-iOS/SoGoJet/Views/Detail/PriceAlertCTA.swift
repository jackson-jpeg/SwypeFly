import SwiftUI

// MARK: - PriceAlertCTA
// Honest fallback while native route-specific alerts are still being wired up.

struct PriceAlertCTA: View {
    let destinationName: String
    let price: Double?

    @Environment(SettingsStore.self) private var settingsStore
    @State private var showSignupSheet = false

    private var alertsEnabled: Bool {
        settingsStore.priceAlertsEnabled && !trimmedAlertEmail.isEmpty
    }

    private var trimmedAlertEmail: String {
        settingsStore.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var priceText: String? {
        price.map { "$\(Int($0))" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: alertsEnabled ? "checkmark.circle.fill" : "bell.badge.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(alertsEnabled ? Color.sgGreen : Color.sgYellow)

                Text(alertsEnabled ? "Deal emails on" : "Track this price")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
            }

            Text(descriptionText)
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgWhiteDim)
                .fixedSize(horizontal: false, vertical: true)

            if alertsEnabled {
                Label("Sending to \(maskedEmail(trimmedAlertEmail))", systemImage: "envelope.fill")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgGreen)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgGreen.opacity(0.14), in: Capsule())
            } else {
                Button {
                    HapticEngine.medium()
                    showSignupSheet = true
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "envelope.badge.fill")
                            .font(.system(size: 13, weight: .semibold))
                        Text("Email Me Deals")
                            .font(SGFont.bodyBold(size: 14))
                    }
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm + 2)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(alertsEnabled ? Color.sgGreen.opacity(0.3) : Color.sgYellow.opacity(0.25), lineWidth: 1)
        )
        .sheet(isPresented: $showSignupSheet) {
            PriceAlertSignupSheet(destinationName: destinationName, price: price)
        }
    }

    private var descriptionText: String {
        if alertsEnabled {
            return "Direct iPhone route alerts are still shipping, so we’ll keep you posted by email for now."
        }

        if let priceText {
            return "If fares around \(priceText) start showing up again, we can email you SoGoJet deal drops while direct route alerts finish shipping."
        }

        return "Leave your email and we’ll send SoGoJet deal drops while direct route alerts finish shipping on iPhone."
    }

    private func maskedEmail(_ email: String) -> String {
        let parts = email.split(separator: "@", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return email }

        let local = parts[0]
        let visiblePrefix = String(local.prefix(2))
        let maskCount = max(local.count - visiblePrefix.count, 2)
        return "\(visiblePrefix)\(String(repeating: "•", count: maskCount))@\(parts[1])"
    }
}

// MARK: - Price Alert Signup Sheet

struct PriceAlertSignupSheet: View {
    let destinationName: String
    let price: Double?

    @Environment(SettingsStore.self) private var settingsStore
    @Environment(ToastManager.self) private var toastManager
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @State private var submitTask: Task<Void, Never>?
    @FocusState private var emailFocused: Bool

    private var normalizedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var priceText: String? {
        price.map { "$\(Int($0))" }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        introSection
                        emailSection
                        footnoteSection
                        submitButton
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.md)
                }
            }
            .navigationTitle("Deal Emails")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(Color.sgMuted)
                    }
                    .accessibilityLabel("Close deal email signup")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            if email.isEmpty {
                email = settingsStore.alertEmail
            }
            emailFocused = normalizedEmail.isEmpty
        }
        .onDisappear {
            submitTask?.cancel()
        }
    }

    private var introSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.sgYellow)

                Text("Stay in the loop on \(destinationName)")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
            }

            Text(introCopy)
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgWhiteDim)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var emailSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Email")
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgWhite)

            TextField(
                "",
                text: $email,
                prompt: Text("name@example.com").foregroundStyle(Color.sgMuted)
            )
            .font(SGFont.bodyDefault)
            .foregroundStyle(Color.sgWhite)
            .keyboardType(.emailAddress)
            .textContentType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.done)
            .focused($emailFocused)
            .tint(Color.sgYellow)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm + Spacing.xs)
            .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(errorMessage == nil ? Color.sgBorder : Color.sgRed, lineWidth: 1)
            )
            .onSubmit {
                submit()
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgRed)
            }
        }
    }

    private var footnoteSection: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("What this does")
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgWhite)

            Text("This signs you up for SoGoJet deal emails while direct route-specific alerts finish shipping on iPhone. You can unsubscribe from any email we send.")
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.md)
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private var submitButton: some View {
        Button {
            submit()
        } label: {
            HStack(spacing: Spacing.sm) {
                if isSubmitting {
                    ProgressView()
                        .tint(Color.sgBg)
                } else {
                    Image(systemName: "envelope.badge.fill")
                        .font(.system(size: 14, weight: .semibold))
                }

                Text(isSubmitting ? "Saving..." : "Email Me Deal Drops")
                    .font(SGFont.bodyBold(size: 16))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
        }
        .disabled(isSubmitting)
    }

    private var introCopy: String {
        if let priceText {
            return "We spotted a fare around \(priceText) to \(destinationName). Leave your email and we’ll send SoGoJet deal drops while direct iPhone alerts catch up."
        }

        return "Leave your email and we’ll send SoGoJet deal drops while direct iPhone alerts catch up."
    }

    private func submit() {
        let email = normalizedEmail
        guard isValidEmail(email) else {
            errorMessage = "Enter a valid email address."
            HapticEngine.warning()
            return
        }

        errorMessage = nil
        isSubmitting = true
        submitTask?.cancel()

        submitTask = Task {
            do {
                let _: SubscribeResponse = try await APIClient.shared.fetch(.subscribe(email: email))
                guard !Task.isCancelled else { return }

                await MainActor.run {
                    settingsStore.alertEmail = email
                    settingsStore.priceAlertsEnabled = true
                    isSubmitting = false
                    HapticEngine.success()
                    toastManager.show(
                        message: "Deal emails enabled. We’ll keep you posted while direct route alerts finish shipping.",
                        type: .success
                    )
                    dismiss()
                }
            } catch {
                guard !Task.isCancelled else { return }

                await MainActor.run {
                    isSubmitting = false
                    errorMessage = error.localizedDescription
                    HapticEngine.error()
                }
            }
        }
    }

    private func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$"#
        return email.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }
}

private struct SubscribeResponse: Decodable {
    let message: String
    let subscribed: Bool
}

// MARK: - Preview

#Preview {
    PriceAlertCTA(destinationName: "Bali", price: 450)
        .padding()
        .background(Color.sgBg)
        .environment(SettingsStore())
        .environment(ToastManager())
}

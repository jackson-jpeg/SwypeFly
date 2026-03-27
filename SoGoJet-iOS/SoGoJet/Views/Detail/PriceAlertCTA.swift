import SwiftUI

// MARK: - PriceAlertCTA
// Route-specific price alerts for authenticated users, email fallback for guests.

struct PriceAlertCTA: View {
    let destinationName: String
    let iataCode: String
    let price: Double?

    @Environment(SettingsStore.self) private var settingsStore
    @Environment(AuthStore.self) private var auth
    @Environment(ToastManager.self) private var toastManager
    @State private var showSignupSheet = false
    @State private var isCreatingAlert = false
    @State private var alertCreated = false
    @State private var alertTask: Task<Void, Never>?

    private var alertsEnabled: Bool {
        alertCreated || (settingsStore.priceAlertsEnabled && !trimmedAlertEmail.isEmpty)
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

                Text(alertsEnabled ? "Price alert active" : "Track this price")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
            }

            Text(descriptionText)
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgWhiteDim)
                .fixedSize(horizontal: false, vertical: true)

            if alertCreated, let priceText {
                Label("Tracking \(destinationName) below \(priceText)", systemImage: "bell.fill")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgGreen)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgGreen.opacity(0.14), in: Capsule())
            } else if !alertCreated && alertsEnabled {
                Label("Sending to \(maskedEmail(trimmedAlertEmail))", systemImage: "envelope.fill")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgGreen)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgGreen.opacity(0.14), in: Capsule())
            } else {
                Button {
                    HapticEngine.medium()
                    if auth.isAuthenticated {
                        createRouteAlert()
                    } else {
                        showSignupSheet = true
                    }
                } label: {
                    HStack(spacing: Spacing.xs) {
                        if isCreatingAlert {
                            ProgressView()
                                .tint(Color.sgBg)
                        } else {
                            Image(systemName: auth.isAuthenticated ? "bell.badge.fill" : "envelope.badge.fill")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        Text(isCreatingAlert ? "Setting up..." : (auth.isAuthenticated ? "Track This Price" : "Email Me Deals"))
                            .font(SGFont.bodyBold(size: 14))
                    }
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm + 2)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
                .disabled(isCreatingAlert)
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
        .onDisappear {
            alertTask?.cancel()
        }
    }

    private var descriptionText: String {
        if alertCreated, let priceText {
            return "We’ll notify you when prices drop below \(priceText) for \(destinationName)."
        }

        if alertsEnabled {
            return "You’re getting deal alerts for \(destinationName) by email."
        }

        if let priceText {
            return "Get notified when fares to \(destinationName) drop below \(priceText)."
        }

        return "Set up a price alert and we’ll let you know when fares to \(destinationName) drop."
    }

    private func createRouteAlert() {
        isCreatingAlert = true
        alertTask?.cancel()

        alertTask = Task {
            do {
                let _: EmptyResponse = try await APIClient.shared.fetch(
                    .alertCreate(destination: iataCode, maxPrice: Int(price ?? 0))
                )
                guard !Task.isCancelled else { return }

                await MainActor.run {
                    isCreatingAlert = false
                    alertCreated = true
                    HapticEngine.success()
                    if let priceText {
                        toastManager.show(
                            message: "We’ll notify you when prices drop below \(priceText) for \(destinationName).",
                            type: .success
                        )
                    } else {
                        toastManager.show(
                            message: "Price alert set for \(destinationName).",
                            type: .success
                        )
                    }
                }
            } catch {
                guard !Task.isCancelled else { return }

                await MainActor.run {
                    isCreatingAlert = false
                    HapticEngine.error()
                    toastManager.show(
                        message: error.localizedDescription,
                        type: .error
                    )
                }
            }
        }
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

            Text("This signs you up for SoGoJet deal emails. Sign in to get instant route-specific price alerts instead. You can unsubscribe from any email we send.")
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
            return "We spotted a fare around \(priceText) to \(destinationName). Sign in for instant route alerts, or leave your email and we’ll send deal drops."
        }

        return "Sign in for instant route alerts to \(destinationName), or leave your email and we’ll send deal drops."
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
                        message: "Deal emails enabled for \(destinationName). Sign in for instant route alerts.",
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
    PriceAlertCTA(destinationName: "Bali", iataCode: "DPS", price: 450)
        .padding()
        .background(Color.sgBg)
        .environment(SettingsStore())
        .environment(AuthStore())
        .environment(ToastManager())
}

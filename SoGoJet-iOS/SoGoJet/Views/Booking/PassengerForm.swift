import SwiftUI

// MARK: - Passenger Form
// Collects passenger details using native SwiftUI Form controls.
// Real-time validation ensures all required fields are filled before continuing.

struct PassengerForm: View {
    @Environment(BookingStore.self) private var store

    @State private var title: PassengerTitle = .mr
    @State private var givenName = ""
    @State private var familyName = ""
    @State private var dateOfBirth = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var gender: PassengerData.Gender = .male
    @State private var email = ""
    @State private var phone = ""

    private var isValid: Bool {
        !givenName.trimmingCharacters(in: .whitespaces).isEmpty
        && !familyName.trimmingCharacters(in: .whitespaces).isEmpty
        && !email.trimmingCharacters(in: .whitespaces).isEmpty
        && isValidEmail(email)
        && dateOfBirth < Date()
    }

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.lg) {
                    header
                    formContent
                    continueButton
                }
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, Spacing.xl)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            SplitFlapRow(
                text: "PASSENGER",
                maxLength: 10,
                size: .md,
                color: Color.sgYellow,
                animate: true,
                staggerMs: 40
            )
            Spacer()
        }
        .padding(.top, Spacing.md)
    }

    // MARK: - Form Content

    private var formContent: some View {
        VStack(spacing: Spacing.md) {
            // Title picker
            VStack(alignment: .leading, spacing: Spacing.xs) {
                fieldLabel("Title")
                Picker("Title", selection: $title) {
                    ForEach(PassengerTitle.allCases, id: \.self) { t in
                        Text(t.rawValue).tag(t)
                    }
                }
                .pickerStyle(.segmented)
                .tint(Color.sgYellow)
            }

            // Given name
            fieldGroup("Given Name", hint: "As on passport") {
                TextField("", text: $givenName)
                    .textContentType(.givenName)
                    .autocorrectionDisabled()
            }

            // Family name
            fieldGroup("Family Name", hint: "As on passport") {
                TextField("", text: $familyName)
                    .textContentType(.familyName)
                    .autocorrectionDisabled()
            }

            // Date of birth
            VStack(alignment: .leading, spacing: Spacing.xs) {
                fieldLabel("Date of Birth")
                DatePicker(
                    "",
                    selection: $dateOfBirth,
                    in: ...Date(),
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)
                .labelsHidden()
                .tint(Color.sgYellow)
                .colorScheme(.dark)
            }

            // Gender
            VStack(alignment: .leading, spacing: Spacing.xs) {
                fieldLabel("Gender")
                Picker("Gender", selection: $gender) {
                    Text("Male").tag(PassengerData.Gender.male)
                    Text("Female").tag(PassengerData.Gender.female)
                }
                .pickerStyle(.segmented)
                .tint(Color.sgYellow)
            }

            // Email
            fieldGroup("Email", hint: nil) {
                TextField("", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }

            // Phone
            fieldGroup("Phone", hint: nil) {
                TextField("", text: $phone)
                    .textContentType(.telephoneNumber)
                    .keyboardType(.phonePad)
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Field Helpers

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(SGFont.bodyBold(size: 12))
            .foregroundStyle(Color.sgMuted)
            .textCase(.uppercase)
            .tracking(0.8)
    }

    private func fieldGroup<Content: View>(_ label: String, hint: String?, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            fieldLabel(label)
            content()
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgWhite)
                .padding(Spacing.sm + Spacing.xs)
                .background(Color.sgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .strokeBorder(Color.sgBorder, lineWidth: 1)
                )

            if let hint {
                Text(hint)
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgFaint)
            }
        }
    }

    // MARK: - Continue Button

    private var continueButton: some View {
        Button {
            applyToStore()
            Task {
                await store.proceedToSeats()
            }
        } label: {
            Text("Continue")
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(isValid ? Color.sgBg : Color.sgFaint)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(isValid ? Color.sgYellow : Color.sgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
        .disabled(!isValid)
    }

    // MARK: - Helpers

    private func applyToStore() {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        store.passenger = PassengerData(
            firstName: givenName.trimmingCharacters(in: .whitespaces),
            lastName: familyName.trimmingCharacters(in: .whitespaces),
            email: email.trimmingCharacters(in: .whitespaces),
            phone: phone.trimmingCharacters(in: .whitespaces),
            dateOfBirth: formatter.string(from: dateOfBirth),
            gender: gender
        )
    }

    private func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }
}

// MARK: - Passenger Title

enum PassengerTitle: String, CaseIterable {
    case mr = "Mr"
    case mrs = "Mrs"
    case ms = "Ms"
    case miss = "Miss"
    case dr = "Dr"
}

// MARK: - Preview

#Preview("Passenger Form") {
    PassengerForm()
        .environment(BookingStore())
}

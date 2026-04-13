import SwiftUI

// MARK: - Traveler Edit View
// Form to add or edit a saved traveler profile.

struct TravelerEditView: View {
    let traveler: SavedTraveler?

    @Environment(TravelerStore.self) private var travelerStore
    @Environment(\.dismiss) private var dismiss

    @State private var givenName = ""
    @State private var familyName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var dateOfBirth: Date = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var dobSet = false
    @State private var gender = ""
    @State private var title = ""
    @State private var passportNumber = ""
    @State private var passportExpiry: Date = Calendar.current.date(byAdding: .year, value: 5, to: Date()) ?? Date()
    @State private var passportExpirySet = false
    @State private var nationality = "US"
    @State private var isSaving = false

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private var isEditing: Bool { traveler != nil }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    nameSection
                    contactSection
                    personalSection
                    passportSection

                    // SGButton save/cancel — Phase 6 spec
                    VStack(spacing: Spacing.sm) {
                        SGButton(
                            isSaving ? "Saving…" : (isEditing ? "Update Traveler" : "Save Traveler"),
                            style: .primary
                        ) {
                            Task { await save() }
                        }
                        .disabled(!isValid || isSaving)

                        SGButton("Cancel", style: .ghost) {
                            dismiss()
                        }
                    }
                    .padding(.top, Spacing.sm)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.sgBg)
            .navigationTitle(isEditing ? "Edit Traveler" : "Add Traveler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if isSaving {
                        ProgressView()
                            .tint(Color.sgYellow)
                            .scaleEffect(0.8)
                    }
                }
            }
        }
        .onAppear {
            if let t = traveler {
                givenName = t.givenName
                familyName = t.familyName
                email = t.email ?? ""
                phone = t.phoneNumber ?? ""
                gender = t.gender ?? ""
                title = t.title ?? ""
                passportNumber = t.passportNumber ?? ""
                nationality = t.nationality

                if let dob = t.bornOn, let date = Self.dateFormatter.date(from: dob) {
                    dateOfBirth = date
                    dobSet = true
                }
                if let exp = t.passportExpiry, let date = Self.dateFormatter.date(from: exp) {
                    passportExpiry = date
                    passportExpirySet = true
                }
            }
        }
    }

    private var isValid: Bool {
        !givenName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !familyName.trimmingCharacters(in: .whitespaces).isEmpty &&
        (email.isEmpty || email.contains("@")) &&
        (nationality.isEmpty || (nationality.count == 2 && nationality.allSatisfy(\.isLetter)))
    }

    // MARK: - Sections

    private var nameSection: some View {
        formSection("Name") {
            HStack(spacing: 8) {
                titlePicker
                formField("First Name", text: $givenName)
            }
            formField("Last Name", text: $familyName)
        }
    }

    private var contactSection: some View {
        formSection("Contact") {
            formField("Email", text: $email, keyboard: .emailAddress)
            formField("Phone", text: $phone, keyboard: .phonePad)
        }
    }

    private var personalSection: some View {
        formSection("Personal") {
            VStack(alignment: .leading, spacing: 4) {
                Text("Date of Birth")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                DatePicker("", selection: $dateOfBirth, in: ...Date(), displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .tint(Color.sgYellow)
                    .onChange(of: dateOfBirth) { _, _ in dobSet = true }
            }
            genderPicker
            formField("Nationality (2-letter code)", text: $nationality)
        }
    }

    private var passportSection: some View {
        formSection("Passport") {
            formField("Passport Number", text: $passportNumber)
            VStack(alignment: .leading, spacing: 4) {
                Text("Passport Expiry")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                DatePicker("", selection: $passportExpiry, in: Date()..., displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .tint(Color.sgYellow)
                    .onChange(of: passportExpiry) { _, _ in passportExpirySet = true }
            }
            Text("Passport data is encrypted at rest.")
                .font(SGFont.body(size: 11))
                .foregroundStyle(Color.sgMuted.opacity(0.7))
        }
    }

    // MARK: - Pickers

    private var titlePicker: some View {
        Menu {
            ForEach(["Mr", "Mrs", "Ms", "Miss", "Dr"], id: \.self) { t in
                Button(t) { title = t.lowercased() }
            }
        } label: {
            Text(title.isEmpty ? "Title" : title.capitalized)
                .font(SGFont.body(size: 14))
                .foregroundStyle(title.isEmpty ? Color.sgMuted : Color.sgWhite)
                .padding(10)
                .frame(width: 70)
                .background(Color.sgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                .overlay(RoundedRectangle(cornerRadius: Radius.sm).strokeBorder(Color.sgBorder))
        }
        .accessibilityLabel("Title: \(title.isEmpty ? "not set" : title.capitalized)")
    }

    private var genderPicker: some View {
        HStack(spacing: 8) {
            Text("Gender")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .frame(width: 60, alignment: .leading)

            ForEach(["male", "female", "other"], id: \.self) { g in
                Button {
                    gender = g
                } label: {
                    Text(g.capitalized)
                        .font(SGFont.bodyBold(size: 12))
                        .foregroundStyle(gender == g ? Color.sgBg : Color.sgWhiteDim)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            gender == g ? Color.sgYellow : Color.sgBorder,
                            in: Capsule()
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(g.capitalized)
                .accessibilityAddTraits(gender == g ? .isSelected : [])
            }
        }
    }

    // MARK: - Helpers

    private func formSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Playfair italic section heads per Phase 6 spec
            Text(title.uppercased())
                .sgFont(.accent)
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)

            SGCard(elevation: .flush) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    content()
                }
            }
        }
    }

    private func formField(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(placeholder, text: text)
            .font(SGFont.body(size: 14))
            .foregroundStyle(Color.sgWhite)
            .keyboardType(keyboard)
            .autocorrectionDisabled()
            .textInputAutocapitalization(.words)
            .padding(10)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            .overlay(RoundedRectangle(cornerRadius: Radius.sm).strokeBorder(Color.sgBorder))
    }

    // MARK: - Save

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        let request = TravelerCreateRequest(
            givenName: givenName.trimmingCharacters(in: .whitespaces),
            familyName: familyName.trimmingCharacters(in: .whitespaces),
            bornOn: dobSet ? Self.dateFormatter.string(from: dateOfBirth) : nil,
            gender: gender.isEmpty ? nil : gender,
            title: title.isEmpty ? nil : title,
            email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
            phoneNumber: phone.isEmpty ? nil : phone.trimmingCharacters(in: .whitespaces),
            passportNumber: passportNumber.isEmpty ? nil : passportNumber.trimmingCharacters(in: .whitespaces),
            passportExpiry: passportExpirySet ? Self.dateFormatter.string(from: passportExpiry) : nil,
            nationality: nationality.isEmpty ? nil : nationality
        )

        if let t = traveler {
            if await travelerStore.updateTraveler(id: t.id, request) != nil {
                HapticEngine.success()
                dismiss()
            } else {
                HapticEngine.error()
            }
        } else {
            if await travelerStore.createTraveler(request) != nil {
                HapticEngine.success()
                dismiss()
            } else {
                HapticEngine.error()
            }
        }
    }
}

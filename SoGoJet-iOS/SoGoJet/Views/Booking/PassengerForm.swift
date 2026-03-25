import SwiftUI

struct PassengerForm: View {
    @Environment(BookingStore.self) private var store

    @State private var title: PassengerTitle = .mr
    @State private var givenName = ""
    @State private var familyName = ""
    @State private var dateOfBirth = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var gender: PassengerData.Gender = .male
    @State private var email = ""
    @State private var phone = ""
    @State private var passportNumber = ""
    @State private var passportExpiry = Calendar.current.date(byAdding: .year, value: 5, to: Date()) ?? Date()
    @State private var nationality = "US"
    @State private var hasSeededState = false
    @FocusState private var focusedField: FormField?

    private enum FormField: Hashable {
        case givenName, familyName, passportNumber, nationality, email, phone
    }

    private var isValid: Bool {
        !givenName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && !familyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && isValidEmail(email)
        && phone.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5
        && dateOfBirth < Date()
    }

    private var routeTitle: String {
        let origin = store.searchOrigin ?? store.deal?.nearbyOrigin ?? "ORG"
        let destination = store.searchDestination ?? store.deal?.iataCode ?? "DST"
        return "\(origin) - \(destination)"
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                header
                travelerTicket
                identityDeck
                documentsDeck
                contactDeck
                reassuranceDeck
                actionCluster
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    focusedField = nil
                }
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgYellow)
            }
        }
        .onAppear {
            seedFromStoreIfNeeded()
        }
    }

    private var header: some View {
        VintageTerminalCollectionHeader(
            title: "Passenger Details",
            subtitle: "Enter details as they appear on your passport or ID."
        )
        .padding(.top, Spacing.sm)
    }

    private var travelerTicket: some View {
        VintageTravelTicket(tone: .amber) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    VintageTerminalSectionLabel(text: "Passenger", tone: .amber)
                    Text(routeTitle)
                        .font(SGFont.display(size: 30))
                        .foregroundStyle(Color.sgWhite)
                }

                Spacer(minLength: 0)

                Text(store.selectedOffer.map { "$\(Int($0.price.rounded()))" } ?? store.deal?.priceFormatted ?? "--")
                    .font(SGFont.display(size: 30))
                    .foregroundStyle(Color.sgYellow)
            }
        } content: {
            VintageTerminalRouteDisplay(
                originCode: store.searchOrigin ?? store.deal?.nearbyOrigin ?? "ORG",
                originLabel: "Departure",
                destinationCode: store.searchDestination ?? store.deal?.iataCode ?? "DST",
                destinationLabel: store.deal?.destination ?? "Destination",
                detail: travelerWindowDetail,
                tone: .amber
            )
        } footer: {
            HStack {
                VintageTerminalCaptionBlock(title: "Cabin", value: cabinLabel, tone: .amber)
                Spacer()
                VintageTerminalCaptionBlock(title: "Travelers", value: "\(store.passengerCount)", tone: .ivory, alignment: .trailing)
            }
        }
    }

    private var identityDeck: some View {
        VintageTerminalPanel(
            title: "Personal Info",
            subtitle: "Enter your name exactly as it appears on your ID.",
            stamp: "Identity",
            tone: .amber
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                selectionRow(title: "Title", tone: .amber) {
                    ForEach(PassengerTitle.allCases, id: \.self) { item in
                        VintageTerminalSelectablePill(
                            title: item.rawValue,
                            isSelected: title == item,
                            tone: .amber
                        ) {
                            title = item
                        }
                    }
                }

                fieldShell(label: "Given name", hint: "As shown on the passport or government ID.") {
                    TextField("", text: $givenName, prompt: Text("Alex").foregroundStyle(Color.sgMuted))
                        .textContentType(.givenName)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.words)
                        .foregroundStyle(Color.sgWhite)
                        .focused($focusedField, equals: .givenName)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .familyName }
                }

                fieldShell(label: "Family name", hint: "Last name as shown on your ID.") {
                    TextField("", text: $familyName, prompt: Text("Morgan").foregroundStyle(Color.sgMuted))
                        .textContentType(.familyName)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.words)
                        .foregroundStyle(Color.sgWhite)
                        .focused($focusedField, equals: .familyName)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .email }
                }

                HStack(alignment: .top, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        fieldLabel("Date of birth")
                        DatePicker("", selection: $dateOfBirth, in: ...Date(), displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .labelsHidden()
                            .tint(Color.sgYellow)
                            .colorScheme(.dark)
                            .padding(.horizontal, Spacing.sm + Spacing.xs)
                            .padding(.vertical, Spacing.sm + Spacing.xs)
                            .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md)
                                    .strokeBorder(Color.sgBorder, lineWidth: 1)
                            )
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        fieldLabel("Gender")
                        selectionRow(title: nil, tone: .ivory) {
                            ForEach(PassengerData.Gender.allCases, id: \.self) { option in
                                VintageTerminalSelectablePill(
                                    title: option.rawValue.capitalized,
                                    isSelected: gender == option,
                                    tone: .ivory
                                ) {
                                    gender = option
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var documentsDeck: some View {
        VintageTerminalPanel(
            title: "Travel Documents",
            subtitle: "Optional — may be required for international flights.",
            stamp: "Docs",
            tone: .ivory
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                fieldShell(label: "Passport number", hint: "Leave blank if you want to finish this booking first and add it later.") {
                    TextField("", text: $passportNumber, prompt: Text("123456789").foregroundStyle(Color.sgMuted))
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .foregroundStyle(Color.sgWhite)
                        .focused($focusedField, equals: .passportNumber)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .nationality }
                }

                HStack(alignment: .top, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        fieldLabel("Passport expiry")
                        DatePicker("", selection: $passportExpiry, in: Date()..., displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .labelsHidden()
                            .tint(Color.sgYellow)
                            .colorScheme(.dark)
                            .padding(.horizontal, Spacing.sm + Spacing.xs)
                            .padding(.vertical, Spacing.sm + Spacing.xs)
                            .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md)
                                    .strokeBorder(Color.sgBorder, lineWidth: 1)
                            )
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    fieldShell(label: "Nationality", hint: "Use the ISO country code or full country name.") {
                        TextField("", text: $nationality, prompt: Text("US").foregroundStyle(Color.sgMuted))
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .foregroundStyle(Color.sgWhite)
                            .focused($focusedField, equals: .nationality)
                            .submitLabel(.next)
                            .onSubmit { focusedField = .email }
                    }
                }
            }
        }
    }

    private var contactDeck: some View {
        VintageTerminalPanel(
            title: "Contact Info",
            subtitle: "We'll send booking updates here.",
            stamp: "Reach",
            tone: .moss
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                fieldShell(label: "Email", hint: "Used for the booking receipt and any route changes.") {
                    TextField("", text: $email, prompt: Text("name@example.com").foregroundStyle(Color.sgMuted))
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .foregroundStyle(Color.sgWhite)
                        .focused($focusedField, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .phone }
                }

                fieldShell(label: "Phone", hint: "A mobile number is best for airline updates.") {
                    TextField("", text: $phone, prompt: Text("+1 555 000 0000").foregroundStyle(Color.sgMuted))
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                        .foregroundStyle(Color.sgWhite)
                        .focused($focusedField, equals: .phone)
                }
            }
        }
    }

    private var reassuranceDeck: some View {
        VintageTerminalPanel(
            title: "Good to Know",
            subtitle: "",
            stamp: "Ready",
            tone: .ember
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalChecklistItem(
                    title: "Your details are only used for this booking",
                    detail: "Nothing is issued until you confirm on the review screen.",
                    tone: .amber
                )
                VintageTerminalChecklistItem(
                    title: "You can still change seats after this step",
                    detail: "You can choose seats in the next step.",
                    tone: .ivory
                )
                VintageTerminalChecklistItem(
                    title: "Route alerts coming soon",
                    detail: "We'll email you if anything changes.",
                    tone: .moss
                )
            }
        }
    }

    private var actionCluster: some View {
        VStack(spacing: Spacing.sm) {
            Button {
                applyToStore()
                Task {
                    await store.proceedToSeats()
                }
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "person.text.rectangle.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Continue to Seat Map")
                        .font(SGFont.bodyBold(size: 16))
                    Spacer()
                    Text(isValid ? "Ready" : "Incomplete")
                        .font(SGFont.bodyBold(size: 11))
                }
                .foregroundStyle(isValid ? Color.sgBg : Color.sgFaint)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.md)
                .background(isValid ? Color.sgYellow : Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(isValid ? Color.sgYellow : Color.sgBorder, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .disabled(!isValid)

            VintageTerminalSecondaryButton(
                title: "Back to Flight Selection",
                subtitle: "Choose a different fare or adjust dates.",
                icon: "chevron.left",
                tone: .ivory,
                fillsWidth: true
            ) {
                store.goBack()
            }
        }
    }

    private var travelerWindowDetail: String {
        let departure = (store.searchDepartureDate ?? store.deal?.bestDepartureDate ?? "---").shortDate
        let returnDate = (store.searchReturnDate ?? store.deal?.bestReturnDate ?? "---").shortDate
        return "\(departure) to \(returnDate)"
    }

    private var cabinLabel: String {
        guard let rawValue = store.selectedOffer?.cabinClass,
              let cabinClass = BookingCabinClass(rawValue: rawValue) else {
            return store.searchCabinClass.displayName
        }
        return cabinClass.displayName
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(SGFont.bodyBold(size: 10))
            .foregroundStyle(Color.sgMuted)
            .tracking(1.4)
    }

    private func selectionRow<Content: View>(title: String?, tone: VintageTerminalTone, @ViewBuilder content: @escaping () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            if let title {
                fieldLabel(title)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.xs) {
                    content()
                }
            }
        }
    }

    private func fieldShell<Content: View>(label: String, hint: String?, @ViewBuilder content: @escaping () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            fieldLabel(label)
            VintageTerminalInsetPanel(tone: .ivory) {
                content()
                    .font(SGFont.bodyDefault)
                    .padding(.horizontal, Spacing.sm + Spacing.xs)
                    .padding(.vertical, Spacing.sm + Spacing.xs)
                    .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .strokeBorder(Color.sgBorder, lineWidth: 1)
                    )
            }

            if let hint {
                Text(hint)
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func seedFromStoreIfNeeded() {
        guard !hasSeededState else { return }
        hasSeededState = true

        let passenger = store.passenger
        if let passengerTitle = PassengerTitle(rawValue: passenger.title), !passenger.title.isEmpty {
            title = passengerTitle
        }
        givenName = passenger.firstName
        familyName = passenger.lastName
        email = passenger.email
        phone = passenger.phone
        passportNumber = passenger.passportNumber
        nationality = passenger.nationality.isEmpty ? "US" : passenger.nationality
        gender = passenger.gender

        if let parsedBirthDate = Self.storageFormatter.date(from: passenger.dateOfBirth) {
            dateOfBirth = parsedBirthDate
        }
        if let parsedPassportExpiry = Self.storageFormatter.date(from: passenger.passportExpiry) {
            passportExpiry = parsedPassportExpiry
        }
    }

    private func applyToStore() {
        store.passenger = PassengerData(
            title: title.rawValue,
            firstName: givenName.trimmingCharacters(in: .whitespacesAndNewlines),
            lastName: familyName.trimmingCharacters(in: .whitespacesAndNewlines),
            email: email.trimmingCharacters(in: .whitespacesAndNewlines),
            phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
            dateOfBirth: Self.storageFormatter.string(from: dateOfBirth),
            gender: gender,
            passportNumber: passportNumber.trimmingCharacters(in: .whitespacesAndNewlines),
            passportExpiry: Self.storageFormatter.string(from: passportExpiry),
            nationality: nationality.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        )
    }

    private func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }

    private static let storageFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
}

enum PassengerTitle: String, CaseIterable {
    case mr = "Mr"
    case mrs = "Mrs"
    case ms = "Ms"
    case miss = "Miss"
    case dr = "Dr"
}

#Preview("Passenger Form") {
    PassengerForm()
        .environment(BookingStore())
}

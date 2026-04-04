import SwiftUI
import StripePaymentSheet

// MARK: - Hotel Search View
// Entry point for hotel search, quote, and booking flow.

struct HotelSearchView: View {
    let deal: Deal

    @Environment(HotelStore.self) private var store
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var checkInDate = Calendar.current.date(byAdding: .day, value: 14, to: Date())!
    @State private var checkOutDate = Calendar.current.date(byAdding: .day, value: 17, to: Date())!
    @State private var guests: Int = 1
    @State private var guestName: String = ""
    @State private var guestEmail: String = ""
    @State private var isPreparingPayment = false

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private var nights: Int {
        max(1, Calendar.current.dateComponents([.day], from: checkInDate, to: checkOutDate).day ?? 1)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: Spacing.lg) {
                        headerSection

                        switch store.step {
                        case .idle, .failed:
                            searchForm
                        case .searching:
                            loadingSection
                        case let .results(hotels):
                            resultsSection(hotels)
                        case .quoting:
                            loadingSection
                        case let .review(quote):
                            quoteSection(quote)
                        case .paying:
                            loadingSection
                        case let .confirmed(confirmation):
                            confirmationSection(confirmation)
                        }

                        if case let .failed(message) = store.step {
                            errorSection(message)
                        }
                    }
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, 40)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        store.reset()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(Color.sgWhite)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text("Hotels in \(deal.city)")
                        .font(SGFont.bodyBold(size: 16))
                        .foregroundStyle(Color.sgWhite)
                }
            }
        }
        .onAppear {
            if guestName.isEmpty, let name = auth.userName { guestName = name }
            if guestEmail.isEmpty, let email = auth.userEmail { guestEmail = email }
        }
        .onDisappear { store.reset() }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "building.2")
                .font(.system(size: 28))
                .foregroundStyle(Color.sgYellow)
                .padding(.top, Spacing.lg)

            Text("Find hotels in \(deal.city)")
                .font(SGFont.display(size: 22))
                .foregroundStyle(Color.sgWhite)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Search Form

    private var searchForm: some View {
        VStack(spacing: Spacing.lg) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("CHECK-IN")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.2)
                DatePicker("", selection: $checkInDate, in: Date()..., displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .tint(Color.sgYellow)
                    .labelsHidden()
            }

            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("CHECK-OUT")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.2)
                DatePicker("", selection: $checkOutDate, in: checkInDate.addingTimeInterval(86400)..., displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .tint(Color.sgYellow)
                    .labelsHidden()
            }

            HStack {
                Text("GUESTS")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.2)
                Spacer()
                Stepper("\(guests)", value: $guests, in: 1...10)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
            }

            Text("\(nights) night\(nights == 1 ? "" : "s")")
                .font(SGFont.body(size: 13))
                .foregroundStyle(Color.sgMuted)

            Button {
                HapticEngine.medium()
                guard let lat = deal.latitude, let lon = deal.longitude else { return }
                Task {
                    await store.search(
                        latitude: lat,
                        longitude: lon,
                        checkIn: dateFormatter.string(from: checkInDate),
                        checkOut: dateFormatter.string(from: checkOutDate),
                        guests: guests
                    )
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                    Text("Search Hotels")
                        .font(SGFont.bodyBold(size: 16))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(Color.sgYellow)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(deal.latitude == nil || deal.longitude == nil)
        }
        .padding(Spacing.lg)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .stroke(Color.sgBorder.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Loading

    private var loadingSection: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .tint(Color.sgYellow)
                .scaleEffect(1.2)
            Text("Searching hotels...")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Results

    private func resultsSection(_ hotels: [HotelSearchResult]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("\(hotels.count) HOTELS FOUND")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)

            ForEach(hotels) { hotel in
                hotelCard(hotel)
            }
        }
    }

    private func hotelCard(_ hotel: HotelSearchResult) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            if let photoUrl = hotel.photoUrl {
                CachedAsyncImage(url: photoUrl) {
                    Rectangle().fill(Color.sgSurface)
                }
                .frame(height: 160)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }

            HStack {
                Text(hotel.name)
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgWhite)
                Spacer()
                HStack(spacing: 2) {
                    ForEach(0..<hotel.rating, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.sgYellow)
                    }
                }
            }

            if let score = hotel.reviewScore {
                HStack(spacing: 4) {
                    Text(String(format: "%.1f", score))
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgYellow)
                    if let count = hotel.reviewCount {
                        Text("(\(count) reviews)")
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgMuted)
                    }
                }
            }

            Text("From $\(Int(hotel.cheapestTotalAmount))/night")
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgGreen)

            if !hotel.rooms.isEmpty {
                ForEach(hotel.rooms) { room in
                    Button {
                        HapticEngine.light()
                        Task { await store.getQuote(hotel: hotel, room: room) }
                    } label: {
                        HStack {
                            Text(room.name)
                                .font(SGFont.body(size: 13))
                                .foregroundStyle(Color.sgWhite)
                            Spacer()
                            Text("$\(Int(room.pricePerNight))/night")
                                .font(SGFont.bodyBold(size: 13))
                                .foregroundStyle(Color.sgYellow)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.sgMuted)
                        }
                        .padding(Spacing.md)
                        .background(Color.sgBg)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(Spacing.lg)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .stroke(Color.sgBorder.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Quote Review

    private func quoteSection(_ quote: HotelQuote) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("BOOKING SUMMARY")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)

            if let name = quote.hotelName {
                Text(name)
                    .font(SGFont.bodyBold(size: 18))
                    .foregroundStyle(Color.sgWhite)
            }

            if let roomName = quote.roomName {
                Text(roomName)
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhiteDim)
            }

            HStack {
                VStack(alignment: .leading) {
                    Text("Check-in")
                        .font(SGFont.caption)
                        .foregroundStyle(Color.sgMuted)
                    Text(quote.checkIn)
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("Check-out")
                        .font(SGFont.caption)
                        .foregroundStyle(Color.sgMuted)
                    Text(quote.checkOut)
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                }
            }

            if let nights = quote.nights, let ppn = quote.pricePerNight {
                Text("\(nights) nights x $\(Int(ppn))/night")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
            }

            Divider().background(Color.sgBorder)

            HStack {
                Text("Total")
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgWhite)
                Spacer()
                Text("$\(Int(quote.totalAmount))")
                    .font(SGFont.display(size: 24))
                    .foregroundStyle(Color.sgYellow)
            }

            if let policy = quote.cancellationPolicy {
                Text(policy)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgGreen)
            }

            // Guest details
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("GUEST DETAILS")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.2)

                TextField("Full Name", text: $guestName)
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhite)
                    .padding(Spacing.md)
                    .background(Color.sgBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

                TextField("Email", text: $guestEmail)
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhite)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .padding(Spacing.md)
                    .background(Color.sgBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            }

            if let error = store.paymentError {
                Text(error)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgOrange)
            }

            if let sheet = store.paymentSheet {
                PaymentSheet.PaymentButton(paymentSheet: sheet) { result in
                    switch result {
                    case .completed:
                        Task {
                            await store.completeBookingAfterPayment(
                                quote: quote,
                                guestName: guestName.trimmingCharacters(in: .whitespacesAndNewlines),
                                guestEmail: guestEmail.trimmingCharacters(in: .whitespacesAndNewlines)
                            )
                        }
                    case .canceled:
                        break
                    case let .failed(error):
                        store.paymentError = error.localizedDescription
                        HapticEngine.error()
                    }
                } content: {
                    HStack(spacing: 8) {
                        Image(systemName: "creditcard")
                        Text("Pay $\(Int(quote.totalAmount))")
                            .font(SGFont.bodyBold(size: 16))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
            } else {
                Button {
                    HapticEngine.medium()
                    guard !guestName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                          !guestEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        store.paymentError = "Please enter your name and email."
                        return
                    }
                    isPreparingPayment = true
                    Task {
                        await store.preparePayment(quote: quote, email: guestEmail)
                        isPreparingPayment = false
                    }
                } label: {
                    HStack(spacing: 8) {
                        if isPreparingPayment {
                            ProgressView()
                                .tint(Color.sgBg)
                        } else {
                            Image(systemName: "creditcard")
                        }
                        Text("Book Now")
                            .font(SGFont.bodyBold(size: 16))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(isPreparingPayment)
            }

            Button {
                store.goBack()
            } label: {
                Text("Back to Results")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
        }
        .padding(Spacing.lg)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .stroke(Color.sgBorder.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Confirmation

    private func confirmationSection(_ confirmation: HotelBookingConfirmation) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.sgGreen)

            Text("Booking Confirmed!")
                .font(SGFont.display(size: 22))
                .foregroundStyle(Color.sgWhite)

            Text("Ref: \(confirmation.confirmationReference)")
                .font(.system(size: 16, design: .monospaced))
                .foregroundStyle(Color.sgYellow)

            if let hotel = confirmation.hotelName {
                Text(hotel)
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhiteDim)
            }

            Button {
                store.reset()
                dismiss()
            } label: {
                Text("Done")
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
    }

    // MARK: - Error

    private func errorSection(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 24))
                .foregroundStyle(Color.sgOrange)

            Text(message)
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgWhiteDim)
                .multilineTextAlignment(.center)

            Button {
                store.reset()
            } label: {
                Text("Try Again")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgYellow.opacity(0.12))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity)
    }
}

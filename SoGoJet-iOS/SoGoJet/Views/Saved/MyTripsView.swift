import SwiftUI

// MARK: - My Trips View
// Phase 4: horizontal ticker rail at the top showing upcoming trips
// with flapping live countdown ("PARIS · DEPARTS 42D 06H 14M"),
// updated every 60s via TimelineView(.periodic).

struct MyTripsView: View {
    @Environment(BookingHistoryStore.self) private var historyStore
    @Environment(AuthStore.self) private var auth
    @Environment(Router.self) private var router

    @State private var selectedBooking: BookingHistoryItem?

    var body: some View {
        Group {
            if !auth.isAuthenticated {
                signInPrompt
            } else if historyStore.isLoading && historyStore.bookings.isEmpty {
                loadingState
            } else if let error = historyStore.error, historyStore.bookings.isEmpty {
                errorState(error)
            } else if historyStore.bookings.isEmpty {
                emptyState
            } else {
                bookingList
            }
        }
        .refreshable {
            await historyStore.fetchHistory()
        }
        .task {
            if auth.isAuthenticated {
                await historyStore.fetchHistory()
            }
        }
        .sheet(item: $selectedBooking) { booking in
            BookingDetailView(booking: booking)
        }
    }

    // MARK: - Booking List

    private var bookingList: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Ticker rail — upcoming trips with live countdown
            if !historyStore.upcomingBookings.isEmpty {
                upcomingTickerRail
            }

            if !historyStore.upcomingBookings.isEmpty {
                sectionHeader("Upcoming")
                ForEach(historyStore.upcomingBookings) { booking in
                    BookingCard(booking: booking, isUpcoming: true)
                        .onTapGesture {
                            HapticEngine.selection()
                            selectedBooking = booking
                        }
                }
            }

            if !historyStore.pastBookings.isEmpty {
                sectionHeader("Past Trips")
                ForEach(historyStore.pastBookings) { booking in
                    BookingCard(booking: booking, isUpcoming: false)
                        .onTapGesture {
                            HapticEngine.selection()
                            selectedBooking = booking
                        }
                }
            }
        }
    }

    // MARK: - Ticker Rail

    /// Horizontal scrollable rail showing split-flap countdowns for upcoming trips.
    /// TimelineView fires every 60 seconds so the countdown stays fresh.
    private var upcomingTickerRail: some View {
        TimelineView(.periodic(from: Date(), by: 60)) { timeline in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm) {
                    ForEach(historyStore.upcomingBookings.prefix(6)) { booking in
                        tickerPill(booking: booking, now: timeline.date)
                    }
                }
                .padding(.horizontal, Spacing.xs)
                .padding(.vertical, Spacing.xs)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Upcoming trips ticker")
    }

    private func tickerPill(booking: BookingHistoryItem, now: Date) -> some View {
        let countdown = countdownString(from: now, to: booking.departureDate)
        let label = "\(booking.destinationIata) · DEPARTS \(countdown)"

        return SGCard(elevation: .lifted, padding: 0) {
            HStack(spacing: Spacing.xs) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.sgYellow)
                    .accessibilityHidden(true)

                SplitFlapText(
                    text: label,
                    style: .ticker,
                    maxLength: label.count + 2,
                    animate: true
                )
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs + 2)
        }
        .fixedSize()
        .accessibilityLabel("Flight to \(booking.destinationCity), departs in \(countdown)")
        .onTapGesture {
            HapticEngine.selection()
            selectedBooking = booking
        }
    }

    /// Produces a compact countdown string like "42D 06H 14M".
    private func countdownString(from now: Date, to departure: Date) -> String {
        let interval = departure.timeIntervalSince(now)
        guard interval > 0 else { return "NOW" }
        let totalSeconds = Int(interval)
        let days = totalSeconds / 86400
        let hours = (totalSeconds % 86400) / 3600
        let minutes = (totalSeconds % 3600) / 60

        if days > 0 {
            return String(format: "%dD %02dH %02dM", days, hours, minutes)
        } else if hours > 0 {
            return String(format: "%dH %02dM", hours, minutes)
        } else {
            return String(format: "%dM", max(minutes, 1))
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(SGFont.bodyBold(size: 11))
            .foregroundStyle(Color.sgMuted)
            .tracking(1.2)
    }

    // MARK: - States

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            Spacer()
            Image(systemName: "airplane.circle")
                .font(.system(size: 48))
                .foregroundStyle(Color.sgMuted.opacity(0.5))
                .accessibilityHidden(true)
            Text(String(localized: "trips.empty.title"))
                .font(SGFont.bodyBold(size: 18))
                .foregroundStyle(Color.sgWhite)
            Text(String(localized: "trips.empty.subtitle"))
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
            Button {
                router.activeTab = .feed
            } label: {
                Text(String(localized: "trips.empty.cta"))
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(String(localized: "trips.empty.cta"))
            .padding(.top, Spacing.sm)
            Spacer()
        }
    }

    private var signInPrompt: some View {
        VStack(spacing: Spacing.md) {
            Spacer()
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 48))
                .foregroundStyle(Color.sgMuted.opacity(0.5))
                .accessibilityHidden(true)
            Text(String(localized: "trips.sign_in.title"))
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgWhite)
            Text(String(localized: "trips.sign_in.subtitle"))
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
            Spacer()
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(Color.sgRed.opacity(0.6))
                .accessibilityHidden(true)
            Text(String(localized: "trips.error.title"))
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgWhite)
            Text(message)
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
            Button {
                Task { await historyStore.fetchHistory() }
            } label: {
                Text(String(localized: "trips.error.retry"))
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(String(localized: "trips.error.retry"))
            Spacer()
        }
    }

    private var loadingState: some View {
        VStack {
            Spacer()
            ProgressView()
                .tint(Color.sgYellow)
            Text("Loading trips...")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .padding(.top, Spacing.sm)
            Spacer()
        }
    }
}

// MARK: - Booking Card

private struct BookingCard: View {
    let booking: BookingHistoryItem
    let isUpcoming: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Top row: route + status badge
            HStack {
                HStack(spacing: 6) {
                    Text(booking.originIata)
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgWhite)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.sgMuted)
                    Text(booking.destinationIata)
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgYellow)
                }

                Spacer()

                statusBadge
            }

            // City + airline
            HStack {
                Text(booking.destinationCity)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                if !booking.airline.isEmpty {
                    Text("·")
                        .foregroundStyle(Color.sgMuted)
                    Text(booking.airline)
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgMuted)
                }
            }

            // Dates
            HStack(spacing: 4) {
                Image(systemName: "calendar")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.sgMuted)
                Text(booking.formattedDepartureDate)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                if let returnDate = booking.formattedReturnDate {
                    Text("–")
                        .foregroundStyle(Color.sgMuted)
                    Text(returnDate)
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }
            }

            // Bottom: price + reference
            HStack {
                Text(booking.formattedPrice)
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgGreen)

                Spacer()

                if !booking.bookingReference.isEmpty {
                    Text(booking.bookingReference)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.sgMuted)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.sgBorder, in: RoundedRectangle(cornerRadius: Radius.sm))
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(isUpcoming ? Color.sgYellow.opacity(0.2) : Color.sgBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(booking.originIata) to \(booking.destinationIata), \(booking.destinationCity), \(booking.formattedPrice), \(booking.statusInfo.label)")
        .accessibilityHint(String(localized: "trips.booking.hint"))
    }

    private var statusBadge: some View {
        let info = booking.statusInfo
        let color: Color = {
            switch info.color {
            case "green": return Color.sgGreen
            case "red": return Color.sgRed
            case "yellow": return Color.sgYellow
            default: return Color.sgMuted
            }
        }()

        return Text(info.label)
            .font(SGFont.bodyBold(size: 10))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: Radius.sm))
    }
}

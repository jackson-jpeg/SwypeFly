import SwiftUI

// MARK: - My Trips View
// Displays booking history split into upcoming and past sections.

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
            Text("No trips yet")
                .font(SGFont.bodyBold(size: 18))
                .foregroundStyle(Color.sgWhite)
            Text("Book your first flight and it'll appear here.")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
            Button {
                router.activeTab = .feed
            } label: {
                Text("Find Flights")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .buttonStyle(.plain)
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
            Text("Sign in to see your trips")
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgWhite)
            Text("Your bookings and travel history will appear here.")
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
            Text("Couldn't load trips")
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgWhite)
            Text(message)
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
            Button {
                Task { await historyStore.fetchHistory() }
            } label: {
                Text("Try Again")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .buttonStyle(.plain)
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

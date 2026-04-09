import SwiftUI
import Combine

// MARK: - Flight Status View
// Shows real-time flight status for a booking.

struct FlightStatusView: View {
    let booking: BookingHistoryItem

    @State private var flightStatus: FlightStatusResponse?
    @State private var isLoading = true
    @State private var error: String?
    @State private var timerCancellable: AnyCancellable?
    @Environment(\.dismiss) private var dismiss // 5 min

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    statusHeader
                    if let status = flightStatus {
                        if status.segments.isEmpty {
                            noSegmentInfo
                        } else {
                            segmentCards(status.segments)
                        }
                        lastUpdatedLabel(status.lastUpdated)
                    } else if isLoading {
                        loadingState
                    } else if let error {
                        errorState(error)
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.sgBg)
            .navigationTitle("Flight Status")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.sgYellow)
                }
            }
        }
        .task { await fetchStatus() }
        .onAppear {
            guard booking.isUpcoming else { return }
            timerCancellable = Timer.publish(every: 300, on: .main, in: .common)
                .autoconnect()
                .sink { _ in
                    Task { await fetchStatus() }
                }
        }
        .onDisappear {
            timerCancellable?.cancel()
            timerCancellable = nil
        }
    }

    // MARK: - Status Header

    private var statusHeader: some View {
        VStack(spacing: Spacing.md) {
            // Route
            HStack(spacing: Spacing.md) {
                Text(booking.originIata)
                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgWhite)
                Image(systemName: "airplane")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.sgYellow)
                Text(booking.destinationIata)
                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgYellow)
            }

            // Overall status
            overallStatusBadge
                .frame(maxWidth: .infinity)

            // Countdown for upcoming flights
            if booking.isUpcoming {
                countdownView
            }
        }
        .padding(Spacing.lg)
        .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private var overallStatusBadge: some View {
        let status = flightStatus?.status ?? booking.statusInfo.0.lowercased()
        let (label, color) = statusDisplay(for: status)

        return HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(color.opacity(0.12), in: Capsule())
    }

    private var countdownView: some View {
        Group {
            let formatter = DateFormatter()
            let _ = formatter.dateFormat = "yyyy-MM-dd"
            let _ = formatter.locale = Locale(identifier: "en_US_POSIX")
            if let date = formatter.date(from: booking.departureDate) {
                let days = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
                if days > 0 {
                    Text("\(days) day\(days == 1 ? "" : "s") until departure")
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgMuted)
                } else if days == 0 {
                    Text("Departing today!")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgYellow)
                }
            }
        }
    }

    // MARK: - Segments

    private func segmentCards(_ segments: [FlightStatusSegment]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("FLIGHT SEGMENTS")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)

            ForEach(segments) { segment in
                segmentCard(segment)
            }
        }
    }

    private func segmentCard(_ segment: FlightStatusSegment) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Flight number + status
            HStack {
                Text(segment.flightNumber)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgWhite)

                Spacer()

                let (label, color) = statusDisplay(for: segment.status)
                Text(label)
                    .font(SGFont.bodyBold(size: 11))
                    .foregroundStyle(color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(color.opacity(0.12), in: Capsule())
            }

            // Route
            HStack(spacing: 6) {
                Text(segment.origin)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                Image(systemName: "arrow.right")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.sgMuted)
                Text(segment.destination)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
            }

            // Times
            if !segment.scheduledDeparture.isEmpty {
                HStack(spacing: Spacing.md) {
                    timeBlock(label: "Scheduled", time: segment.scheduledDeparture)
                    if let estimated = segment.estimatedDeparture {
                        timeBlock(label: "Estimated", time: estimated)
                    }
                }
            }

            // Gate/Terminal
            HStack(spacing: Spacing.md) {
                if let terminal = segment.terminal {
                    infoBlock(label: "Terminal", value: terminal)
                }
                if let gate = segment.gate {
                    infoBlock(label: "Gate", value: gate)
                }
                if let delay = segment.delayMinutes, delay > 0 {
                    infoBlock(label: "Delay", value: "\(delay) min")
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private func timeBlock(label: String, time: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(SGFont.body(size: 10))
                .foregroundStyle(Color.sgMuted)
            Text(formatTime(time))
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
        }
    }

    private func infoBlock(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(SGFont.body(size: 10))
                .foregroundStyle(Color.sgMuted)
            Text(value)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgYellow)
        }
    }

    private var noSegmentInfo: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "airplane.circle")
                .font(.system(size: 32))
                .foregroundStyle(Color.sgMuted.opacity(0.5))
            Text("Detailed flight info not yet available")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
            Text("Check back closer to your departure date.")
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgMuted.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xl)
    }

    private func lastUpdatedLabel(_ timestamp: String) -> some View {
        HStack {
            Spacer()
            Text("Updated \(formatTime(timestamp))")
                .font(SGFont.body(size: 11))
                .foregroundStyle(Color.sgMuted.opacity(0.6))
        }
    }

    private var loadingState: some View {
        VStack {
            ProgressView()
                .tint(Color.sgYellow)
            Text("Checking flight status...")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .padding(.top, Spacing.sm)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xl)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32))
                .foregroundStyle(Color.sgRed)
            Text(message)
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
            Button("Retry") {
                Task { await fetchStatus() }
            }
            .font(SGFont.bodyBold(size: 14))
            .foregroundStyle(Color.sgYellow)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xl)
    }

    private func statusDisplay(for status: String) -> (String, Color) {
        switch status.lowercased() {
        case "on_time", "scheduled":
            return ("On Time", Color.sgGreen)
        case "delayed", "schedule_changed":
            return ("Delayed", Color.sgYellow)
        case "cancelled", "canceled":
            return ("Cancelled", Color.sgRed)
        case "departed":
            return ("Departed", Color(hex: 0x4DA6FF))
        case "landed", "arrived":
            return ("Landed", Color.sgGreen)
        default:
            return (status.capitalized, Color.sgMuted)
        }
    }

    private func formatTime(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: isoString) {
            let display = DateFormatter()
            display.dateFormat = "h:mm a"
            return display.string(from: date)
        }
        // Try without fractional seconds
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: isoString) {
            let display = DateFormatter()
            display.dateFormat = "h:mm a"
            return display.string(from: date)
        }
        // Try date-time without timezone
        let plain = DateFormatter()
        plain.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        plain.locale = Locale(identifier: "en_US_POSIX")
        if let date = plain.date(from: isoString) {
            let display = DateFormatter()
            display.dateFormat = "h:mm a"
            return display.string(from: date)
        }
        return isoString
    }

    // MARK: - Fetch

    private func fetchStatus() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let response: FlightStatusResponse = try await APIClient.shared.fetch(
                .flightStatus(bookingId: booking.id)
            )
            flightStatus = response
        } catch {
            self.error = flightStatusMessage(for: error)
        }
    }

    /// Convert errors into contextual messages for flight status.
    private func flightStatusMessage(for error: Error) -> String {
        let route = "\(booking.originIata) \u{2192} \(booking.destinationIata)"

        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return "No internet connection. Connect to Wi-Fi or cellular to check your \(route) flight status."
            case .timedOut:
                return "The status check timed out. Tap Retry to try again."
            default:
                return "Couldn't reach the server to check your \(route) flight. Please try again."
            }
        }

        if let apiError = error as? APIError {
            switch apiError {
            case .httpError(let code, _) where code == 404:
                return "Flight status for \(route) isn't available yet. Check back closer to departure."
            case .httpError(let code, _) where (500...599).contains(code):
                return "The flight status service is temporarily down. Your booking is unaffected — please try again shortly."
            default:
                return "Couldn't load flight status for \(route). Tap Retry to try again."
            }
        }

        return "Couldn't load flight status for \(route). Tap Retry to try again."
    }
}

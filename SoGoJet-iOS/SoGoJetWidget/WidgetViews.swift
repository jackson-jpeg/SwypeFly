import SwiftUI
import WidgetKit

// MARK: - Design Constants

private enum WD {
    // Colors
    static let bg        = Color(red: 0.039, green: 0.039, blue: 0.039) // #0A0A0A
    static let cellBg    = Color(red: 0.094, green: 0.094, blue: 0.094) // #181818
    static let cellTop   = Color(red: 0.118, green: 0.118, blue: 0.118) // #1E1E1E
    static let border    = Color(red: 0.188, green: 0.188, blue: 0.188) // #303030
    static let gap       = Color(red: 0.012, green: 0.012, blue: 0.012) // #030303
    static let white     = Color(red: 0.961, green: 0.961, blue: 0.961) // #F5F5F5
    static let muted     = Color(red: 0.4, green: 0.4, blue: 0.4)
    static let gold      = Color(red: 0.969, green: 0.910, blue: 0.627) // #F7E8A0
    static let green     = Color(red: 0.290, green: 0.871, blue: 0.498) // #4ADE80
}

// MARK: - Split Flap Cell

struct SplitFlapCell: View {
    let character: Character
    let color: Color
    let w: CGFloat
    let h: CGFloat
    let fs: CGFloat

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                WD.cellTop
                    .frame(height: h / 2 - 0.5)
                WD.gap
                    .frame(height: 1)
                WD.cellBg
                    .frame(height: h / 2 - 0.5)
            }
            .clipShape(RoundedRectangle(cornerRadius: 2.5))
            .overlay(
                RoundedRectangle(cornerRadius: 2.5)
                    .strokeBorder(WD.border, lineWidth: 0.5)
            )

            Text(String(character))
                .font(.system(size: fs, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .minimumScaleFactor(0.7)
        }
        .frame(width: w, height: h)
    }
}

// MARK: - Split Flap Text

struct SplitFlapText: View {
    let text: String
    let length: Int
    let color: Color
    let w: CGFloat
    let h: CGFloat
    let fs: CGFloat
    var align: HorizontalAlignment = .leading

    private var chars: [Character] {
        let upper = text.uppercased()
        if upper.count >= length { return Array(upper.prefix(length)) }
        if align == .trailing {
            return Array(String(repeating: " ", count: length - upper.count) + upper)
        }
        return Array(upper + String(repeating: " ", count: length - upper.count))
    }

    var body: some View {
        HStack(spacing: 1) {
            ForEach(Array(chars.enumerated()), id: \.offset) { _, c in
                SplitFlapCell(character: c, color: color, w: w, h: h, fs: fs)
            }
        }
    }
}

// MARK: - Flight Row

struct FlightRow: View {
    let flight: WidgetFlight
    let highlighted: Bool
    let cw: CGFloat   // cell width
    let ch: CGFloat   // cell height
    let fs: CGFloat   // font size
    let destLen: Int   // destination char count

    var body: some View {
        HStack(spacing: 0) {
            // Gold indicator bar
            RoundedRectangle(cornerRadius: 1)
                .fill(highlighted ? WD.gold : Color.clear)
                .frame(width: 3, height: ch)
                .padding(.trailing, 3)

            // Destination (full name, no IATA code — saves 4 chars of space)
            SplitFlapText(text: flight.city, length: destLen, color: WD.white, w: cw, h: ch, fs: fs)

            Spacer(minLength: 3)

            // "from" label — widget prices are always estimates
            Text("from")
                .font(.system(size: max(fs - 5, 6), weight: .medium))
                .foregroundStyle(WD.muted.opacity(0.6))
                .padding(.trailing, 2)

            // Price (5 cells: $ + up to 4 digits, e.g. "$1299")
            SplitFlapText(text: "$\(flight.price)", length: 5, color: priceColor, w: cw, h: ch, fs: fs, align: .trailing)
        }
    }

    private var priceColor: Color {
        switch flight.dealTier {
        case "amazing": return WD.green
        case "great":   return WD.gold
        default:        return WD.white
        }
    }
}

// MARK: - Small Board (1 row — cheapest deal + countdown)
//
// Widgets can't run animations at full fidelity, so SplitFlapText falls back
// to static rendered state here. We use the custom SplitFlapText (widget-local)
// which never animates.

struct SmallBoardView: View {
    let entry: FlightEntry

    // Small widget ~155x155pt
    private let cw: CGFloat = 14
    private let ch: CGFloat = 20
    private let fs: CGFloat = 11

    private var topFlight: WidgetFlight? { entry.flights.first }

    var body: some View {
        VStack(spacing: 0) {
            // Header line
            HStack(spacing: 3) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(WD.gold)
                Text(entry.departureCode)
                    .font(.system(size: 8, weight: .heavy, design: .monospaced))
                    .foregroundStyle(WD.muted)
                    .tracking(1)
                Spacer()
                Text("DEALS")
                    .font(.system(size: 7, weight: .heavy, design: .monospaced))
                    .foregroundStyle(WD.muted.opacity(0.5))
                    .tracking(1)
            }

            Spacer(minLength: 4)

            if let flight = topFlight {
                Link(destination: deepLink(for: flight)) {
                    VStack(alignment: .leading, spacing: 5) {
                        // City name — full width
                        SplitFlapText(text: flight.city, length: 8, color: WD.white,
                                      w: cw, h: ch, fs: fs)

                        // Price row
                        HStack(spacing: 3) {
                            Text("from")
                                .font(.system(size: max(fs - 4, 6), weight: .medium))
                                .foregroundStyle(WD.muted.opacity(0.6))
                            SplitFlapText(text: "$\(flight.price)", length: 5,
                                          color: priceColor(flight), w: cw, h: ch, fs: fs,
                                          align: .trailing)
                        }

                        // Countdown label
                        Text(countdownLabel)
                            .font(.system(size: 8, weight: .medium, design: .monospaced))
                            .foregroundStyle(WD.muted.opacity(0.5))
                    }
                }
            } else {
                // Placeholder rows
                VStack(alignment: .leading, spacing: 5) {
                    emptyRow(cw: cw, ch: ch, destLen: 8)
                    emptyRow(cw: cw, ch: ch, destLen: 8)
                }
                .opacity(0.3)
            }

            Spacer(minLength: 2)

            // Mini branding
            HStack {
                Spacer()
                Text("SOGOJET")
                    .font(.system(size: 5, weight: .heavy, design: .monospaced))
                    .foregroundStyle(WD.muted.opacity(0.25))
                    .tracking(1.5)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WD.bg)
        // Subtle paper grain at low opacity for widget legibility
        .overlay(
            WD.bg.opacity(0.06)
        )
    }

    private var countdownLabel: String {
        let cal = Calendar.current
        let comps = cal.dateComponents([.day, .hour], from: Date(), to: entry.date.addingTimeInterval(3600))
        if let h = comps.hour, let d = comps.day {
            if d > 0 { return "UPDATES IN \(d)D \(h)H" }
            if h > 0 { return "UPDATES IN \(h)H" }
        }
        return "LIVE"
    }

    private func priceColor(_ flight: WidgetFlight) -> Color {
        switch flight.dealTier {
        case "amazing": return WD.green
        case "great":   return WD.gold
        default:        return WD.white
        }
    }
}

// MARK: - Medium Board (3 rows, fills entire widget)

struct MediumBoardView: View {
    let entry: FlightEntry

    // Sized to fill medium widget (~329x155pt)
    // With 15pt cells: 12 dest chars + 5 price chars = 17 × 15 = 255pt + gaps ≈ fits
    private let cw: CGFloat = 15
    private let ch: CGFloat = 22
    private let fs: CGFloat = 12

    var body: some View {
        VStack(spacing: 0) {
            // Compact header
            HStack(spacing: 4) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(WD.gold)
                Text("DEPARTURES")
                    .font(.system(size: 9, weight: .heavy, design: .monospaced))
                    .foregroundStyle(WD.white)
                    .tracking(1)
                Spacer()
                Text(entry.departureCode)
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(WD.muted)
            }

            Spacer(minLength: 2)

            // Flight rows — fill available vertical space
            VStack(spacing: 8) {
                let flights = Array(entry.flights.prefix(3))
                ForEach(Array(flights.enumerated()), id: \.element.id) { i, flight in
                    Link(destination: deepLink(for: flight)) {
                        FlightRow(flight: flight, highlighted: i == 0, cw: cw, ch: ch, fs: fs, destLen: 12)
                    }
                }
                ForEach(0..<max(0, 3 - entry.flights.count), id: \.self) { _ in
                    emptyRow(cw: cw, ch: ch, destLen: 12)
                }
            }

            Spacer(minLength: 2)

            // Minimal branding, tight to bottom
            HStack {
                Spacer()
                HStack(spacing: 2) {
                    Image(systemName: "airplane")
                        .font(.system(size: 5, weight: .bold))
                        .foregroundStyle(WD.gold)
                    Text("SOGOJET")
                        .font(.system(size: 6, weight: .heavy, design: .monospaced))
                        .foregroundStyle(WD.muted.opacity(0.3))
                        .tracking(1.5)
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WD.bg)
    }
}

// MARK: - Large Board (5 rows)

struct LargeBoardView: View {
    let entry: FlightEntry

    // Large widget has more space — use bigger cells
    private let cw: CGFloat = 16
    private let ch: CGFloat = 24
    private let fs: CGFloat = 13

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 5) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(WD.gold)
                Text("DEPARTURES")
                    .font(.system(size: 12, weight: .heavy, design: .monospaced))
                    .foregroundStyle(WD.white)
                    .tracking(2)
                Spacer()
                Text(entry.departureCode)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(WD.muted)
            }

            Spacer(minLength: 4)

            // 5 flight rows — fill available space, no column labels
            VStack(spacing: 8) {
                let flights = Array(entry.flights.prefix(5))
                ForEach(Array(flights.enumerated()), id: \.element.id) { i, flight in
                    Link(destination: deepLink(for: flight)) {
                        FlightRow(flight: flight, highlighted: i == 0, cw: cw, ch: ch, fs: fs, destLen: 13)
                    }

                    if i < min(flights.count, 5) - 1 {
                        Rectangle().fill(WD.border.opacity(0.3)).frame(height: 0.5).padding(.leading, 6)
                    }
                }
                ForEach(0..<max(0, 5 - entry.flights.count), id: \.self) { _ in
                    emptyRow(cw: cw, ch: ch, destLen: 13)
                }
            }

            Spacer(minLength: 0)

            Rectangle().fill(WD.border.opacity(0.3)).frame(height: 0.5)
                .padding(.bottom, 6)

            // Footer: timestamp + branding
            HStack {
                Text(entry.date, style: .time)
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .foregroundStyle(WD.muted.opacity(0.3))
                Spacer()
                HStack(spacing: 3) {
                    Image(systemName: "airplane")
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(WD.gold)
                    Text("SOGOJET")
                        .font(.system(size: 8, weight: .heavy, design: .monospaced))
                        .foregroundStyle(WD.muted.opacity(0.4))
                        .tracking(2)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WD.bg)
    }
}

// MARK: - Helpers

private func emptyRow(cw: CGFloat, ch: CGFloat, destLen: Int) -> some View {
    HStack(spacing: 0) {
        Color.clear.frame(width: 3, height: ch).padding(.trailing, 3)
        HStack(spacing: 1) {
            ForEach(0..<(destLen + 5), id: \.self) { _ in
                RoundedRectangle(cornerRadius: 2.5)
                    .fill(WD.cellBg)
                    .overlay(RoundedRectangle(cornerRadius: 2.5).strokeBorder(WD.border, lineWidth: 0.5))
                    .frame(width: cw, height: ch)
            }
        }
    }
    .opacity(0.3)
}

private func deepLink(for flight: WidgetFlight) -> URL {
    // Use the sogojet:// custom URL scheme so iOS routes taps to the app
    // instead of opening Safari (universal links require Associated Domains).
    let encoded = flight.id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? flight.id
    return URL(string: "sogojet://destination/\(encoded)") ?? URL(string: "sogojet://home")!
}

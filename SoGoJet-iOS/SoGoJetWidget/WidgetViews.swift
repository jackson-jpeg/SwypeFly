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
                .padding(.trailing, 4)

            // IATA code (3 chars)
            SplitFlapText(text: flight.iataCode, length: 3, color: highlighted ? WD.white : WD.muted, w: cw, h: ch, fs: fs)

            Spacer().frame(width: 4)

            // Destination
            SplitFlapText(text: flight.city, length: destLen, color: WD.white, w: cw, h: ch, fs: fs)

            Spacer(minLength: 4)

            // Price
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

// MARK: - Medium Board (3 rows, fills entire widget)

struct MediumBoardView: View {
    let entry: FlightEntry

    // Larger cells to fill the medium widget (155pt height available)
    private let cw: CGFloat = 16
    private let ch: CGFloat = 22
    private let fs: CGFloat = 13

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 4) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(WD.gold)
                Text("DEPARTURES")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .foregroundStyle(WD.white)
                    .tracking(1.5)
                Spacer()
                Text(entry.departureCode)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(WD.muted)
            }
            .padding(.bottom, 6)

            // Separator
            Rectangle().fill(WD.border.opacity(0.5)).frame(height: 0.5)
                .padding(.bottom, 4)

            // Column labels
            HStack(spacing: 0) {
                Color.clear.frame(width: 7)
                Text("CODE").frame(width: cw * 3 + 2, alignment: .leading)
                Spacer().frame(width: 4)
                Text("DESTINATION").frame(alignment: .leading)
                Spacer()
                Text("FARE").frame(alignment: .trailing)
            }
            .font(.system(size: 7, weight: .bold, design: .monospaced))
            .foregroundStyle(WD.muted.opacity(0.5))
            .padding(.bottom, 4)

            // Flight rows — fill remaining space
            VStack(spacing: 6) {
                let flights = Array(entry.flights.prefix(3))
                ForEach(Array(flights.enumerated()), id: \.element.id) { i, flight in
                    Link(destination: deepLink(for: flight)) {
                        FlightRow(flight: flight, highlighted: i == 0, cw: cw, ch: ch, fs: fs, destLen: 8)
                    }
                }
                // Fill empty slots
                ForEach(0..<max(0, 3 - entry.flights.count), id: \.self) { _ in
                    emptyRow(cw: cw, ch: ch, destLen: 8)
                }
            }

            Spacer(minLength: 0)

            // Branding
            HStack {
                Spacer()
                HStack(spacing: 3) {
                    Image(systemName: "airplane")
                        .font(.system(size: 6, weight: .bold))
                        .foregroundStyle(WD.gold)
                    Text("SOGOJET")
                        .font(.system(size: 7, weight: .heavy, design: .monospaced))
                        .foregroundStyle(WD.muted.opacity(0.4))
                        .tracking(2)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WD.bg)
    }
}

// MARK: - Large Board (5 rows)

struct LargeBoardView: View {
    let entry: FlightEntry

    private let cw: CGFloat = 18
    private let ch: CGFloat = 26
    private let fs: CGFloat = 15

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 5) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(WD.gold)
                Text("DEPARTURES")
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .foregroundStyle(WD.white)
                    .tracking(2)
                Spacer()
                Text(entry.departureCode)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(WD.muted)
            }
            .padding(.bottom, 8)

            Rectangle().fill(WD.border.opacity(0.5)).frame(height: 0.5)
                .padding(.bottom, 6)

            // Column labels
            HStack(spacing: 0) {
                Color.clear.frame(width: 7)
                Text("CODE").frame(width: cw * 3 + 2, alignment: .leading)
                Spacer().frame(width: 4)
                Text("DESTINATION").frame(alignment: .leading)
                Spacer()
                Text("FARE").frame(alignment: .trailing)
            }
            .font(.system(size: 8, weight: .bold, design: .monospaced))
            .foregroundStyle(WD.muted.opacity(0.5))
            .padding(.bottom, 6)

            // 5 flight rows — fill available space
            VStack(spacing: 8) {
                let flights = Array(entry.flights.prefix(5))
                ForEach(Array(flights.enumerated()), id: \.element.id) { i, flight in
                    Link(destination: deepLink(for: flight)) {
                        FlightRow(flight: flight, highlighted: i == 0, cw: cw, ch: ch, fs: fs, destLen: 9)
                    }

                    if i < min(flights.count, 5) - 1 {
                        Rectangle().fill(WD.border.opacity(0.3)).frame(height: 0.5).padding(.leading, 7)
                    }
                }
                // Fill empty
                ForEach(0..<max(0, 5 - entry.flights.count), id: \.self) { _ in
                    emptyRow(cw: cw, ch: ch, destLen: 9)
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
        Color.clear.frame(width: 3, height: ch).padding(.trailing, 4)
        HStack(spacing: 1) {
            ForEach(0..<(3 + destLen + 5), id: \.self) { _ in
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
    URL(string: "https://sogojet.com/destination/\(flight.id)") ?? URL(string: "https://sogojet.com")!
}

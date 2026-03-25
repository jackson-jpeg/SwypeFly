import SwiftUI
import WidgetKit

// MARK: - Design Constants

private enum WidgetDesign {
    // Colors
    static let background    = Color(red: 0.039, green: 0.039, blue: 0.039) // #0A0A0A
    static let cellBg        = Color(red: 0.094, green: 0.094, blue: 0.094) // #181818
    static let cellBgTop     = Color(red: 0.118, green: 0.118, blue: 0.118) // #1E1E1E
    static let cellBorder    = Color(red: 0.188, green: 0.188, blue: 0.188) // #303030
    static let gapLine       = Color(red: 0.012, green: 0.012, blue: 0.012) // #030303
    static let textWhite     = Color(red: 0.961, green: 0.961, blue: 0.961) // #F5F5F5
    static let textMuted     = Color(red: 0.533, green: 0.533, blue: 0.533) // #888888
    static let gold          = Color(red: 0.969, green: 0.910, blue: 0.627) // #F7E8A0
    static let green         = Color(red: 0.290, green: 0.871, blue: 0.498) // #4ADE80
    static let surface       = Color(red: 0.078, green: 0.078, blue: 0.078) // #141414

    // Medium widget cell sizing
    enum Medium {
        static let cellW: CGFloat     = 14
        static let cellH: CGFloat     = 18
        static let fontSize: CGFloat  = 11
        static let cellGap: CGFloat   = 1
        static let colGap: CGFloat    = 5
        static let rowHeight: CGFloat = 26
    }

    // Large widget cell sizing
    enum Large {
        static let cellW: CGFloat     = 16
        static let cellH: CGFloat     = 22
        static let fontSize: CGFloat  = 13
        static let cellGap: CGFloat   = 1
        static let colGap: CGFloat    = 5
        static let rowHeight: CGFloat = 30
    }
}

// MARK: - Split Flap Cell (Single Character)

/// A single character rendered as a split-flap cell — dark rounded rect with
/// a horizontal gap line bisecting it, monospace white text.
/// This is a static widget view (no animation), but the visual treatment
/// matches the animated SplitFlapChar in the main app.
struct SplitFlapCell: View {
    let character: Character
    let color: Color
    let cellWidth: CGFloat
    let cellHeight: CGFloat
    let fontSize: CGFloat

    var body: some View {
        ZStack {
            // Cell background with subtle top-half gradient
            VStack(spacing: 0) {
                WidgetDesign.cellBgTop
                    .frame(height: cellHeight / 2)
                Rectangle()
                    .fill(WidgetDesign.gapLine)
                    .frame(height: 1)
                WidgetDesign.cellBg
                    .frame(height: cellHeight / 2)
            }
            .clipShape(RoundedRectangle(cornerRadius: 2))
            .overlay(
                RoundedRectangle(cornerRadius: 2)
                    .strokeBorder(WidgetDesign.cellBorder, lineWidth: 0.5)
            )

            // Character
            Text(String(character))
                .font(.system(size: fontSize, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .minimumScaleFactor(0.8)
        }
        .frame(width: cellWidth, height: cellHeight)
    }
}

// MARK: - Split Flap Text (Row of Cells)

/// Renders a string as a row of split-flap character cells.
/// Pads or truncates to exactly `length` characters.
struct SplitFlapText: View {
    let text: String
    let length: Int
    let color: Color
    let cellWidth: CGFloat
    let cellHeight: CGFloat
    let fontSize: CGFloat
    var alignment: HorizontalAlignment = .leading

    private var paddedChars: [Character] {
        let upper = text.uppercased()
        if upper.count >= length {
            return Array(upper.prefix(length))
        }
        switch alignment {
        case .trailing:
            return Array(String(repeating: " ", count: length - upper.count) + upper)
        default:
            return Array(upper + String(repeating: " ", count: length - upper.count))
        }
    }

    var body: some View {
        HStack(spacing: 1) {
            ForEach(Array(paddedChars.enumerated()), id: \.offset) { _, char in
                SplitFlapCell(
                    character: char,
                    color: color,
                    cellWidth: cellWidth,
                    cellHeight: cellHeight,
                    fontSize: fontSize
                )
            }
        }
    }
}

// MARK: - Flight Row

/// A single departure board row: IATA code | destination city | price
struct FlightRow: View {
    let flight: WidgetFlight
    let isHighlighted: Bool
    let size: WidgetFamily

    private var design: (cellW: CGFloat, cellH: CGFloat, fontSize: CGFloat, colGap: CGFloat) {
        switch size {
        case .systemLarge:
            return (WidgetDesign.Large.cellW, WidgetDesign.Large.cellH,
                    WidgetDesign.Large.fontSize, WidgetDesign.Large.colGap)
        default:
            return (WidgetDesign.Medium.cellW, WidgetDesign.Medium.cellH,
                    WidgetDesign.Medium.fontSize, WidgetDesign.Medium.colGap)
        }
    }

    private var destLength: Int {
        size == .systemLarge ? 9 : 8
    }

    private var priceText: String {
        "$\(flight.price)"
    }

    var body: some View {
        HStack(spacing: 0) {
            // Active row indicator bar
            if isHighlighted {
                RoundedRectangle(cornerRadius: 1)
                    .fill(WidgetDesign.gold)
                    .frame(width: 2, height: design.cellH)
                    .padding(.trailing, 4)
            } else {
                Color.clear
                    .frame(width: 2, height: design.cellH)
                    .padding(.trailing, 4)
            }

            // IATA code (3 chars)
            SplitFlapText(
                text: flight.iataCode,
                length: 3,
                color: WidgetDesign.textWhite,
                cellWidth: design.cellW,
                cellHeight: design.cellH,
                fontSize: design.fontSize
            )

            Spacer().frame(width: design.colGap)

            // Destination city (truncated)
            SplitFlapText(
                text: flight.city,
                length: destLength,
                color: WidgetDesign.textWhite,
                cellWidth: design.cellW,
                cellHeight: design.cellH,
                fontSize: design.fontSize
            )

            Spacer().frame(width: design.colGap)

            // Price (right-aligned, 5 chars)
            SplitFlapText(
                text: priceText,
                length: 5,
                color: priceColor,
                cellWidth: design.cellW,
                cellHeight: design.cellH,
                fontSize: design.fontSize,
                alignment: .trailing
            )
        }
    }

    private var priceColor: Color {
        switch flight.dealTier {
        case "amazing": return WidgetDesign.green
        case "great":   return WidgetDesign.gold
        default:        return WidgetDesign.textWhite
        }
    }
}

// MARK: - Placeholder Row (Shimmer-like)

struct PlaceholderRow: View {
    let size: WidgetFamily

    private var design: (cellW: CGFloat, cellH: CGFloat, colGap: CGFloat) {
        switch size {
        case .systemLarge:
            return (WidgetDesign.Large.cellW, WidgetDesign.Large.cellH, WidgetDesign.Large.colGap)
        default:
            return (WidgetDesign.Medium.cellW, WidgetDesign.Medium.cellH, WidgetDesign.Medium.colGap)
        }
    }

    private var destLength: Int {
        size == .systemLarge ? 9 : 8
    }

    var body: some View {
        HStack(spacing: 0) {
            // Indicator space
            Color.clear
                .frame(width: 2, height: design.cellH)
                .padding(.trailing, 4)

            // 3 code cells
            HStack(spacing: 1) {
                ForEach(0..<3, id: \.self) { _ in
                    placeholderCell
                }
            }

            Spacer().frame(width: design.colGap)

            // Destination cells
            HStack(spacing: 1) {
                ForEach(0..<destLength, id: \.self) { _ in
                    placeholderCell
                }
            }

            Spacer().frame(width: design.colGap)

            // Price cells
            HStack(spacing: 1) {
                ForEach(0..<5, id: \.self) { _ in
                    placeholderCell
                }
            }
        }
    }

    private var placeholderCell: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(WidgetDesign.cellBg)
            .overlay(
                RoundedRectangle(cornerRadius: 2)
                    .strokeBorder(WidgetDesign.cellBorder, lineWidth: 0.5)
            )
            .frame(width: design.cellW, height: design.cellH)
    }
}

// MARK: - Board Header

/// "DEPARTURES" header with the departure code, styled like an airport board.
struct BoardHeader: View {
    let departureCode: String
    let size: WidgetFamily

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "airplane.departure")
                .font(.system(size: headerFontSize, weight: .bold))
                .foregroundStyle(WidgetDesign.gold)

            Text("DEPARTURES")
                .font(.system(size: headerFontSize, weight: .heavy, design: .monospaced))
                .foregroundStyle(WidgetDesign.textWhite)
                .tracking(1.5)

            Spacer()

            Text(departureCode)
                .font(.system(size: headerFontSize, weight: .bold, design: .monospaced))
                .foregroundStyle(WidgetDesign.textMuted)
        }
    }

    private var headerFontSize: CGFloat {
        size == .systemLarge ? 11 : 9
    }
}

// MARK: - Column Labels

/// Tiny column headers: CODE | DESTINATION | PRICE
struct ColumnLabels: View {
    let size: WidgetFamily

    private var design: (cellW: CGFloat, colGap: CGFloat) {
        switch size {
        case .systemLarge:
            return (WidgetDesign.Large.cellW, WidgetDesign.Large.colGap)
        default:
            return (WidgetDesign.Medium.cellW, WidgetDesign.Medium.colGap)
        }
    }

    private var destLength: Int {
        size == .systemLarge ? 9 : 8
    }

    var body: some View {
        HStack(spacing: 0) {
            // Indicator space
            Color.clear.frame(width: 6)

            Text("CODE")
                .frame(width: design.cellW * 3 + 2, alignment: .leading)

            Spacer().frame(width: design.colGap)

            Text("DESTINATION")
                .frame(width: design.cellW * CGFloat(destLength) + CGFloat(destLength - 1), alignment: .leading)

            Spacer().frame(width: design.colGap)

            Text("PRICE")
                .frame(width: design.cellW * 5 + 4, alignment: .trailing)
        }
        .font(.system(size: 7, weight: .semibold, design: .monospaced))
        .foregroundStyle(WidgetDesign.textMuted.opacity(0.6))
    }
}

// MARK: - Branding Footer

struct BrandingFooter: View {
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "airplane")
                .font(.system(size: 6, weight: .bold))
                .foregroundStyle(WidgetDesign.gold)
            Text("SOGOJET")
                .font(.system(size: 7, weight: .heavy, design: .monospaced))
                .foregroundStyle(WidgetDesign.textMuted.opacity(0.5))
                .tracking(2)
        }
    }
}

// MARK: - Separator Line

struct BoardSeparator: View {
    var body: some View {
        Rectangle()
            .fill(WidgetDesign.cellBorder.opacity(0.5))
            .frame(height: 0.5)
    }
}

// MARK: - Medium Board View (3 rows)

struct MediumBoardView: View {
    let entry: FlightEntry

    var body: some View {
        VStack(spacing: 0) {
            BoardHeader(departureCode: entry.departureCode, size: .systemMedium)
                .padding(.bottom, 4)

            BoardSeparator()
                .padding(.bottom, 3)

            ColumnLabels(size: .systemMedium)
                .padding(.bottom, 3)

            VStack(spacing: 4) {
                let flights = Array(entry.flights.prefix(3))
                ForEach(Array(flights.enumerated()), id: \.element.id) { index, flight in
                    if entry.isPlaceholder {
                        PlaceholderRow(size: .systemMedium)
                            .redacted(reason: .placeholder)
                    } else {
                        Link(destination: deepLink(for: flight)) {
                            FlightRow(
                                flight: flight,
                                isHighlighted: index == 0,
                                size: .systemMedium
                            )
                        }
                    }
                }

                // Fill empty rows if fewer than 3 flights
                if !entry.isPlaceholder {
                    ForEach(0..<max(0, 3 - entry.flights.count), id: \.self) { _ in
                        PlaceholderRow(size: .systemMedium)
                    }
                }
            }

            Spacer(minLength: 0)

            HStack {
                Spacer()
                BrandingFooter()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WidgetDesign.background)
    }
}

// MARK: - Large Board View (5 rows)

struct LargeBoardView: View {
    let entry: FlightEntry

    var body: some View {
        VStack(spacing: 0) {
            BoardHeader(departureCode: entry.departureCode, size: .systemLarge)
                .padding(.bottom, 6)

            BoardSeparator()
                .padding(.bottom, 4)

            ColumnLabels(size: .systemLarge)
                .padding(.bottom, 4)

            VStack(spacing: 5) {
                let flights = Array(entry.flights.prefix(5))
                ForEach(Array(flights.enumerated()), id: \.element.id) { index, flight in
                    if entry.isPlaceholder {
                        PlaceholderRow(size: .systemLarge)
                            .redacted(reason: .placeholder)
                    } else {
                        Link(destination: deepLink(for: flight)) {
                            FlightRow(
                                flight: flight,
                                isHighlighted: index == 0,
                                size: .systemLarge
                            )
                        }
                    }

                    if index < min(flights.count, 5) - 1 {
                        BoardSeparator()
                            .padding(.leading, 6)
                    }
                }

                // Fill empty rows if fewer than 5 flights
                if !entry.isPlaceholder {
                    ForEach(0..<max(0, 5 - entry.flights.count), id: \.self) { i in
                        if entry.flights.count + i > 0 || i > 0 {
                            BoardSeparator()
                                .padding(.leading, 6)
                        }
                        PlaceholderRow(size: .systemLarge)
                    }
                }
            }

            Spacer(minLength: 0)

            BoardSeparator()
                .padding(.bottom, 6)

            HStack {
                // "Updated" timestamp
                Text(entry.date, style: .time)
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .foregroundStyle(WidgetDesign.textMuted.opacity(0.4))

                Spacer()

                BrandingFooter()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WidgetDesign.background)
    }
}

// MARK: - Deep Link Helper

private func deepLink(for flight: WidgetFlight) -> URL {
    URL(string: "https://sogojet.com/destination/\(flight.id)") ?? URL(string: "https://sogojet.com")!
}

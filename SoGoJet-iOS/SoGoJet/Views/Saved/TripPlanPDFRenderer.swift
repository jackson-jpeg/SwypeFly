import UIKit

// MARK: - Trip Plan PDF Renderer
// Generates a clean, printable PDF itinerary from saved deals.
// Uses UIGraphicsPDFRenderer for efficient PDF generation.

struct TripPlanPDFRenderer {

    // MARK: - Layout Constants

    private static let pageWidth: CGFloat = 612   // US Letter
    private static let pageHeight: CGFloat = 792
    private static let margin: CGFloat = 50
    private static let contentWidth: CGFloat = pageWidth - 2 * 50

    // MARK: - Colors

    private static let headerColor = UIColor(red: 0.96, green: 0.75, blue: 0.04, alpha: 1.0) // SoGoJet amber
    private static let textColor = UIColor(red: 0.15, green: 0.15, blue: 0.15, alpha: 1.0)
    private static let mutedColor = UIColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 1.0)
    private static let dividerColor = UIColor(red: 0.88, green: 0.88, blue: 0.88, alpha: 1.0)
    private static let accentBg = UIColor(red: 0.97, green: 0.95, blue: 0.90, alpha: 1.0) // warm cream

    // MARK: - Fonts

    private static func fontBold(_ size: CGFloat) -> UIFont {
        UIFont.systemFont(ofSize: size, weight: .bold)
    }

    private static func fontMedium(_ size: CGFloat) -> UIFont {
        UIFont.systemFont(ofSize: size, weight: .medium)
    }

    private static func fontRegular(_ size: CGFloat) -> UIFont {
        UIFont.systemFont(ofSize: size, weight: .regular)
    }

    private static func fontMono(_ size: CGFloat) -> UIFont {
        UIFont.monospacedSystemFont(ofSize: size, weight: .semibold)
    }

    // MARK: - Public API

    /// Generate a PDF Data object from the given saved deals.
    static func render(deals: [Deal]) -> Data {
        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        return renderer.pdfData { context in
            var currentY: CGFloat = 0

            // --- Page 1: Title Page ---
            context.beginPage()
            currentY = drawTitlePage(in: context.cgContext, deals: deals)

            // --- Destination Cards ---
            for (index, deal) in deals.enumerated() {
                let cardHeight = estimateCardHeight(deal)

                // Check if we need a new page (leave room for footer)
                if currentY + cardHeight + 60 > pageHeight - margin {
                    drawFooter(in: context.cgContext, pageRect: pageRect)
                    context.beginPage()
                    currentY = margin
                }

                currentY = drawDealCard(
                    in: context.cgContext,
                    deal: deal,
                    index: index + 1,
                    y: currentY
                )
                currentY += 16 // spacing between cards
            }

            // --- Final Footer ---
            drawFooter(in: context.cgContext, pageRect: pageRect)
        }
    }

    // MARK: - Title Page

    private static func drawTitlePage(in ctx: CGContext, deals: [Deal]) -> CGFloat {
        var y = margin + 40

        // Brand line
        let brandAttrs: [NSAttributedString.Key: Any] = [
            .font: fontMono(11),
            .foregroundColor: headerColor,
            .kern: 3.0
        ]
        let brand = "SOGOJET" as NSString
        brand.draw(at: CGPoint(x: margin, y: y), withAttributes: brandAttrs)
        y += 24

        // Title
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: fontBold(32),
            .foregroundColor: textColor
        ]
        let title = "Trip Plan" as NSString
        title.draw(at: CGPoint(x: margin, y: y), withAttributes: titleAttrs)
        y += 44

        // Divider line
        ctx.setStrokeColor(headerColor.cgColor)
        ctx.setLineWidth(2)
        ctx.move(to: CGPoint(x: margin, y: y))
        ctx.addLine(to: CGPoint(x: margin + 80, y: y))
        ctx.strokePath()
        y += 20

        // Date generated
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .long
        dateFormatter.timeStyle = .none
        let dateStr = "Generated \(dateFormatter.string(from: Date()))"
        let dateAttrs: [NSAttributedString.Key: Any] = [
            .font: fontRegular(11),
            .foregroundColor: mutedColor
        ]
        (dateStr as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: dateAttrs)
        y += 20

        // Summary line
        let count = deals.count
        let totalValue = deals.compactMap(\.displayPrice).reduce(0, +)
        var summaryText = "\(count) saved \(count == 1 ? "destination" : "destinations")"
        if totalValue > 0 {
            summaryText += "  |  $\(Int(totalValue)) estimated total"
        }
        let summaryAttrs: [NSAttributedString.Key: Any] = [
            .font: fontMedium(12),
            .foregroundColor: textColor
        ]
        (summaryText as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: summaryAttrs)
        y += 40

        // Thin separator
        ctx.setStrokeColor(dividerColor.cgColor)
        ctx.setLineWidth(0.5)
        ctx.move(to: CGPoint(x: margin, y: y))
        ctx.addLine(to: CGPoint(x: pageWidth - margin, y: y))
        ctx.strokePath()
        y += 24

        return y
    }

    // MARK: - Deal Card

    private static func drawDealCard(in ctx: CGContext, deal: Deal, index: Int, y: CGFloat) -> CGFloat {
        var currentY = y

        // Card background (subtle cream rectangle)
        let cardHeight = estimateCardHeight(deal)
        let cardRect = CGRect(x: margin - 8, y: currentY - 8, width: contentWidth + 16, height: cardHeight + 8)
        ctx.setFillColor(accentBg.cgColor)
        let path = UIBezierPath(roundedRect: cardRect, cornerRadius: 6)
        ctx.addPath(path.cgPath)
        ctx.fillPath()

        // Index number
        let indexAttrs: [NSAttributedString.Key: Any] = [
            .font: fontBold(11),
            .foregroundColor: headerColor
        ]
        ("\(index)." as NSString).draw(at: CGPoint(x: margin, y: currentY), withAttributes: indexAttrs)

        // City, Country
        let cityAttrs: [NSAttributedString.Key: Any] = [
            .font: fontBold(18),
            .foregroundColor: textColor
        ]
        let cityText = "\(deal.city), \(deal.country)"
        (cityText as NSString).draw(at: CGPoint(x: margin + 24, y: currentY - 2), withAttributes: cityAttrs)

        // Price (right-aligned)
        let priceText: String
        if let price = deal.displayPrice, price > 0 {
            priceText = "$\(Int(price))"
        } else {
            priceText = "Check price"
        }
        let priceAttrs: [NSAttributedString.Key: Any] = [
            .font: fontMono(14),
            .foregroundColor: textColor
        ]
        let priceSize = (priceText as NSString).size(withAttributes: priceAttrs)
        (priceText as NSString).draw(
            at: CGPoint(x: pageWidth - margin - priceSize.width, y: currentY),
            withAttributes: priceAttrs
        )
        currentY += 28

        // Detail rows
        let detailAttrs: [NSAttributedString.Key: Any] = [
            .font: fontRegular(10),
            .foregroundColor: mutedColor
        ]
        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: fontMedium(10),
            .foregroundColor: textColor
        ]

        // Flight info row
        var flightParts: [String] = []
        if deal.airlineName != "--" && deal.airlineName != "\u{2014}" {
            flightParts.append(deal.airlineName)
        }
        if let duration = deal.flightDuration, !duration.isEmpty {
            flightParts.append(duration)
        }
        let stopsText = deal.stopsLabel
        if !stopsText.isEmpty {
            flightParts.append(stopsText)
        }
        if !flightParts.isEmpty {
            let flightRow = flightParts.joined(separator: "  |  ")
            ("Flight:  " as NSString).draw(at: CGPoint(x: margin + 24, y: currentY), withAttributes: labelAttrs)
            (flightRow as NSString).draw(at: CGPoint(x: margin + 70, y: currentY), withAttributes: detailAttrs)
            currentY += 18
        }

        // Dates row
        if let dep = deal.bestDepartureDate {
            let dateRow: String
            if let ret = deal.bestReturnDate {
                dateRow = "\(dep)  to  \(ret)"
            } else {
                dateRow = dep
            }
            ("Dates:  " as NSString).draw(at: CGPoint(x: margin + 24, y: currentY), withAttributes: labelAttrs)
            (dateRow as NSString).draw(at: CGPoint(x: margin + 70, y: currentY), withAttributes: detailAttrs)
            currentY += 18
        }

        // Trip countdown
        if let countdown = deal.countdownLabel {
            ("Status:  " as NSString).draw(at: CGPoint(x: margin + 24, y: currentY), withAttributes: labelAttrs)
            let countdownAttrs: [NSAttributedString.Key: Any] = [
                .font: fontMedium(10),
                .foregroundColor: (deal.daysUntilDeparture ?? 99) <= 3
                    ? UIColor(red: 0.9, green: 0.25, blue: 0.2, alpha: 1.0)
                    : UIColor(red: 0.7, green: 0.55, blue: 0.1, alpha: 1.0)
            ]
            (countdown as NSString).draw(at: CGPoint(x: margin + 70, y: currentY), withAttributes: countdownAttrs)
            currentY += 18
        }

        // Best months
        if let months = deal.bestMonths, !months.isEmpty {
            let monthsText = months.joined(separator: ", ")
            ("Best months:  " as NSString).draw(at: CGPoint(x: margin + 24, y: currentY), withAttributes: labelAttrs)
            (monthsText as NSString).draw(at: CGPoint(x: margin + 100, y: currentY), withAttributes: detailAttrs)
            currentY += 18
        }

        // Vibes
        if let vibes = deal.vibeTags, !vibes.isEmpty {
            let vibeText = vibes.joined(separator: ", ")
            ("Vibes:  " as NSString).draw(at: CGPoint(x: margin + 24, y: currentY), withAttributes: labelAttrs)
            (vibeText as NSString).draw(at: CGPoint(x: margin + 70, y: currentY), withAttributes: detailAttrs)
            currentY += 18
        }

        // Savings
        if let savings = deal.savingsLabel {
            let savingsAttrs: [NSAttributedString.Key: Any] = [
                .font: fontMedium(10),
                .foregroundColor: UIColor(red: 0.15, green: 0.65, blue: 0.35, alpha: 1.0)
            ]
            (savings as NSString).draw(at: CGPoint(x: margin + 24, y: currentY), withAttributes: savingsAttrs)
            currentY += 18
        }

        currentY += 8 // bottom padding inside card
        return currentY
    }

    // MARK: - Card Height Estimation

    private static func estimateCardHeight(_ deal: Deal) -> CGFloat {
        var height: CGFloat = 36 // header (city + price)

        // Flight info
        let hasAirline = deal.airlineName != "--" && deal.airlineName != "\u{2014}"
        let hasDuration = deal.flightDuration?.isEmpty == false
        let hasStops = !deal.stopsLabel.isEmpty
        if hasAirline || hasDuration || hasStops {
            height += 18
        }

        // Dates
        if deal.bestDepartureDate != nil { height += 18 }

        // Countdown
        if deal.countdownLabel != nil { height += 18 }

        // Best months
        if let months = deal.bestMonths, !months.isEmpty { height += 18 }

        // Vibes
        if let vibes = deal.vibeTags, !vibes.isEmpty, !vibes.isEmpty { height += 18 }

        // Savings
        if deal.savingsLabel != nil { height += 18 }

        height += 8 // bottom padding
        return height
    }

    // MARK: - Footer

    private static func drawFooter(in ctx: CGContext, pageRect: CGRect) {
        let footerY = pageRect.height - margin + 10

        // Thin line
        ctx.setStrokeColor(dividerColor.cgColor)
        ctx.setLineWidth(0.5)
        ctx.move(to: CGPoint(x: margin, y: footerY))
        ctx.addLine(to: CGPoint(x: pageRect.width - margin, y: footerY))
        ctx.strokePath()

        let footerAttrs: [NSAttributedString.Key: Any] = [
            .font: fontRegular(8),
            .foregroundColor: mutedColor
        ]
        let footerText = "Generated by SoGoJet  --  sogojet.com"
        (footerText as NSString).draw(at: CGPoint(x: margin, y: footerY + 6), withAttributes: footerAttrs)

        // Page info right-aligned
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .short
        dateFormatter.timeStyle = .none
        let dateText = dateFormatter.string(from: Date())
        let dateSize = (dateText as NSString).size(withAttributes: footerAttrs)
        (dateText as NSString).draw(
            at: CGPoint(x: pageRect.width - margin - dateSize.width, y: footerY + 6),
            withAttributes: footerAttrs
        )
    }
}

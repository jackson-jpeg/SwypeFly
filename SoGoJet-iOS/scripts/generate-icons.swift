#!/usr/bin/env swift
// Generates 5 SoGoJet app icon concepts
// Usage: swift scripts/generate-icons.swift

import Foundation
import AppKit
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let cgSize = CGSize(width: size, height: size)

// Palette
func c(_ r: Int, _ g: Int, _ b: Int, _ a: Double = 1.0) -> CGColor {
    CGColor(srgbRed: CGFloat(r)/255.0, green: CGFloat(g)/255.0, blue: CGFloat(b)/255.0, alpha: a)
}

let bg = c(0x0A, 0x0A, 0x0A)
let bgDeep = c(0x05, 0x05, 0x05)
let gold = c(0xF7, 0xE8, 0xA0)
let goldDim = c(0xC4, 0xB8, 0x78)
let goldGlow = c(0xF7, 0xE8, 0xA0, 0.2)
let goldGlowStrong = c(0xF7, 0xE8, 0xA0, 0.4)
let cell = c(0x18, 0x18, 0x18)
let cellLight = c(0x22, 0x22, 0x22)
let border = c(0x30, 0x30, 0x30)
let gap = c(0x06, 0x06, 0x06)
let white = c(0xF5, 0xF5, 0xF5)
let muted = c(0x66, 0x66, 0x66)

let colorSpace = CGColorSpaceCreateDeviceRGB()

func makeContext() -> CGContext {
    CGContext(
        data: nil, width: size, height: size,
        bitsPerComponent: 8, bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
}

func drawRoundedRect(_ ctx: CGContext, _ rect: CGRect, radius: CGFloat, fill: CGColor, stroke: CGColor? = nil, lineWidth: CGFloat = 2) {
    let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.addPath(path)
    ctx.setFillColor(fill)
    ctx.fillPath()
    if let stroke {
        ctx.addPath(path)
        ctx.setStrokeColor(stroke)
        ctx.setLineWidth(lineWidth)
        ctx.strokePath()
    }
}

func drawText(_ ctx: CGContext, _ text: String, x: CGFloat, y: CGFloat, fontSize: CGFloat, color: CGColor, bold: Bool = true) {
    let fontName = bold ? "Helvetica-Bold" : "Helvetica"
    let font = CTFontCreateWithName(fontName as CFString, fontSize, nil)
    let attrs: [CFString: Any] = [kCTFontAttributeName: font, kCTForegroundColorAttributeName: color]
    let attrStr = CFAttributedStringCreate(nil, text as CFString, attrs as CFDictionary)!
    let line = CTLineCreateWithAttributedString(attrStr)
    ctx.textPosition = CGPoint(x: x, y: y)
    CTLineDraw(line, ctx)
}

func drawCenteredText(_ ctx: CGContext, _ text: String, in rect: CGRect, fontSize: CGFloat, color: CGColor, bold: Bool = true) {
    let fontName = bold ? "Helvetica-Bold" : "Helvetica"
    let font = CTFontCreateWithName(fontName as CFString, fontSize, nil)
    let attrs: [CFString: Any] = [kCTFontAttributeName: font, kCTForegroundColorAttributeName: color]
    let attrStr = CFAttributedStringCreate(nil, text as CFString, attrs as CFDictionary)!
    let line = CTLineCreateWithAttributedString(attrStr)
    let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
    let x = rect.midX - bounds.width / 2 - bounds.origin.x
    let y = rect.midY - bounds.height / 2 - bounds.origin.y
    ctx.textPosition = CGPoint(x: x, y: y)
    CTLineDraw(line, ctx)
}

func drawFlapCell(_ ctx: CGContext, rect: CGRect, char: String, charColor: CGColor, radius: CGFloat = 12, gapWidth: CGFloat = 2, fontSize: CGFloat? = nil) {
    let fs = fontSize ?? (rect.height * 0.7)

    // Top half
    let topRect = CGRect(x: rect.minX, y: rect.midY + gapWidth/2, width: rect.width, height: rect.height/2 - gapWidth/2)
    drawRoundedRect(ctx, topRect, radius: radius, fill: cellLight, stroke: border, lineWidth: 1.5)

    // Bottom half
    let botRect = CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height/2 - gapWidth/2)
    drawRoundedRect(ctx, botRect, radius: radius, fill: cell, stroke: border, lineWidth: 1.5)

    // Gap line
    ctx.setFillColor(gap)
    ctx.fill(CGRect(x: rect.minX + 2, y: rect.midY - gapWidth/2, width: rect.width - 4, height: gapWidth))

    // Character (clip to cell bounds)
    ctx.saveGState()
    ctx.clip(to: rect)
    drawCenteredText(ctx, char, in: rect, fontSize: fs, color: charColor)
    ctx.restoreGState()
}

func savePNG(_ ctx: CGContext, path: String) {
    guard let image = ctx.makeImage() else { fatalError("Cannot create image") }
    let url = URL(fileURLWithPath: path)
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        fatalError("Cannot create destination")
    }
    CGImageDestinationAddImage(dest, image, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("Cannot write PNG") }
}

// ═══════════════════════════════════════════════════════════════
// CONCEPT 1: "GO" — Two split-flap cells side by side
// Clean, bold, immediately readable. The name says it all.
// ═══════════════════════════════════════════════════════════════

func concept1() {
    let ctx = makeContext()

    // Background gradient (dark center, darker edges)
    ctx.setFillColor(bgDeep)
    ctx.fill(CGRect(origin: .zero, size: cgSize))

    // Radial glow behind the cells
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 120, color: goldGlow)
    ctx.setFillColor(c(0x0E, 0x0E, 0x0E))
    ctx.fill(CGRect(x: 180, y: 280, width: 664, height: 464))
    ctx.restoreGState()

    // Two flap cells: G and O
    let cellW: CGFloat = 290
    let cellH: CGFloat = 380
    let gap: CGFloat = 30
    let startX = (CGFloat(size) - cellW * 2 - gap) / 2
    let startY = (CGFloat(size) - cellH) / 2 + 20

    let gRect = CGRect(x: startX, y: startY, width: cellW, height: cellH)
    let oRect = CGRect(x: startX + cellW + gap, y: startY, width: cellW, height: cellH)

    // Draw with glow
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 30, color: goldGlowStrong)
    drawFlapCell(ctx, rect: gRect, char: "G", charColor: gold, radius: 20, gapWidth: 3, fontSize: 260)
    drawFlapCell(ctx, rect: oRect, char: "O", charColor: gold, radius: 20, gapWidth: 3, fontSize: 260)
    ctx.restoreGState()

    // Redraw crisp on top
    drawFlapCell(ctx, rect: gRect, char: "G", charColor: gold, radius: 20, gapWidth: 3, fontSize: 260)
    drawFlapCell(ctx, rect: oRect, char: "O", charColor: gold, radius: 20, gapWidth: 3, fontSize: 260)

    // Subtle "SOGOJET" below
    drawCenteredText(ctx, "SOGOJET", in: CGRect(x: 0, y: 110, width: CGFloat(size), height: 60), fontSize: 36, color: muted)

    savePNG(ctx, path: "scripts/icon-concept-1-GO.png")
    print("✅ Concept 1: GO — two split-flap cells")
}

// ═══════════════════════════════════════════════════════════════
// CONCEPT 2: "Departure Board Mini" — 3 rows like a real board
// Shows SGJ, FLY, $99 in three rows of flap characters
// ═══════════════════════════════════════════════════════════════

func concept2() {
    let ctx = makeContext()
    ctx.setFillColor(bgDeep)
    ctx.fill(CGRect(origin: .zero, size: cgSize))

    // Board panel background
    let panelRect = CGRect(x: 100, y: 140, width: 824, height: 744)

    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 60, color: goldGlow)
    drawRoundedRect(ctx, panelRect, radius: 32, fill: c(0x10, 0x10, 0x10), stroke: border, lineWidth: 2)
    ctx.restoreGState()
    drawRoundedRect(ctx, panelRect, radius: 32, fill: c(0x10, 0x10, 0x10), stroke: border, lineWidth: 2)

    // Three rows of flap cells
    let cellW: CGFloat = 100
    let cellH: CGFloat = 130
    let hGap: CGFloat = 14
    let vGap: CGFloat = 30

    let rows: [(String, CGColor)] = [
        ("  FLY ", gold),
        (" DEAL ", white),
        (" $149 ", c(0x4A, 0xDE, 0x80)),  // green for price
    ]

    for (rowIdx, (text, color)) in rows.enumerated() {
        let chars = Array(text)
        let rowWidth = CGFloat(chars.count) * cellW + CGFloat(chars.count - 1) * hGap
        let rowX = (CGFloat(size) - rowWidth) / 2
        let rowY = CGFloat(size) - 230 - CGFloat(rowIdx) * (cellH + vGap)

        for (colIdx, ch) in chars.enumerated() {
            let x = rowX + CGFloat(colIdx) * (cellW + hGap)
            let rect = CGRect(x: x, y: rowY, width: cellW, height: cellH)
            let charStr = String(ch)
            if charStr == " " {
                drawFlapCell(ctx, rect: rect, char: " ", charColor: c(0x33, 0x33, 0x33), radius: 10, gapWidth: 2, fontSize: 80)
            } else {
                drawFlapCell(ctx, rect: rect, char: charStr, charColor: color, radius: 10, gapWidth: 2, fontSize: 80)
            }
        }
    }

    savePNG(ctx, path: "scripts/icon-concept-2-board.png")
    print("✅ Concept 2: Departure Board Mini — 3 rows of flap cells")
}

// ═══════════════════════════════════════════════════════════════
// CONCEPT 3: "Plane on Flap" — Single large cell with airplane
// One big split-flap cell containing a stylized airplane ✈
// ═══════════════════════════════════════════════════════════════

func concept3() {
    let ctx = makeContext()
    ctx.setFillColor(bgDeep)
    ctx.fill(CGRect(origin: .zero, size: cgSize))

    // Large centered cell
    let margin: CGFloat = 140
    let cellRect = CGRect(x: margin, y: margin + 30, width: CGFloat(size) - margin * 2, height: CGFloat(size) - margin * 2 - 30)

    // Glow
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 50, color: goldGlowStrong)
    drawFlapCell(ctx, rect: cellRect, char: "✈", charColor: gold, radius: 36, gapWidth: 4, fontSize: 420)
    ctx.restoreGState()

    // Crisp redraw
    drawFlapCell(ctx, rect: cellRect, char: "✈", charColor: gold, radius: 36, gapWidth: 4, fontSize: 420)

    // "SOGOJET" subtle below
    drawCenteredText(ctx, "SOGOJET", in: CGRect(x: 0, y: 80, width: CGFloat(size), height: 60), fontSize: 40, color: muted)

    savePNG(ctx, path: "scripts/icon-concept-3-plane.png")
    print("✅ Concept 3: Plane on Flap — airplane in split-flap cell")
}

// ═══════════════════════════════════════════════════════════════
// CONCEPT 4: "SGJ Code" — Airport-style 3-letter code
// Three flap cells spelling SGJ (like an IATA airport code)
// ═══════════════════════════════════════════════════════════════

func concept4() {
    let ctx = makeContext()
    ctx.setFillColor(bgDeep)
    ctx.fill(CGRect(origin: .zero, size: cgSize))

    // Radial glow
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 100, color: goldGlow)
    ctx.setFillColor(c(0x0E, 0x0E, 0x0E))
    ctx.fill(CGRect(x: 100, y: 250, width: 824, height: 524))
    ctx.restoreGState()

    // Three cells: S G J
    let cellW: CGFloat = 210
    let cellH: CGFloat = 310
    let hGap: CGFloat = 22
    let totalW = cellW * 3 + hGap * 2
    let startX = (CGFloat(size) - totalW) / 2
    let startY = (CGFloat(size) - cellH) / 2 + 40

    let chars = ["S", "G", "J"]
    let colors = [gold, gold, gold]

    for (i, ch) in chars.enumerated() {
        let x = startX + CGFloat(i) * (cellW + hGap)
        let rect = CGRect(x: x, y: startY, width: cellW, height: cellH)

        ctx.saveGState()
        ctx.setShadow(offset: .zero, blur: 25, color: goldGlowStrong)
        drawFlapCell(ctx, rect: rect, char: ch, charColor: colors[i], radius: 18, gapWidth: 3, fontSize: 200)
        ctx.restoreGState()

        drawFlapCell(ctx, rect: rect, char: ch, charColor: colors[i], radius: 18, gapWidth: 3, fontSize: 200)
    }

    // Yellow indicator bar on left (like the active board row)
    let barX = startX - 18
    let barY = startY + 20
    ctx.setFillColor(gold)
    let barPath = CGPath(roundedRect: CGRect(x: barX, y: barY, width: 5, height: cellH - 40), cornerWidth: 2.5, cornerHeight: 2.5, transform: nil)
    ctx.addPath(barPath)
    ctx.fillPath()

    // Small "DEPARTURES" above
    drawCenteredText(ctx, "DEPARTURES", in: CGRect(x: 0, y: startY + cellH + 40, width: CGFloat(size), height: 40), fontSize: 30, color: muted)

    // Small plane + price below
    drawCenteredText(ctx, "✈  SOGOJET", in: CGRect(x: 0, y: startY - 80, width: CGFloat(size), height: 40), fontSize: 28, color: goldDim)

    savePNG(ctx, path: "scripts/icon-concept-4-SGJ.png")
    print("✅ Concept 4: SGJ Code — airport IATA-style 3 cells")
}

// ═══════════════════════════════════════════════════════════════
// CONCEPT 5: "Golden Flap S" — Premium single letter, rich detail
// Large S with depth effects, inner shadow, metallic gold feel
// ═══════════════════════════════════════════════════════════════

func concept5() {
    let ctx = makeContext()

    // Gradient background — very dark with subtle warm center
    ctx.setFillColor(c(0x06, 0x06, 0x06))
    ctx.fill(CGRect(origin: .zero, size: cgSize))

    // Subtle radial warm glow in center
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 200, color: c(0xF7, 0xE8, 0xA0, 0.08))
    ctx.setFillColor(c(0x0A, 0x0A, 0x0A))
    ctx.fillEllipse(in: CGRect(x: 200, y: 200, width: 624, height: 624))
    ctx.restoreGState()

    // Large cell with more detail
    let margin: CGFloat = 120
    let cellRect = CGRect(x: margin, y: margin + 10, width: CGFloat(size) - margin * 2, height: CGFloat(size) - margin * 2 - 10)
    let cornerR: CGFloat = 44

    // Outer glow
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 60, color: c(0xF7, 0xE8, 0xA0, 0.15))
    drawRoundedRect(ctx, cellRect, radius: cornerR, fill: cell)
    ctx.restoreGState()

    // Top half with slight gradient feel
    let topRect = CGRect(x: cellRect.minX, y: cellRect.midY + 2, width: cellRect.width, height: cellRect.height/2 - 2)
    drawRoundedRect(ctx, topRect, radius: cornerR, fill: c(0x1E, 0x1E, 0x1E), stroke: c(0x35, 0x35, 0x35), lineWidth: 1.5)

    // Bottom half slightly darker
    let botRect = CGRect(x: cellRect.minX, y: cellRect.minY, width: cellRect.width, height: cellRect.height/2 - 2)
    drawRoundedRect(ctx, botRect, radius: cornerR, fill: c(0x16, 0x16, 0x16), stroke: c(0x30, 0x30, 0x30), lineWidth: 1.5)

    // Gap line with subtle depth
    ctx.setFillColor(c(0x03, 0x03, 0x03))
    ctx.fill(CGRect(x: cellRect.minX + 6, y: cellRect.midY - 2, width: cellRect.width - 12, height: 4))
    // Highlight above gap
    ctx.setFillColor(c(0x28, 0x28, 0x28))
    ctx.fill(CGRect(x: cellRect.minX + 6, y: cellRect.midY + 2, width: cellRect.width - 12, height: 1))

    // The "S" — draw with glow layers for richness
    let fontSize: CGFloat = 520

    // Layer 1: strong outer glow
    ctx.saveGState()
    ctx.clip(to: cellRect)
    ctx.setShadow(offset: .zero, blur: 40, color: c(0xF7, 0xE8, 0xA0, 0.35))
    drawCenteredText(ctx, "S", in: cellRect, fontSize: fontSize, color: gold)
    ctx.restoreGState()

    // Layer 2: subtle warm inner fill
    ctx.saveGState()
    ctx.clip(to: cellRect)
    ctx.setShadow(offset: CGSize(width: 0, height: -3), blur: 8, color: c(0xFF, 0xF0, 0xC0, 0.3))
    drawCenteredText(ctx, "S", in: cellRect, fontSize: fontSize, color: gold)
    ctx.restoreGState()

    // Layer 3: crisp final draw
    ctx.saveGState()
    ctx.clip(to: cellRect)
    drawCenteredText(ctx, "S", in: cellRect, fontSize: fontSize, color: gold)
    ctx.restoreGState()

    // Tiny accent dots in corners (like mounting screws on a real flap board)
    let dotR: CGFloat = 5
    let dotInset: CGFloat = 24
    let dotColor = c(0x40, 0x40, 0x40)
    for (dx, dy) in [(cellRect.minX + dotInset, cellRect.minY + dotInset),
                      (cellRect.maxX - dotInset, cellRect.minY + dotInset),
                      (cellRect.minX + dotInset, cellRect.maxY - dotInset),
                      (cellRect.maxX - dotInset, cellRect.maxY - dotInset)] {
        ctx.setFillColor(dotColor)
        ctx.fillEllipse(in: CGRect(x: dx - dotR, y: dy - dotR, width: dotR * 2, height: dotR * 2))
    }

    savePNG(ctx, path: "scripts/icon-concept-5-premium-S.png")
    print("✅ Concept 5: Golden Flap S — premium single letter with depth")
}

// Generate all 5
concept1()
concept2()
concept3()
concept4()
concept5()
print("\n🎨 All 5 concepts generated in scripts/")

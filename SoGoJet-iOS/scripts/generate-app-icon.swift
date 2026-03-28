#!/usr/bin/env swift
// Generates the SoGoJet app icon — black split-flap "GO" on white background
// Usage: swift scripts/generate-app-icon.swift

import Foundation
import AppKit
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let cgSize = CGSize(width: size, height: size)

func c(_ r: Int, _ g: Int, _ b: Int, _ a: Double = 1.0) -> CGColor {
    CGColor(srgbRed: CGFloat(r)/255.0, green: CGFloat(g)/255.0, blue: CGFloat(b)/255.0, alpha: a)
}

// White background, dark flipboard cells
let whiteBg = c(0xFF, 0xFF, 0xFF)
let cellDark = c(0x12, 0x12, 0x12)
let cellBorder = c(0x2A, 0x2A, 0x2A)
let gapDark = c(0x08, 0x08, 0x08)
let gold = c(0xF7, 0xE8, 0xA0)
let goldGlow = c(0xF7, 0xE8, 0xA0, 0.35)

let colorSpace = CGColorSpaceCreateDeviceRGB()

guard let ctx = CGContext(
    data: nil, width: size, height: size,
    bitsPerComponent: 8, bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { fatalError("Cannot create context") }

// Fill white background
ctx.setFillColor(whiteBg)
ctx.fill(CGRect(origin: .zero, size: cgSize))

// Draw two split-flap cells side by side for "G" and "O"
let cellW: CGFloat = 340
let cellH: CGFloat = 440
let gap: CGFloat = 24
let totalW = cellW * 2 + gap
let originX = (CGFloat(size) - totalW) / 2
let originY = (CGFloat(size) - cellH) / 2

for i in 0..<2 {
    let x = originX + CGFloat(i) * (cellW + gap)

    // Shadow
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -8), blur: 24, color: c(0, 0, 0, 0.3))

    // Cell background
    let cellRect = CGRect(x: x, y: originY, width: cellW, height: cellH)
    let cellPath = CGPath(roundedRect: cellRect, cornerWidth: 28, cornerHeight: 28, transform: nil)
    ctx.setFillColor(cellDark)
    ctx.addPath(cellPath)
    ctx.fillPath()
    ctx.restoreGState()

    // Cell border
    ctx.setStrokeColor(cellBorder)
    ctx.setLineWidth(2)
    ctx.addPath(cellPath)
    ctx.strokePath()

    // Split-flap gap line (horizontal center)
    let gapY = originY + cellH / 2
    ctx.setFillColor(gapDark)
    ctx.fill(CGRect(x: x, y: gapY - 2, width: cellW, height: 4))

    // Gold glow behind letter
    ctx.saveGState()
    ctx.addPath(cellPath)
    ctx.clip()
    let glowRect = CGRect(x: x + cellW/4, y: originY + cellH/4, width: cellW/2, height: cellH/2)
    ctx.setFillColor(goldGlow)
    ctx.fillEllipse(in: glowRect.insetBy(dx: -60, dy: -60))
    ctx.restoreGState()
}

// Draw "G" and "O" in gold Bebas Neue
let letters = ["G", "O"]
let fontSize: CGFloat = 360

// Try Bebas Neue first, fall back to system heavy
let fontName = "BebasNeue-Regular" as CFString
let font = CTFontCreateWithName(fontName, fontSize, nil)
let fallbackFont = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, fontSize, nil)
let useFont = CTFontCopyFamilyName(font) as String == "Bebas Neue" ? font : fallbackFont

for (i, letter) in letters.enumerated() {
    let x = originX + CGFloat(i) * (cellW + gap)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: useFont,
        .foregroundColor: NSColor(cgColor: gold)!,
    ]
    let attrStr = NSAttributedString(string: letter, attributes: attrs)
    let line = CTLineCreateWithAttributedString(attrStr)
    let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)

    // Center letter in cell
    let textX = x + (cellW - bounds.width) / 2 - bounds.origin.x
    let textY = originY + (cellH - bounds.height) / 2 - bounds.origin.y

    ctx.textPosition = CGPoint(x: textX, y: textY)
    CTLineDraw(line, ctx)
}

// Save
guard let image = ctx.makeImage() else { fatalError("Cannot create image") }
let outputURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("SoGoJet/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
guard let dest = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("Cannot create destination")
}
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else { fatalError("Cannot write PNG") }
print("✓ Generated app icon: \(outputURL.path)")

#!/usr/bin/env swift
// Generates the SoGoJet app icon — black split-flap "GO" on white background
// BLACK AND WHITE ONLY — no gold, no color
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

let white = c(0xFF, 0xFF, 0xFF)
let black = c(0x0A, 0x0A, 0x0A)
let darkGray = c(0x1A, 0x1A, 0x1A)
let midGray = c(0x30, 0x30, 0x30)
let gapBlack = c(0x06, 0x06, 0x06)
let letterWhite = c(0xF5, 0xF5, 0xF5)

let colorSpace = CGColorSpaceCreateDeviceRGB()

guard let ctx = CGContext(
    data: nil, width: size, height: size,
    bitsPerComponent: 8, bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { fatalError("Cannot create context") }

// White background
ctx.setFillColor(white)
ctx.fill(CGRect(origin: .zero, size: cgSize))

// Two split-flap cells for "G" and "O"
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
    ctx.setShadow(offset: CGSize(width: 0, height: -6), blur: 20, color: c(0, 0, 0, 0.25))

    // Cell background — black
    let cellRect = CGRect(x: x, y: originY, width: cellW, height: cellH)
    let cellPath = CGPath(roundedRect: cellRect, cornerWidth: 28, cornerHeight: 28, transform: nil)
    ctx.setFillColor(black)
    ctx.addPath(cellPath)
    ctx.fillPath()
    ctx.restoreGState()

    // Cell border — dark gray
    ctx.setStrokeColor(midGray)
    ctx.setLineWidth(2)
    ctx.addPath(cellPath)
    ctx.strokePath()

    // Split-flap gap line
    let gapY = originY + cellH / 2
    ctx.setFillColor(gapBlack)
    ctx.fill(CGRect(x: x, y: gapY - 2, width: cellW, height: 4))
}

// Draw "G" and "O" in WHITE on the black cells
let letters = ["G", "O"]
let fontSize: CGFloat = 360

let fontName = "BebasNeue-Regular" as CFString
let font = CTFontCreateWithName(fontName, fontSize, nil)
let fallbackFont = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, fontSize, nil)
let useFont = CTFontCopyFamilyName(font) as String == "Bebas Neue" ? font : fallbackFont

for (i, letter) in letters.enumerated() {
    let x = originX + CGFloat(i) * (cellW + gap)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: useFont,
        .foregroundColor: NSColor(cgColor: letterWhite)!,
    ]
    let attrStr = NSAttributedString(string: letter, attributes: attrs)
    let line = CTLineCreateWithAttributedString(attrStr)
    let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)

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
print("Generated: \(outputURL.path)")

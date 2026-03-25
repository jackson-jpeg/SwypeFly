#!/usr/bin/env swift
// Generates the SoGoJet app icon — a split-flap "S" on dark background
// Usage: swift scripts/generate-icon.swift

import Foundation
import AppKit
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let cgSize = CGSize(width: size, height: size)

// Colors (matching the app's neutral palette + gold accent)
let bgColor = CGColor(srgbRed: 0x0A/255.0, green: 0x0A/255.0, blue: 0x0A/255.0, alpha: 1.0)
let goldColor = CGColor(srgbRed: 0xF7/255.0, green: 0xE8/255.0, blue: 0xA0/255.0, alpha: 1.0)
let cellColor = CGColor(srgbRed: 0x1A/255.0, green: 0x1A/255.0, blue: 0x1A/255.0, alpha: 1.0)
let cellBorder = CGColor(srgbRed: 0x2A/255.0, green: 0x2A/255.0, blue: 0x2A/255.0, alpha: 1.0)
let gapColor = CGColor(srgbRed: 0x08/255.0, green: 0x08/255.0, blue: 0x08/255.0, alpha: 1.0)
let glowColor = CGColor(srgbRed: 0xF7/255.0, green: 0xE8/255.0, blue: 0xA0/255.0, alpha: 0.25)

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(
    data: nil,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fatalError("Cannot create context")
}

// Fill background
ctx.setFillColor(bgColor)
ctx.fill(CGRect(origin: .zero, size: cgSize))

// Draw the split-flap cell (centered, with rounded corners)
let cellPadding: CGFloat = 150
let cellRect = CGRect(
    x: cellPadding,
    y: cellPadding,
    width: CGFloat(size) - cellPadding * 2,
    height: CGFloat(size) - cellPadding * 2
)
let cornerRadius: CGFloat = 48

// Cell background with subtle glow
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 40, color: glowColor)
let cellPath = CGPath(roundedRect: cellRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
ctx.addPath(cellPath)
ctx.setFillColor(cellColor)
ctx.fillPath()
ctx.restoreGState()

// Cell border
ctx.addPath(cellPath)
ctx.setStrokeColor(cellBorder)
ctx.setLineWidth(3)
ctx.strokePath()

// Draw the horizontal gap (split-flap split line)
let gapHeight: CGFloat = 3
let gapY = CGFloat(size) / 2 - gapHeight / 2
ctx.setFillColor(gapColor)
ctx.fill(CGRect(x: cellPadding + 4, y: gapY, width: cellRect.width - 8, height: gapHeight))

// Draw the "S" character in gold using CoreText
let fontSize: CGFloat = 500
let font = CTFontCreateWithName("Helvetica-Bold" as CFString, fontSize, nil)

let attributes: [CFString: Any] = [
    kCTFontAttributeName: font,
    kCTForegroundColorAttributeName: goldColor
]
let attrString = CFAttributedStringCreate(nil, "S" as CFString, attributes as CFDictionary)!
let line = CTLineCreateWithAttributedString(attrString)
let textBounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)

// Center the text in the cell
let textX = cellRect.midX - textBounds.width / 2 - textBounds.origin.x
let textY = cellRect.midY - textBounds.height / 2 - textBounds.origin.y

// Draw with glow
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 25, color: glowColor)
ctx.textPosition = CGPoint(x: textX, y: textY)
CTLineDraw(line, ctx)
ctx.restoreGState()

// Draw again crisp on top
ctx.textPosition = CGPoint(x: textX, y: textY)
CTLineDraw(line, ctx)

// Export as PNG
guard let image = ctx.makeImage() else {
    fatalError("Cannot create image")
}

let outputPath = "SoGoJet/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
let url = URL(fileURLWithPath: outputPath)
guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("Cannot create destination")
}
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else {
    fatalError("Cannot write PNG")
}

print("✅ App icon generated at \(outputPath) (1024x1024)")

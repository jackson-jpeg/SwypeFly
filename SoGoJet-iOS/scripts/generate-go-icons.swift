#!/usr/bin/env swift
// Generates 7 "GO" app icon variants for SoGoJet
// Usage: swift scripts/generate-go-icons.swift

import Foundation
import AppKit
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let cgSize = CGSize(width: size, height: size)

func c(_ r: Int, _ g: Int, _ b: Int, _ a: Double = 1.0) -> CGColor {
    CGColor(srgbRed: CGFloat(r)/255, green: CGFloat(g)/255, blue: CGFloat(b)/255, alpha: a)
}

let bg = c(0x05, 0x05, 0x05)
let gold = c(0xF7, 0xE8, 0xA0)
let goldDim = c(0xC4, 0xB8, 0x78)
let goldGlow = c(0xF7, 0xE8, 0xA0, 0.25)
let goldGlowStrong = c(0xF7, 0xE8, 0xA0, 0.4)
let cellTop = c(0x1E, 0x1E, 0x1E)
let cellBot = c(0x14, 0x14, 0x14)
let borderCol = c(0x30, 0x30, 0x30)
let gapCol = c(0x03, 0x03, 0x03)
let highlight = c(0x28, 0x28, 0x28)
let white = c(0xF0, 0xF0, 0xF0)
let green = c(0x4A, 0xDE, 0x80)
let muted = c(0x55, 0x55, 0x55)
let screwCol = c(0x38, 0x38, 0x38)

let cs = CGColorSpaceCreateDeviceRGB()
func makeCtx() -> CGContext {
    CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
              space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}

func roundRect(_ ctx: CGContext, _ r: CGRect, rad: CGFloat, fill: CGColor, stroke: CGColor? = nil, lw: CGFloat = 1.5) {
    let p = CGPath(roundedRect: r, cornerWidth: rad, cornerHeight: rad, transform: nil)
    ctx.addPath(p); ctx.setFillColor(fill); ctx.fillPath()
    if let s = stroke { ctx.addPath(p); ctx.setStrokeColor(s); ctx.setLineWidth(lw); ctx.strokePath() }
}

func centeredText(_ ctx: CGContext, _ txt: String, in r: CGRect, fs: CGFloat, col: CGColor, bold: Bool = true) {
    let f = CTFontCreateWithName((bold ? "Helvetica-Bold" : "Helvetica") as CFString, fs, nil)
    let a: [CFString: Any] = [kCTFontAttributeName: f, kCTForegroundColorAttributeName: col]
    let s = CFAttributedStringCreate(nil, txt as CFString, a as CFDictionary)!
    let l = CTLineCreateWithAttributedString(s)
    let b = CTLineGetBoundsWithOptions(l, .useGlyphPathBounds)
    ctx.textPosition = CGPoint(x: r.midX - b.width/2 - b.origin.x, y: r.midY - b.height/2 - b.origin.y)
    CTLineDraw(l, ctx)
}

func flapCell(_ ctx: CGContext, r: CGRect, ch: String, col: CGColor, rad: CGFloat = 18, gapW: CGFloat = 3, fs: CGFloat? = nil, midFlip: Bool = false, flipChar: String? = nil) {
    let f = fs ?? (r.height * 0.65)

    // Top half
    let top = CGRect(x: r.minX, y: r.midY + gapW/2, width: r.width, height: r.height/2 - gapW/2)
    roundRect(ctx, top, rad: rad, fill: cellTop, stroke: borderCol)

    // Bottom half
    let bot = CGRect(x: r.minX, y: r.minY, width: r.width, height: r.height/2 - gapW/2)
    roundRect(ctx, bot, rad: rad, fill: cellBot, stroke: borderCol)

    // Gap
    ctx.setFillColor(gapCol)
    ctx.fill(CGRect(x: r.minX + 4, y: r.midY - gapW/2, width: r.width - 8, height: gapW))
    // Highlight edge
    ctx.setFillColor(highlight)
    ctx.fill(CGRect(x: r.minX + 4, y: r.midY + gapW/2, width: r.width - 8, height: 1))

    if midFlip {
        // Bottom shows the new char
        ctx.saveGState()
        ctx.clip(to: bot)
        centeredText(ctx, ch, in: r, fs: f, col: col)
        ctx.restoreGState()

        // Top shows the old/blank char (rotated look via slight offset)
        if let fc = flipChar {
            ctx.saveGState()
            ctx.clip(to: top)
            let offsetR = CGRect(x: r.minX, y: r.midY + 8, width: r.width, height: r.height/2)
            centeredText(ctx, fc, in: offsetR, fs: f * 0.85, col: c(0x40, 0x40, 0x40))
            ctx.restoreGState()
        }

        // Mid-flip flap piece (the folding part)
        let flapH = r.height * 0.12
        let flapR = CGRect(x: r.minX + 3, y: r.midY - flapH/2, width: r.width - 6, height: flapH)
        roundRect(ctx, flapR, rad: 4, fill: c(0x1A, 0x1A, 0x1A), stroke: c(0x25, 0x25, 0x25), lw: 1)
        // Partial char on the flap
        ctx.saveGState()
        ctx.clip(to: flapR)
        centeredText(ctx, ch, in: CGRect(x: r.minX, y: r.midY - r.height * 0.15, width: r.width, height: r.height * 0.3), fs: f * 0.4, col: col)
        ctx.restoreGState()
    } else {
        // Normal: full char
        ctx.saveGState()
        ctx.clip(to: r)
        centeredText(ctx, ch, in: r, fs: f, col: col)
        ctx.restoreGState()
    }
}

func screw(_ ctx: CGContext, x: CGFloat, y: CGFloat, r: CGFloat = 4.5) {
    ctx.setFillColor(screwCol)
    ctx.fillEllipse(in: CGRect(x: x - r, y: y - r, width: r*2, height: r*2))
    ctx.setFillColor(c(0x2A, 0x2A, 0x2A))
    ctx.fillEllipse(in: CGRect(x: x - r*0.5, y: y - r*0.5, width: r, height: r))
}

func save(_ ctx: CGContext, _ name: String) {
    guard let img = ctx.makeImage() else { return }
    let url = URL(fileURLWithPath: "scripts/\(name).png")
    guard let d = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(d, img, nil)
    CGImageDestinationFinalize(d)
    print("  \(name).png")
}

print("Generating GO icon variants...")

// ═══════════════════════════════════════════
// 1A: GO with premium depth
// ═══════════════════════════════════════════
do {
    let ctx = makeCtx()
    ctx.setFillColor(bg); ctx.fill(CGRect(origin: .zero, size: cgSize))

    let cw: CGFloat = 300, ch: CGFloat = 400, gap: CGFloat = 28
    let sx = (CGFloat(size) - cw*2 - gap) / 2, sy = (CGFloat(size) - ch) / 2 + 15
    let g = CGRect(x: sx, y: sy, width: cw, height: ch)
    let o = CGRect(x: sx + cw + gap, y: sy, width: cw, height: ch)

    // Glow
    ctx.saveGState(); ctx.setShadow(offset: .zero, blur: 50, color: goldGlowStrong)
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 22, fs: 270)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 22, fs: 270)
    ctx.restoreGState()

    // Crisp
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 22, fs: 270)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 22, fs: 270)

    // Screws
    for rect in [g, o] {
        screw(ctx, x: rect.minX + 16, y: rect.minY + 16)
        screw(ctx, x: rect.maxX - 16, y: rect.minY + 16)
        screw(ctx, x: rect.minX + 16, y: rect.maxY - 16)
        screw(ctx, x: rect.maxX - 16, y: rect.maxY - 16)
    }

    save(ctx, "go-1A-depth")
}

// ═══════════════════════════════════════════
// 1B: GO mid-flip
// ═══════════════════════════════════════════
do {
    let ctx = makeCtx()
    ctx.setFillColor(bg); ctx.fill(CGRect(origin: .zero, size: cgSize))

    let cw: CGFloat = 300, ch: CGFloat = 400, gap: CGFloat = 28
    let sx = (CGFloat(size) - cw*2 - gap) / 2, sy = (CGFloat(size) - ch) / 2 + 15
    let g = CGRect(x: sx, y: sy, width: cw, height: ch)
    let o = CGRect(x: sx + cw + gap, y: sy, width: cw, height: ch)

    ctx.saveGState(); ctx.setShadow(offset: .zero, blur: 40, color: goldGlow)
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 22, fs: 270)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 22, fs: 270, midFlip: true, flipChar: "N")
    ctx.restoreGState()

    flapCell(ctx, r: g, ch: "G", col: gold, rad: 22, fs: 270)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 22, fs: 270, midFlip: true, flipChar: "N")

    save(ctx, "go-1B-midflip")
}

// ═══════════════════════════════════════════
// 1C: GO with departure indicator
// ═══════════════════════════════════════════
do {
    let ctx = makeCtx()
    ctx.setFillColor(bg); ctx.fill(CGRect(origin: .zero, size: cgSize))

    let cw: CGFloat = 280, ch: CGFloat = 370, gap: CGFloat = 26
    let sx = (CGFloat(size) - cw*2 - gap) / 2 + 15, sy = (CGFloat(size) - ch) / 2
    let g = CGRect(x: sx, y: sy, width: cw, height: ch)
    let o = CGRect(x: sx + cw + gap, y: sy, width: cw, height: ch)

    ctx.saveGState(); ctx.setShadow(offset: .zero, blur: 40, color: goldGlow)
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 20, fs: 250)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 20, fs: 250)
    ctx.restoreGState()
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 20, fs: 250)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 20, fs: 250)

    // Gold indicator bar on left
    ctx.setFillColor(gold)
    let bar = CGPath(roundedRect: CGRect(x: sx - 18, y: sy + 30, width: 5, height: ch - 60), cornerWidth: 2.5, cornerHeight: 2.5, transform: nil)
    ctx.addPath(bar); ctx.fillPath()

    // "DEPARTURES" above
    centeredText(ctx, "DEPARTURES", in: CGRect(x: 0, y: sy + ch + 36, width: CGFloat(size), height: 40), fs: 30, col: muted)

    // Tiny airplane below
    centeredText(ctx, "✈", in: CGRect(x: 0, y: sy - 64, width: CGFloat(size), height: 40), fs: 32, col: goldDim)

    save(ctx, "go-1C-departures")
}

// ═══════════════════════════════════════════
// 1D: GO with runway line
// ═══════════════════════════════════════════
do {
    let ctx = makeCtx()
    ctx.setFillColor(bg); ctx.fill(CGRect(origin: .zero, size: cgSize))

    let cw: CGFloat = 300, ch: CGFloat = 400, gap: CGFloat = 28
    let sx = (CGFloat(size) - cw*2 - gap) / 2, sy = (CGFloat(size) - ch) / 2 + 15
    let g = CGRect(x: sx, y: sy, width: cw, height: ch)
    let o = CGRect(x: sx + cw + gap, y: sy, width: cw, height: ch)

    // Runway lines extending from the gap
    let gapY = sy + ch/2
    ctx.setStrokeColor(c(0x25, 0x25, 0x25))
    ctx.setLineWidth(2)
    // Left runway
    ctx.setLineDash(phase: 0, lengths: [12, 8])
    ctx.move(to: CGPoint(x: 30, y: gapY))
    ctx.addLine(to: CGPoint(x: sx - 8, y: gapY))
    ctx.strokePath()
    // Right runway
    ctx.move(to: CGPoint(x: sx + cw*2 + gap + 8, y: gapY))
    ctx.addLine(to: CGPoint(x: CGFloat(size) - 30, y: gapY))
    ctx.strokePath()
    ctx.setLineDash(phase: 0, lengths: [])

    // Tiny airplane on left runway
    centeredText(ctx, "✈", in: CGRect(x: 10, y: gapY - 20, width: 60, height: 40), fs: 26, col: goldDim)

    ctx.saveGState(); ctx.setShadow(offset: .zero, blur: 45, color: goldGlowStrong)
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 22, fs: 270)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 22, fs: 270)
    ctx.restoreGState()
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 22, fs: 270)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 22, fs: 270)

    save(ctx, "go-1D-runway")
}

// ═══════════════════════════════════════════
// 1E: GO stacked vertical
// ═══════════════════════════════════════════
do {
    let ctx = makeCtx()
    ctx.setFillColor(bg); ctx.fill(CGRect(origin: .zero, size: cgSize))

    let cw: CGFloat = 440, ch: CGFloat = 310, gap: CGFloat = 24
    let sx = (CGFloat(size) - cw) / 2
    let totalH = ch * 2 + gap
    let sy = (CGFloat(size) - totalH) / 2

    let gRect = CGRect(x: sx, y: sy + ch + gap, width: cw, height: ch) // G on top (higher Y in CG)
    let oRect = CGRect(x: sx, y: sy, width: cw, height: ch) // O on bottom

    ctx.saveGState(); ctx.setShadow(offset: .zero, blur: 50, color: goldGlowStrong)
    flapCell(ctx, r: gRect, ch: "G", col: gold, rad: 24, fs: 220)
    flapCell(ctx, r: oRect, ch: "O", col: gold, rad: 24, fs: 220)
    ctx.restoreGState()
    flapCell(ctx, r: gRect, ch: "G", col: gold, rad: 24, fs: 220)
    flapCell(ctx, r: oRect, ch: "O", col: gold, rad: 24, fs: 220)

    // Gold bar on left
    ctx.setFillColor(gold)
    let barPath = CGPath(roundedRect: CGRect(x: sx - 14, y: sy + 20, width: 4, height: totalH - 40), cornerWidth: 2, cornerHeight: 2, transform: nil)
    ctx.addPath(barPath); ctx.fillPath()

    save(ctx, "go-1E-stacked")
}

// ═══════════════════════════════════════════
// 1F: GO with price row
// ═══════════════════════════════════════════
do {
    let ctx = makeCtx()
    ctx.setFillColor(bg); ctx.fill(CGRect(origin: .zero, size: cgSize))

    // Top row: G O
    let cw: CGFloat = 230, ch: CGFloat = 290, gap: CGFloat = 20
    let topW = cw * 2 + gap
    let sx = (CGFloat(size) - topW) / 2
    let topY: CGFloat = 380

    let g = CGRect(x: sx, y: topY, width: cw, height: ch)
    let o = CGRect(x: sx + cw + gap, y: topY, width: cw, height: ch)

    // Bottom row: $ 9 9
    let smallW: CGFloat = 146, smallH: CGFloat = 200, smallGap: CGFloat = 16
    let botW = smallW * 3 + smallGap * 2
    let bsx = (CGFloat(size) - botW) / 2
    let botY: CGFloat = 140

    let d = CGRect(x: bsx, y: botY, width: smallW, height: smallH)
    let n1 = CGRect(x: bsx + smallW + smallGap, y: botY, width: smallW, height: smallH)
    let n2 = CGRect(x: bsx + (smallW + smallGap) * 2, y: botY, width: smallW, height: smallH)

    // Glow
    ctx.saveGState(); ctx.setShadow(offset: .zero, blur: 40, color: goldGlow)
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 18, fs: 200)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 18, fs: 200)
    ctx.restoreGState()
    flapCell(ctx, r: g, ch: "G", col: gold, rad: 18, fs: 200)
    flapCell(ctx, r: o, ch: "O", col: gold, rad: 18, fs: 200)

    // Price row
    flapCell(ctx, r: d, ch: "$", col: green, rad: 12, fs: 130)
    flapCell(ctx, r: n1, ch: "9", col: green, rad: 12, fs: 130)
    flapCell(ctx, r: n2, ch: "9", col: green, rad: 12, fs: 130)

    save(ctx, "go-1F-price")
}

// ═══════════════════════════════════════════
// 1G: GO monochrome luxury
// ═══════════════════════════════════════════
do {
    let ctx = makeCtx()
    ctx.setFillColor(c(0x00, 0x00, 0x00)); ctx.fill(CGRect(origin: .zero, size: cgSize))

    let cw: CGFloat = 310, ch: CGFloat = 410, gap: CGFloat = 24
    let sx = (CGFloat(size) - cw*2 - gap) / 2, sy = (CGFloat(size) - ch) / 2

    let monoTop = c(0x18, 0x18, 0x18)
    let monoBot = c(0x10, 0x10, 0x10)
    let monoBorder = c(0x22, 0x22, 0x22)
    let monoGap = c(0x02, 0x02, 0x02)

    for (i, ch2) in ["G", "O"].enumerated() {
        let r = CGRect(x: sx + CGFloat(i) * (cw + gap), y: sy, width: cw, height: ch)

        let top = CGRect(x: r.minX, y: r.midY + 1.5, width: r.width, height: r.height/2 - 1.5)
        roundRect(ctx, top, rad: 20, fill: monoTop, stroke: monoBorder)

        let bot = CGRect(x: r.minX, y: r.minY, width: r.width, height: r.height/2 - 1.5)
        roundRect(ctx, bot, rad: 20, fill: monoBot, stroke: monoBorder)

        ctx.setFillColor(monoGap)
        ctx.fill(CGRect(x: r.minX + 4, y: r.midY - 1.5, width: r.width - 8, height: 3))

        ctx.saveGState()
        ctx.clip(to: r)
        centeredText(ctx, ch2, in: r, fs: 280, col: white)
        ctx.restoreGState()
    }

    save(ctx, "go-1G-mono")
}

print("\n Done — 7 GO variants in scripts/")

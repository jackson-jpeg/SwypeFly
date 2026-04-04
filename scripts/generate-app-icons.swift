#!/usr/bin/env swift

import AppKit
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

let fileManager = FileManager.default
let repoRoot = URL(fileURLWithPath: fileManager.currentDirectoryPath)

enum RenderMode {
  case fullBackground
  case transparentMark
}

enum BoardFrame {
  case settled
  case midFlip
}

let colorSpace = CGColorSpaceCreateDeviceRGB()

func color(_ r: Int, _ g: Int, _ b: Int, _ a: CGFloat = 1) -> CGColor {
  CGColor(srgbRed: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: a)
}

// ─── Color palette ──────────────────────────────────────────────────────────

let bg = color(0x06, 0x05, 0x03)

// Cell face: warm charcoal with clear top/bottom distinction
let cellTopStart = color(0x30, 0x28, 0x1E)
let cellTopEnd = color(0x26, 0x20, 0x18)
let cellBottomStart = color(0x20, 0x1A, 0x14)
let cellBottomEnd = color(0x18, 0x14, 0x0E)

let borderColor = color(0x3C, 0x30, 0x22)
let cellEdgeHL = color(0x4A, 0x3C, 0x2C, 0.50)
let cellInnerSh = color(0x00, 0x00, 0x00, 0.30)

// Split-flap hinge
let hingeGap = color(0x02, 0x02, 0x01, 0.95)
let hingeHL = color(0x58, 0x48, 0x34, 0.50)

// Text
let textColor = color(0xF8, 0xF6, 0xF2)
let textGlowColor = color(0xFF, 0xFF, 0xFF, 0.22)
let flipGhostColor = color(0x5F, 0x5F, 0x5F, 0.72)
let dropShadow = color(0x00, 0x00, 0x00, 0.60)

func gradient(_ colors: [CGColor], locations: [CGFloat]) -> CGGradient {
  CGGradient(colorsSpace: colorSpace, colors: colors as CFArray, locations: locations)!
}

func makeContext(size: Int, transparent: Bool) -> CGContext {
  let ctx = CGContext(
    data: nil, width: size, height: size,
    bitsPerComponent: 8, bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  )!
  ctx.setAllowsAntialiasing(true)
  ctx.setShouldAntialias(true)
  ctx.interpolationQuality = .high
  if transparent {
    ctx.clear(CGRect(x: 0, y: 0, width: size, height: size))
  }
  return ctx
}

func rrPath(_ rect: CGRect, radius: CGFloat) -> CGPath {
  CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

func drawGrad(_ ctx: CGContext, rect: CGRect, colors: [CGColor], locs: [CGFloat]) {
  ctx.saveGState()
  ctx.addRect(rect)
  ctx.clip()
  ctx.drawLinearGradient(
    gradient(colors, locations: locs),
    start: CGPoint(x: rect.midX, y: rect.maxY),
    end: CGPoint(x: rect.midX, y: rect.minY),
    options: [.drawsAfterEndLocation, .drawsBeforeStartLocation]
  )
  ctx.restoreGState()
}

// ─── Background ──────────────────────────────────────────────────────────────

func drawBackground(_ ctx: CGContext, size: CGFloat) {
  ctx.setFillColor(bg)
  ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))

  // Warm center glow
  ctx.saveGState()
  ctx.drawRadialGradient(
    gradient([color(0x28, 0x1F, 0x14, 0.40), color(0x06, 0x05, 0x03, 0)], locations: [0, 1]),
    startCenter: CGPoint(x: size * 0.5, y: size * 0.50),
    startRadius: 0,
    endCenter: CGPoint(x: size * 0.5, y: size * 0.50),
    endRadius: size * 0.44,
    options: .drawsAfterEndLocation
  )
  ctx.restoreGState()

  // Corner vignette
  ctx.saveGState()
  ctx.drawRadialGradient(
    gradient([color(0x00, 0x00, 0x00, 0), color(0x00, 0x00, 0x00, 0.40)], locations: [0.35, 1.0]),
    startCenter: CGPoint(x: size * 0.5, y: size * 0.5),
    startRadius: size * 0.22,
    endCenter: CGPoint(x: size * 0.5, y: size * 0.5),
    endRadius: size * 0.72,
    options: .drawsAfterEndLocation
  )
  ctx.restoreGState()
}

// ─── Text drawing ────────────────────────────────────────────────────────────

func drawText(
  _ ctx: CGContext,
  text: String,
  rect: CGRect,
  fontSize: CGFloat,
  col: CGColor,
  tracking: CGFloat = 0
) {
  let font = CTFontCreateWithName("Helvetica-Bold" as CFString, fontSize, nil)
  let attrs: [CFString: Any] = [
    kCTFontAttributeName: font,
    kCTForegroundColorAttributeName: col,
    kCTKernAttributeName: tracking,
  ]
  let attrStr = CFAttributedStringCreate(nil, text as CFString, attrs as CFDictionary)!
  let line = CTLineCreateWithAttributedString(attrStr)
  let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)

  ctx.textPosition = CGPoint(
    x: rect.midX - bounds.width / 2 - bounds.origin.x,
    y: rect.midY - bounds.height / 2 - bounds.origin.y
  )
  CTLineDraw(line, ctx)
}

// ─── Inner shadow ────────────────────────────────────────────────────────────

func drawInnerShadow(_ ctx: CGContext, rect: CGRect, radius: CGFloat, blur: CGFloat, col: CGColor) {
  let path = rrPath(rect, radius: radius)
  let outer = rect.insetBy(dx: -blur * 4, dy: -blur * 4)
  ctx.saveGState()
  ctx.addPath(path)
  ctx.clip()
  let outerPath = CGMutablePath()
  outerPath.addRect(outer)
  outerPath.addPath(path)
  ctx.addPath(outerPath)
  ctx.setShadow(offset: .zero, blur: blur, color: col)
  ctx.setFillColor(col)
  ctx.fillPath(using: .evenOdd)
  ctx.restoreGState()
}

// ─── Cell ────────────────────────────────────────────────────────────────────

func drawCell(
  _ ctx: CGContext,
  rect: CGRect,
  text: String,
  flipTopText: String? = nil,
  fontSize: CGFloat
) {
  let r = rect.width * 0.10
  let bw = max(2.5, rect.width * 0.008)
  let sh = max(5, rect.height * 0.020) // split height
  let topHalf = CGRect(x: rect.minX, y: rect.midY, width: rect.width, height: rect.height / 2)
  let botHalf = CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height / 2)
  let clip = rrPath(rect, radius: r)

  // ── Fill ──
  ctx.saveGState()
  ctx.addPath(clip)
  ctx.clip()
  drawGrad(ctx, rect: botHalf, colors: [cellBottomStart, cellBottomEnd], locs: [0, 1])
  drawGrad(ctx, rect: topHalf, colors: [cellTopStart, cellTopEnd], locs: [0, 1])
  ctx.restoreGState()

  // ── Inner shadow ──
  drawInnerShadow(ctx, rect: rect, radius: r, blur: rect.width * 0.05, col: cellInnerSh)

  // ── Top edge bevel highlight ──
  ctx.saveGState()
  ctx.addPath(clip)
  ctx.clip()
  ctx.setFillColor(cellEdgeHL)
  ctx.fill(CGRect(x: rect.minX + r * 0.4, y: rect.maxY - 2.0, width: rect.width - r * 0.8, height: 1.5))
  ctx.restoreGState()

  // ── Border ──
  let inset = rect.insetBy(dx: bw * 0.5, dy: bw * 0.5)
  ctx.addPath(rrPath(inset, radius: r - bw * 0.5))
  ctx.setStrokeColor(borderColor)
  ctx.setLineWidth(bw)
  ctx.strokePath()

  // ── Split-flap hinge ──
  // 1) Dark gap
  let gapRect = CGRect(
    x: rect.minX + rect.width * 0.01,
    y: rect.midY - sh / 2,
    width: rect.width * 0.98,
    height: sh
  )
  ctx.setFillColor(hingeGap)
  ctx.fill(gapRect)

  // 2) Highlight below gap (light catching bottom flap edge)
  ctx.setFillColor(hingeHL)
  ctx.fill(CGRect(x: gapRect.minX, y: gapRect.maxY, width: gapRect.width, height: max(1.5, sh * 0.30)))

  // 3) Shadow above gap (top flap casting shadow)
  ctx.setFillColor(color(0x00, 0x00, 0x00, 0.20))
  ctx.fill(CGRect(x: gapRect.minX, y: gapRect.minY - max(1.5, sh * 0.30), width: gapRect.width, height: max(1.5, sh * 0.30)))

  // ── Text: glow pass ──
  ctx.saveGState()
  ctx.addPath(clip)
  ctx.clip()
  ctx.setShadow(offset: .zero, blur: rect.width * 0.05, color: textGlowColor)
  drawText(ctx, text: text, rect: rect, fontSize: fontSize, col: textColor)
  ctx.restoreGState()

  // ── Text: crisp pass ──
  ctx.saveGState()
  ctx.addPath(clip)
  ctx.clip()
  drawText(ctx, text: text, rect: rect, fontSize: fontSize, col: textColor)
  ctx.restoreGState()

  // ── Mid-flip overlay ──
  if let flipTopText {
    ctx.saveGState()
    ctx.clip(to: topHalf.insetBy(dx: 0, dy: -rect.height * 0.02))
    drawText(ctx, text: flipTopText, rect: rect.offsetBy(dx: 0, dy: rect.height * 0.08),
             fontSize: fontSize * 0.9, col: flipGhostColor)
    ctx.restoreGState()

    let flapRect = CGRect(
      x: rect.minX + rect.width * 0.015,
      y: rect.midY - rect.height * 0.06,
      width: rect.width * 0.97,
      height: rect.height * 0.14
    )
    ctx.addPath(rrPath(flapRect, radius: rect.width * 0.02))
    ctx.setFillColor(color(0x1E, 0x19, 0x13))
    ctx.fillPath()
    ctx.addPath(rrPath(flapRect, radius: rect.width * 0.02))
    ctx.setStrokeColor(borderColor)
    ctx.setLineWidth(bw * 0.6)
    ctx.strokePath()
  }
}

// ─── Board composition ──────────────────────────────────────────────────────

func drawBoard(_ ctx: CGContext, size: CGFloat, mode: RenderMode, frame: BoardFrame) {
  let transparent = mode == .transparentMark
  let mw = size * (transparent ? 0.88 : 0.84)
  let cw = mw * 0.484
  let ch = size * (transparent ? 0.50 : 0.48)
  let gap = mw * 0.030
  let tw = cw * 2 + gap
  let ox = (size - tw) / 2
  let oy = (size - ch) / 2
  let blur = size * (transparent ? 0.02 : 0.04)

  let c1 = CGRect(x: ox, y: oy, width: cw, height: ch)
  let c2 = CGRect(x: c1.maxX + gap, y: oy, width: cw, height: ch)

  // Ambient glow behind board
  if !transparent {
    ctx.saveGState()
    let center = CGPoint(x: (c1.minX + c2.maxX) / 2, y: (c1.minY + c1.maxY) / 2)
    ctx.drawRadialGradient(
      gradient([color(0x35, 0x2A, 0x1C, 0.25), color(0x06, 0x05, 0x03, 0)], locations: [0, 1]),
      startCenter: center, startRadius: 0,
      endCenter: center, endRadius: tw * 0.6,
      options: .drawsAfterEndLocation
    )
    ctx.restoreGState()
  }

  // G cell
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: -size * 0.010), blur: blur, color: dropShadow)
  drawCell(ctx, rect: c1, text: "G", fontSize: ch * 0.66)
  ctx.restoreGState()

  // O cell
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: -size * 0.010), blur: blur, color: dropShadow)
  drawCell(ctx, rect: c2, text: "O", flipTopText: frame == .midFlip ? "N" : nil, fontSize: ch * 0.66)
  ctx.restoreGState()
}

// ─── PNG writer ──────────────────────────────────────────────────────────────

func writePNG(_ ctx: CGContext, to url: URL) {
  guard let image = ctx.makeImage() else { fatalError("No image for \(url.path)") }
  fileManager.createFile(atPath: url.path, contents: nil)
  guard let dest = CGImageDestinationCreateWithURL(
    url as CFURL, UTType.png.identifier as CFString, 1, nil
  ) else { fatalError("No dest for \(url.path)") }
  CGImageDestinationAddImage(dest, image, nil)
  guard CGImageDestinationFinalize(dest) else { fatalError("Write failed for \(url.path)") }
}

// ─── Render + export ─────────────────────────────────────────────────────────

func renderIcon(size: Int, mode: RenderMode, frame: BoardFrame) -> CGContext {
  let transparent = mode == .transparentMark
  let ctx = makeContext(size: size, transparent: transparent)
  if !transparent { drawBackground(ctx, size: CGFloat(size)) }
  drawBoard(ctx, size: CGFloat(size), mode: mode, frame: frame)
  return ctx
}

let exports: [(String, Int, RenderMode, BoardFrame)] = [
  ("assets/icon.png", 1024, .fullBackground, .settled),
  ("assets/adaptive-icon.png", 1024, .transparentMark, .settled),
  ("assets/splash-icon.png", 1024, .transparentMark, .settled),
  ("assets/favicon.png", 64, .fullBackground, .settled),
  ("public/assets/icon-180.png", 180, .fullBackground, .settled),
  ("public/assets/icon-192.png", 192, .fullBackground, .settled),
  ("public/assets/icon-512.png", 512, .fullBackground, .settled),
  ("public/assets/favicon-frame-0.png", 64, .fullBackground, .settled),
  ("public/assets/favicon-frame-1.png", 64, .fullBackground, .midFlip),
  ("SoGoJet-iOS/SoGoJet/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png", 1024, .fullBackground, .settled),
]

for (path, size, mode, frame) in exports {
  let url = repoRoot.appendingPathComponent(path)
  try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  writePNG(renderIcon(size: size, mode: mode, frame: frame), to: url)
  print("Wrote \(path)")
}

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

let bg = color(0x0A, 0x08, 0x06)
let bgLift = color(0x15, 0x11, 0x0D)
let cellTopStart = color(0x23, 0x1D, 0x16)
let cellTopEnd = color(0x1D, 0x18, 0x12)
let cellBottomStart = color(0x18, 0x13, 0x0F)
let cellBottomEnd = color(0x12, 0x0F, 0x0B)
let border = color(0x2A, 0x22, 0x18)
let splitShadow = color(0x07, 0x05, 0x04, 0.9)
let splitHighlight = color(0x43, 0x38, 0x2B, 0.65)
let white = color(0xF2, 0xF2, 0xF2)
let whiteGlow = color(0xFF, 0xFF, 0xFF, 0.16)
let flipGhost = color(0x5F, 0x5F, 0x5F, 0.72)
let softShadow = color(0x00, 0x00, 0x00, 0.45)

func gradient(_ colors: [CGColor], locations: [CGFloat]) -> CGGradient {
  CGGradient(colorsSpace: colorSpace, colors: colors as CFArray, locations: locations)!
}

func makeContext(size: Int, transparent: Bool) -> CGContext {
  let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
  let ctx = CGContext(
    data: nil,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  )!

  if transparent {
    ctx.clear(CGRect(x: 0, y: 0, width: size, height: size))
  }

  return ctx
}

func strokeRoundedRect(_ ctx: CGContext, rect: CGRect, radius: CGFloat, color: CGColor, width: CGFloat) {
  let path = CGPath(
    roundedRect: rect,
    cornerWidth: radius,
    cornerHeight: radius,
    transform: nil
  )
  ctx.addPath(path)
  ctx.setStrokeColor(color)
  ctx.setLineWidth(width)
  ctx.strokePath()
}

func fillRoundedRect(_ ctx: CGContext, rect: CGRect, radius: CGFloat, color: CGColor) {
  let path = CGPath(
    roundedRect: rect,
    cornerWidth: radius,
    cornerHeight: radius,
    transform: nil
  )
  ctx.addPath(path)
  ctx.setFillColor(color)
  ctx.fillPath()
}

func drawLinearGradient(_ ctx: CGContext, rect: CGRect, colors: [CGColor], locations: [CGFloat]) {
  ctx.saveGState()
  ctx.addRect(rect)
  ctx.clip()
  let fill = gradient(colors, locations: locations)
  ctx.drawLinearGradient(
    fill,
    start: CGPoint(x: rect.midX, y: rect.maxY),
    end: CGPoint(x: rect.midX, y: rect.minY),
    options: [.drawsAfterEndLocation, .drawsBeforeStartLocation]
  )
  ctx.restoreGState()
}

func drawBackground(_ ctx: CGContext, size: CGFloat) {
  let rect = CGRect(x: 0, y: 0, width: size, height: size)
  ctx.setFillColor(bg)
  ctx.fill(rect)

  let radial = gradient([whiteGlow, color(0x0A, 0x08, 0x06, 0)], locations: [0, 1])
  ctx.saveGState()
  ctx.drawRadialGradient(
    radial,
    startCenter: CGPoint(x: size * 0.5, y: size * 0.55),
    startRadius: 0,
    endCenter: CGPoint(x: size * 0.5, y: size * 0.55),
    endRadius: size * 0.38,
    options: .drawsAfterEndLocation
  )
  ctx.restoreGState()

  let wash = gradient([bgLift, bg], locations: [0, 1])
  ctx.saveGState()
  ctx.setAlpha(0.5)
  ctx.drawLinearGradient(
    wash,
    start: CGPoint(x: size * 0.5, y: size),
    end: CGPoint(x: size * 0.5, y: size * 0.2),
    options: [.drawsAfterEndLocation, .drawsBeforeStartLocation]
  )
  ctx.restoreGState()
}

func drawCenteredText(
  _ ctx: CGContext,
  text: String,
  rect: CGRect,
  fontSize: CGFloat,
  color: CGColor,
  tracking: CGFloat = 0
) {
  let font = CTFontCreateWithName("Helvetica-Bold" as CFString, fontSize, nil)
  let attributes: [CFString: Any] = [
    kCTFontAttributeName: font,
    kCTForegroundColorAttributeName: color,
    kCTKernAttributeName: tracking,
  ]

  let attributed = CFAttributedStringCreate(nil, text as CFString, attributes as CFDictionary)!
  let line = CTLineCreateWithAttributedString(attributed)
  let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)

  ctx.textPosition = CGPoint(
    x: rect.midX - bounds.width / 2 - bounds.origin.x,
    y: rect.midY - bounds.height / 2 - bounds.origin.y
  )
  CTLineDraw(line, ctx)
}

func drawCell(
  _ ctx: CGContext,
  rect: CGRect,
  text: String,
  flipTopText: String? = nil,
  fontSize: CGFloat
) {
  let radius = rect.width * 0.085
  let borderWidth = max(2, rect.width * 0.008)
  let splitHeight = max(3, rect.height * 0.012)
  let topRect = CGRect(x: rect.minX, y: rect.midY, width: rect.width, height: rect.height / 2)

  let clipPath = CGPath(
    roundedRect: rect,
    cornerWidth: radius,
    cornerHeight: radius,
    transform: nil
  )

  ctx.saveGState()
  ctx.addPath(clipPath)
  ctx.clip()
  drawLinearGradient(ctx, rect: rect, colors: [cellBottomStart, cellBottomEnd], locations: [0, 1])
  drawLinearGradient(ctx, rect: topRect, colors: [cellTopStart, cellTopEnd], locations: [0, 1])
  ctx.restoreGState()

  strokeRoundedRect(ctx, rect: rect, radius: radius, color: border, width: borderWidth)

  let splitRect = CGRect(
    x: rect.minX + rect.width * 0.03,
    y: rect.midY - splitHeight / 2,
    width: rect.width * 0.94,
    height: splitHeight
  )
  ctx.setFillColor(splitShadow)
  ctx.fill(splitRect)

  ctx.setFillColor(splitHighlight)
  ctx.fill(
    CGRect(x: splitRect.minX, y: splitRect.maxY, width: splitRect.width, height: max(1, splitHeight * 0.35))
  )

  ctx.saveGState()
  ctx.clip(to: rect)
  ctx.setShadow(offset: .zero, blur: rect.width * 0.05, color: whiteGlow)
  drawCenteredText(ctx, text: text, rect: rect, fontSize: fontSize, color: white)
  ctx.restoreGState()

  if let flipTopText {
    ctx.saveGState()
    ctx.clip(to: topRect.insetBy(dx: 0, dy: -rect.height * 0.02))
    let shifted = rect.offsetBy(dx: 0, dy: rect.height * 0.08)
    drawCenteredText(
      ctx,
      text: flipTopText,
      rect: shifted,
      fontSize: fontSize * 0.9,
      color: flipGhost
    )
    ctx.restoreGState()

    let flapRect = CGRect(
      x: rect.minX + rect.width * 0.025,
      y: rect.midY - rect.height * 0.05,
      width: rect.width * 0.95,
      height: rect.height * 0.12
    )
    fillRoundedRect(ctx, rect: flapRect, radius: rect.width * 0.025, color: color(0x1B, 0x17, 0x12))
    strokeRoundedRect(ctx, rect: flapRect, radius: rect.width * 0.025, color: border, width: borderWidth * 0.7)
  }
}

func drawBoardMark(_ ctx: CGContext, size: CGFloat, mode: RenderMode, frame: BoardFrame) {
  let transparent = mode == .transparentMark
  let markWidth = size * (transparent ? 0.86 : 0.84)
  let cellWidth = markWidth * 0.488
  let cellHeight = size * (transparent ? 0.46 : 0.44)
  let cellGap = markWidth * 0.024
  let totalWidth = cellWidth * 2 + cellGap
  let originX = (size - totalWidth) / 2
  let originY = (size - cellHeight) / 2
  let shadowBlur = size * (transparent ? 0.018 : 0.024)

  let firstCell = CGRect(
    x: originX,
    y: originY,
    width: cellWidth,
    height: cellHeight
  )

  let secondCell = CGRect(
    x: firstCell.maxX + cellGap,
    y: originY,
    width: cellWidth,
    height: cellHeight
  )

  if !transparent {
    let halo = CGRect(
      x: firstCell.minX - size * 0.08,
      y: firstCell.minY - size * 0.07,
      width: secondCell.maxX - firstCell.minX + size * 0.16,
      height: cellHeight + size * 0.14
    )
    ctx.saveGState()
    ctx.setAlpha(0.65)
    let glow = gradient([whiteGlow, color(0x0A, 0x08, 0x06, 0)], locations: [0, 1])
    ctx.drawRadialGradient(
      glow,
      startCenter: CGPoint(x: halo.midX, y: halo.midY),
      startRadius: 0,
      endCenter: CGPoint(x: halo.midX, y: halo.midY),
      endRadius: halo.width * 0.5,
      options: .drawsAfterEndLocation
    )
    ctx.restoreGState()
  }

  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: -size * 0.006), blur: shadowBlur, color: softShadow)
  drawCell(ctx, rect: firstCell, text: "G", fontSize: cellHeight * 0.7)
  drawCell(
    ctx,
    rect: secondCell,
    text: "O",
    flipTopText: frame == .midFlip ? "N" : nil,
    fontSize: cellHeight * 0.7
  )
  ctx.restoreGState()
}

func writePNG(_ ctx: CGContext, to url: URL) {
  guard let image = ctx.makeImage() else {
    fatalError("Unable to render image for \(url.path)")
  }

  fileManager.createFile(atPath: url.path, contents: nil)

  guard let destination = CGImageDestinationCreateWithURL(
    url as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
  ) else {
    fatalError("Unable to create PNG destination for \(url.path)")
  }

  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else {
    fatalError("Unable to write PNG to \(url.path)")
  }
}

func renderIcon(size: Int, mode: RenderMode, frame: BoardFrame) -> CGContext {
  let transparent = mode == .transparentMark
  let ctx = makeContext(size: size, transparent: transparent)

  if !transparent {
    drawBackground(ctx, size: CGFloat(size))
  }

  drawBoardMark(ctx, size: CGFloat(size), mode: mode, frame: frame)
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

for (relativePath, size, mode, frame) in exports {
  let outputURL = repoRoot.appendingPathComponent(relativePath)
  let directory = outputURL.deletingLastPathComponent()
  try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
  let ctx = renderIcon(size: size, mode: mode, frame: frame)
  writePNG(ctx, to: outputURL)
  print("Wrote \(relativePath)")
}

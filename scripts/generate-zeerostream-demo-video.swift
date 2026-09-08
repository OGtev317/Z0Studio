import AppKit
import AVFoundation
import CoreVideo
import Foundation

let outputPath = CommandLine.arguments.dropFirst().first ?? "public/zeerostream-demo.mp4"
let outputURL = URL(fileURLWithPath: outputPath)
try? FileManager.default.removeItem(at: outputURL)

let width = 1280
let height = 720
let framesPerSecond: Int32 = 6
let seconds = 180
let totalFrames = seconds * Int(framesPerSecond)

let slides: [(range: Range<Int>, kicker: String, title: String, body: [String], accent: String)] = [
    (0..<18, "ZEEROSTREAM", "Private checkout for creators", [
        "A Starknet Mainnet creator page where subscribers can pay through STRK20 without exposing the payment relationship.",
        "Wallet keys, notes, proving, and signing stay inside the user's privacy-enabled wallet."
    ], "Live demo: https://zeerostream.pages.dev"),
    (18..<36, "THE PROBLEM", "Creator payments are too public", [
        "Freelance and creator payments can reveal who paid whom, when they paid, and how much activity a wallet has.",
        "ZeeroStream keeps the product simple: a private checkout lane for paid creator access."
    ], "Private checkout, public receipts"),
    (36..<54, "WALLET BOUNDARY", "The app prepares. The wallet proves.", [
        "ZeeroStream checks Wallet API support, shows the reviewed Mainnet pool target, runs a dry-run, then stops for wallet review.",
        "The app never asks for viewing keys, private balances, proof witnesses, seed phrases, or signing keys."
    ], "supportedWalletApi, not private balance probing"),
    (54..<72, "STEP 1", "Creator shield", [
        "The creator's first shield enters the STRK20 pool and can register the creator wallet.",
        "The deposit edge is public, but the later private payment is separated from that deposit."
    ], "Receipt 1: 0x016301b81ab2fce40fd224140a592a7c23d408ea2f3eb893196c7e4d337f3217"),
    (72..<90, "STEP 2", "Client shield and note maturity", [
        "The client shields STRK through the same reviewed Mainnet pool and waits for the private note to mature.",
        "ERC-20 approval is separate; the qualifying evidence is the successful STRK20 pool transaction."
    ], "Receipt 2: 0x03334787479e79a867e85c7427699a7ad3530934800c11c4ed5b0fc431b59f29"),
    (90..<108, "STEP 3", "Private creator payment", [
        "The wallet discovers notes, builds the proof, signs, and submits through the relayer.",
        "Observers can see pool use, but not the private sender, recipient, amount, or spent notes."
    ], "Receipt 3: 0x7f11f4e677a5d6d9cf939d652f5c471e081742bc6aec152491dc56e8757aca0"),
    (108..<126, "ENCRYPTED MEMO", "A receipt note only the creator can read", [
        "Subscribers can attach an optional memo before signing the payment.",
        "ZeeroStream stores ciphertext and receipt binding; the creator decrypts locally in the inbox demo."
    ], "Encrypted note demo, not production message transport"),
    (126..<144, "SELECTIVE DISCLOSURE", "Show access. Hide everything else.", [
        "The tier demo proves only that the visitor has the right access for this creator page right now.",
        "It does not disclose wallet history, identity documents, private notes, memos, or proof witnesses."
    ], "Verify access, never scan a wallet"),
    (144..<162, "SCORING EVIDENCE", "Three Mainnet pool receipts", [
        "Both repository and public manifests list the same three successful Mainnet STRK20 pool transactions.",
        "The verifier checks two distinct RPC providers, pool class, receipt agreement, live demo, and this public video URL."
    ], "strk20.json is the competition evidence file"),
    (162..<180, "HONEST SCOPE", "Built for the sprint, clear about the edges", [
        "Live: private creator checkout, encrypted memo receipt demo, selective-disclosure demo, and verified receipt hashes.",
        "Not claimed: full encrypted mail, autonomous subscriptions, custom helper contracts, production analytics, or custody."
    ], "ZeeroStream Private Sprint MVP")
]

func color(_ hex: Int, _ alpha: CGFloat = 1.0) -> NSColor {
    let r = CGFloat((hex >> 16) & 0xff) / 255.0
    let g = CGFloat((hex >> 8) & 0xff) / 255.0
    let b = CGFloat(hex & 0xff) / 255.0
    return NSColor(calibratedRed: r, green: g, blue: b, alpha: alpha)
}

func drawText(_ text: String, in rect: NSRect, size: CGFloat, weight: NSFont.Weight, color: NSColor, align: NSTextAlignment = .left) {
    let style = NSMutableParagraphStyle()
    style.alignment = align
    style.lineBreakMode = .byWordWrapping
    style.lineSpacing = size * 0.14
    let font = NSFont.systemFont(ofSize: size, weight: weight)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: style
    ]
    NSString(string: text).draw(in: rect, withAttributes: attrs)
}

func roundedRect(_ rect: NSRect, radius: CGFloat, fill: NSColor, stroke: NSColor? = nil) {
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    fill.setFill()
    path.fill()
    if let stroke {
        stroke.setStroke()
        path.lineWidth = 1
        path.stroke()
    }
}

func drawFrame(index: Int) -> CGImage {
    let second = index / Int(framesPerSecond)
    let slide = slides.first(where: { $0.range.contains(second) }) ?? slides[0]
    let localProgress = CGFloat(second - slide.range.lowerBound) / CGFloat(slide.range.count)
    let globalProgress = CGFloat(index) / CGFloat(max(totalFrames - 1, 1))
    let image = NSImage(size: NSSize(width: width, height: height))

    image.lockFocus()
    color(0x02040d).setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()

    let ctx = NSGraphicsContext.current!.cgContext
    let gradientColors = [
        color(0x07133a, 0.98).cgColor,
        color(0x02040d, 1).cgColor,
        color(0x111827, 1).cgColor
    ] as CFArray
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: gradientColors, locations: [0, 0.58, 1])!
    ctx.drawLinearGradient(gradient, start: CGPoint(x: 0, y: height), end: CGPoint(x: width, y: 0), options: [])

    for column in stride(from: 0, through: width, by: 32) {
        let alpha = CGFloat((column % 96) + 24) / 360.0
        color(column % 64 == 0 ? 0x6f8dff : 0xd4d9e2, alpha).setStroke()
        let path = NSBezierPath()
        path.move(to: NSPoint(x: column, y: 0))
        path.line(to: NSPoint(x: column, y: height))
        path.lineWidth = 0.8
        path.stroke()
    }

    let scanY = CGFloat(height) * (1.0 - globalProgress)
    color(0x315dff, 0.18).setFill()
    NSRect(x: 0, y: scanY, width: CGFloat(width), height: 96).fill()

    roundedRect(NSRect(x: 70, y: 612, width: 250, height: 42), radius: 6, fill: color(0x315dff, 0.18), stroke: color(0x6f8dff, 0.5))
    drawText(slide.kicker, in: NSRect(x: 90, y: 620, width: 220, height: 24), size: 15, weight: .bold, color: color(0xd4d9e2))

    drawText("ZEERO", in: NSRect(x: 70, y: 470, width: 510, height: 90), size: 74, weight: .heavy, color: color(0xeef2f8))
    drawText("STREAM", in: NSRect(x: 352, y: 470, width: 520, height: 90), size: 74, weight: .heavy, color: color(0x6f8dff))
    drawText(slide.title, in: NSRect(x: 72, y: 392, width: 720, height: 72), size: 38, weight: .bold, color: color(0xeef2f8))

    var bodyY: CGFloat = 318
    for line in slide.body {
        drawText(line, in: NSRect(x: 76, y: bodyY, width: 700, height: 64), size: 22, weight: .regular, color: color(0xc7d0dc))
        bodyY -= 76
    }

    roundedRect(NSRect(x: 72, y: 84, width: 760, height: 76), radius: 6, fill: color(0x081423, 0.86), stroke: color(0x6f8dff, 0.35))
    drawText(slide.accent, in: NSRect(x: 96, y: 103, width: 712, height: 42), size: 17, weight: .semibold, color: color(0xeef2f8))

    roundedRect(NSRect(x: 860, y: 106, width: 360, height: 456), radius: 8, fill: color(0x080e1d, 0.82), stroke: color(0xd4d9e2, 0.22))
    drawText("Sprint status", in: NSRect(x: 890, y: 508, width: 290, height: 30), size: 21, weight: .bold, color: color(0xeef2f8))
    let facts = [
        ("3 / 3", "Mainnet receipts"),
        ("2 RPCs", "receipt agreement"),
        ("0", "keys held by app"),
        ("V2", "reviewed pool class")
    ]
    var factY: CGFloat = 420
    for fact in facts {
        drawText(fact.0, in: NSRect(x: 890, y: factY, width: 110, height: 34), size: 28, weight: .heavy, color: color(0x6f8dff))
        drawText(fact.1, in: NSRect(x: 1016, y: factY + 5, width: 170, height: 28), size: 14, weight: .medium, color: color(0xc7d0dc))
        factY -= 76
    }

    let barWidth = CGFloat(width - 140)
    roundedRect(NSRect(x: 70, y: 34, width: barWidth, height: 8), radius: 4, fill: color(0xd4d9e2, 0.16))
    roundedRect(NSRect(x: 70, y: 34, width: barWidth * globalProgress, height: 8), radius: 4, fill: color(0x315dff, 0.95))
    drawText(String(format: "%02d:%02d / 03:00", second / 60, second % 60), in: NSRect(x: 1048, y: 52, width: 170, height: 24), size: 14, weight: .semibold, color: color(0x9ba3af), align: .right)

    let pulse = 0.5 + 0.5 * CGFloat(sin(Double(localProgress * .pi * 2.0)))
    color(0x6f8dff, 0.16 + 0.10 * pulse).setFill()
    NSBezierPath(ovalIn: NSRect(x: 968, y: 612, width: 44, height: 44)).fill()
    color(0xd4d9e2, 0.18).setFill()
    NSBezierPath(ovalIn: NSRect(x: 1030, y: 604, width: 76, height: 76)).fill()

    image.unlockFocus()
    return image.cgImage(forProposedRect: nil, context: nil, hints: nil)!
}

let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 700_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ]
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let attrs: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attrs)

guard writer.canAdd(input) else {
    fatalError("video input cannot be added")
}
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

for frame in 0..<totalFrames {
    while !input.isReadyForMoreMediaData {
        usleep(1_000)
    }
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32ARGB, nil, &pixelBuffer)
    guard let buffer = pixelBuffer else {
        fatalError("pixel buffer allocation failed")
    }
    CVPixelBufferLockBaseAddress(buffer, [])
    let ctx = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    )!
    ctx.draw(drawFrame(index: frame), in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    let time = CMTime(value: CMTimeValue(frame), timescale: framesPerSecond)
    if !adaptor.append(buffer, withPresentationTime: time) {
        fatalError("failed to append frame \(frame)")
    }
}

input.markAsFinished()
writer.finishWriting {
    if writer.status != .completed {
        fatalError(writer.error?.localizedDescription ?? "video writer failed")
    }
}
while writer.status == .writing {
    usleep(50_000)
}
print("wrote \(outputPath)")

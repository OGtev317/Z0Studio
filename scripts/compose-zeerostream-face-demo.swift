import AVFoundation
import Foundation

let arguments = Array(CommandLine.arguments.dropFirst())
let facePath = arguments.indices.contains(0) ? arguments[0] : "/Users/tevdev/Downloads/IMG_6553.MOV"
let backgroundPath = arguments.indices.contains(1) ? arguments[1] : "public/zeerostream-demo.mp4"
let outputPath = arguments.indices.contains(2) ? arguments[2] : "public/zeerostream-demo.mp4"

let fileManager = FileManager.default
let faceURL = URL(fileURLWithPath: facePath)
let originalBackgroundURL = URL(fileURLWithPath: backgroundPath)
let outputURL = URL(fileURLWithPath: outputPath)
let tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
let workingBackgroundURL: URL

if originalBackgroundURL.standardizedFileURL == outputURL.standardizedFileURL {
    workingBackgroundURL = tempDirectory.appendingPathComponent("zeerostream-background-\(UUID().uuidString).mp4")
    try? fileManager.removeItem(at: workingBackgroundURL)
    try fileManager.copyItem(at: originalBackgroundURL, to: workingBackgroundURL)
} else {
    workingBackgroundURL = originalBackgroundURL
}

let exportURL = tempDirectory.appendingPathComponent("zeerostream-face-demo-\(UUID().uuidString).mp4")
try? fileManager.removeItem(at: exportURL)

let backgroundAsset = AVURLAsset(url: workingBackgroundURL)
let faceAsset = AVURLAsset(url: faceURL)
let composition = AVMutableComposition()

guard
    let backgroundVideo = backgroundAsset.tracks(withMediaType: .video).first,
    let faceVideo = faceAsset.tracks(withMediaType: .video).first
else {
    fatalError("missing video track")
}

let backgroundDuration = backgroundAsset.duration
let faceDuration = CMTimeMinimum(faceAsset.duration, backgroundDuration)
let fullRange = CMTimeRange(start: .zero, duration: backgroundDuration)
let faceRange = CMTimeRange(start: .zero, duration: faceDuration)

guard
    let backgroundTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid,
    ),
    let faceTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid,
    )
else {
    fatalError("failed to create composition tracks")
}

try backgroundTrack.insertTimeRange(fullRange, of: backgroundVideo, at: .zero)
try faceTrack.insertTimeRange(faceRange, of: faceVideo, at: .zero)

if let faceAudio = faceAsset.tracks(withMediaType: .audio).first,
   let audioTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid,
   ) {
    try audioTrack.insertTimeRange(faceRange, of: faceAudio, at: .zero)
}

let renderSize = CGSize(width: 1280, height: 720)
let instruction = AVMutableVideoCompositionInstruction()
instruction.timeRange = fullRange

let backgroundInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: backgroundTrack)
backgroundInstruction.setTransform(backgroundVideo.preferredTransform, at: .zero)

let faceInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: faceTrack)
let faceDisplayRect = CGRect(origin: .zero, size: faceVideo.naturalSize).applying(faceVideo.preferredTransform)
let faceDisplaySize = CGSize(width: abs(faceDisplayRect.width), height: abs(faceDisplayRect.height))
let targetHeight: CGFloat = 310
let scale = targetHeight / faceDisplaySize.height
let targetWidth = faceDisplaySize.width * scale
let margin: CGFloat = 34
let targetX = renderSize.width - targetWidth - margin
let targetY: CGFloat = 92
let normalizedFaceTransform = faceVideo.preferredTransform
    .concatenating(CGAffineTransform(translationX: -faceDisplayRect.minX, y: -faceDisplayRect.minY))
    .concatenating(CGAffineTransform(scaleX: scale, y: scale))
    .concatenating(CGAffineTransform(translationX: targetX, y: targetY))
faceInstruction.setTransform(normalizedFaceTransform, at: .zero)
faceInstruction.setOpacity(0.0, at: faceDuration)

instruction.layerInstructions = [faceInstruction, backgroundInstruction]

let videoComposition = AVMutableVideoComposition()
videoComposition.renderSize = renderSize
videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
videoComposition.instructions = [instruction]

guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPreset640x480) else {
    fatalError("failed to create export session")
}
export.outputURL = exportURL
export.outputFileType = .mp4
export.videoComposition = videoComposition
export.shouldOptimizeForNetworkUse = true

let semaphore = DispatchSemaphore(value: 0)
export.exportAsynchronously {
    semaphore.signal()
}
semaphore.wait()

if export.status != .completed {
    fatalError(export.error?.localizedDescription ?? "export failed")
}

try? fileManager.removeItem(at: outputURL)
try fileManager.moveItem(at: exportURL, to: outputURL)
if workingBackgroundURL != originalBackgroundURL {
    try? fileManager.removeItem(at: workingBackgroundURL)
}

print("wrote \(outputPath)")
print(String(format: "duration=%.2f", CMTimeGetSeconds(backgroundDuration)))
print(String(format: "face_overlay_seconds=%.2f", CMTimeGetSeconds(faceDuration)))

// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SoGoJet",
    platforms: [.iOS(.v17)],
    targets: [
        .executableTarget(
            name: "SoGoJet",
            path: "SoGoJet"
        )
    ]
)

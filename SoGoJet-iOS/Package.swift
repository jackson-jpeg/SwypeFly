// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SoGoJet",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(url: "https://github.com/stripe/stripe-ios.git", from: "24.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "SoGoJet",
            dependencies: [
                .product(name: "StripePaymentSheet", package: "stripe-ios"),
            ],
            path: "SoGoJet"
        )
    ]
)

import SwiftUI

/// Animated departure-board-style loading screen shown while Duffel searches for live fares.
struct SearchingFlightsView: View {
    let origin: String
    let destination: String
    let destinationCity: String
    let dateRange: String
    let cabinClass: String

    @State private var phase = 0
    @State private var planeOffset: CGFloat = -200
    @State private var planeOpacity: Double = 0
    @State private var statusText = "CONNECTING"
    @State private var dotsCount = 0
    @State private var scanLineY: CGFloat = 0
    @State private var animateFlap = false
    @State private var showRoute = false

    private let statusMessages = [
        "CONNECTING TO AIRLINES",
        "SCANNING LIVE FARES",
        "CHECKING \(Int.random(in: 40...180)) FLIGHTS",
        "COMPARING PRICES",
        "FINDING BEST DEAL",
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Terminal header
            HStack {
                Circle()
                    .fill(Color.sgYellow.opacity(0.8))
                    .frame(width: 6, height: 6)
                    .modifier(PulseModifier())

                Text("LIVE SEARCH")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgYellow)
                    .tracking(2)

                Spacer()

                Text(cabinClass.uppercased())
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .background(Color.sgYellow.opacity(0.06))

            Spacer().frame(height: Spacing.lg)

            // Route display with animated plane
            ZStack {
                HStack(spacing: 0) {
                    // Origin
                    VStack(spacing: 4) {
                        SplitFlapRow(
                            text: origin,
                            maxLength: 3,
                            size: .md,
                            color: Color.sgWhite,
                            alignment: .center,
                            animate: animateFlap,
                            staggerMs: 40
                        )
                        Text("DEPART")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgMuted)
                            .tracking(1.5)
                    }

                    Spacer()

                    // Destination
                    VStack(spacing: 4) {
                        SplitFlapRow(
                            text: destination,
                            maxLength: 3,
                            size: .md,
                            color: Color.sgWhite,
                            alignment: .center,
                            animate: animateFlap,
                            staggerMs: 40
                        )
                        Text("ARRIVE")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgMuted)
                            .tracking(1.5)
                    }
                }
                .padding(.horizontal, Spacing.lg)

                // Animated plane flying across
                Image(systemName: "airplane")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Color.sgYellow)
                    .offset(x: planeOffset)
                    .opacity(planeOpacity)
            }

            Spacer().frame(height: Spacing.md)

            // Destination city name
            if showRoute {
                Text(destinationCity.uppercased())
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgWhiteDim)
                    .tracking(3)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            Spacer().frame(height: Spacing.sm)

            // Date range
            Text(dateRange)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(Color.sgMuted)

            Spacer().frame(height: Spacing.lg)

            // Scan line + status
            ZStack(alignment: .top) {
                // Scan line
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [Color.sgYellow.opacity(0), Color.sgYellow.opacity(0.3), Color.sgYellow.opacity(0)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(height: 1)
                    .offset(y: scanLineY)

                VStack(spacing: 8) {
                    Spacer().frame(height: 12)

                    // Status message with cycling dots
                    HStack(spacing: 4) {
                        Text(statusText)
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgYellow.opacity(0.8))
                            .tracking(1)

                        Text(String(repeating: ".", count: dotsCount))
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgYellow.opacity(0.5))
                            .frame(width: 20, alignment: .leading)
                    }

                    // Progress bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.sgSurface)
                                .frame(height: 3)

                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.sgYellow.opacity(0.6))
                                .frame(width: geo.size.width * progressFraction, height: 3)
                                .animation(.easeInOut(duration: 0.5), value: phase)
                        }
                    }
                    .frame(height: 3)
                    .padding(.horizontal, Spacing.xl)
                }
            }
            .frame(height: 50)

            Spacer().frame(height: Spacing.md)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
        .onAppear { startAnimations() }
    }

    private var progressFraction: CGFloat {
        min(CGFloat(phase + 1) / CGFloat(statusMessages.count), 1.0)
    }

    private func startAnimations() {
        // Flap in the codes
        withAnimation { animateFlap = true }

        // Plane flies across
        withAnimation(.easeInOut(duration: 2.0).delay(0.3)) {
            planeOffset = 200
            planeOpacity = 1
        }

        // Show city name
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.easeOut(duration: 0.4)) { showRoute = true }
        }

        // Cycle status messages
        Task { @MainActor in
            for i in 0..<statusMessages.count {
                guard !Task.isCancelled else { break }
                phase = i
                statusText = statusMessages[i]
                // Animate dots
                for dot in 1...3 {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    guard !Task.isCancelled else { return }
                    dotsCount = dot
                }
                dotsCount = 0
            }
            // Loop back
            if !Task.isCancelled {
                phase = statusMessages.count - 1
                statusText = "ALMOST THERE"
                // Keep pulsing dots
                while !Task.isCancelled {
                    for dot in 1...3 {
                        try? await Task.sleep(nanoseconds: 500_000_000)
                        guard !Task.isCancelled else { return }
                        dotsCount = dot
                    }
                    dotsCount = 0
                }
            }
        }

        // Scan line
        Task { @MainActor in
            while !Task.isCancelled {
                withAnimation(.easeInOut(duration: 1.5)) { scanLineY = 48 }
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                guard !Task.isCancelled else { return }
                scanLineY = 0
            }
        }

        // Plane loop
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            while !Task.isCancelled {
                planeOffset = -200
                planeOpacity = 0
                withAnimation(.easeInOut(duration: 2.5)) {
                    planeOffset = 200
                    planeOpacity = 1
                }
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }
}

private struct PulseModifier: ViewModifier {
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .opacity(isPulsing ? 0.3 : 1.0)
            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isPulsing)
            .onAppear { isPulsing = true }
    }
}

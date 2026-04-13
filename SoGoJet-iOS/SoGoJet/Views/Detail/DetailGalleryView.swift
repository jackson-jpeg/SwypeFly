import SwiftUI

// MARK: - Detail Gallery View
//
// Horizontal paged TabView with parallax back-layer (0.6× translate).
// Page indicator: tiny SplitFlapChar dots rendered as space vs bullet.
// Pinch-zoom raises a dismiss signal via onDismissRequest.

struct DetailGalleryView: View {
    let imageUrls: [URL]
    var initialPage: Int = 0
    var onDismissRequest: () -> Void = {}

    @State private var currentPage: Int
    @State private var scale: CGFloat = 1.0
    @State private var scaleAnchor: UnitPoint = .center
    @State private var lastScale: CGFloat = 1.0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(imageUrls: [URL], initialPage: Int = 0, onDismissRequest: @escaping () -> Void = {}) {
        self.imageUrls = imageUrls
        self.initialPage = initialPage
        self.onDismissRequest = onDismissRequest
        self._currentPage = State(initialValue: initialPage)
    }

    var body: some View {
        ZStack {
            Color.sgInk.ignoresSafeArea()

            TabView(selection: $currentPage) {
                ForEach(Array(imageUrls.enumerated()), id: \.offset) { index, url in
                    GeometryReader { geo in
                        ZStack {
                            // Parallax back layer: translates at 0.6× of page offset
                            let pageOffset = CGFloat(index - currentPage)
                            let parallaxOffset = reduceMotion ? 0 : pageOffset * geo.size.width * 0.40

                            CachedAsyncImage(url: url) {
                                Rectangle().fill(Color.sgSurface)
                            }
                            .frame(width: geo.size.width, height: geo.size.height)
                            .offset(x: parallaxOffset)
                            .scaleEffect(scale, anchor: scaleAnchor)
                            .clipped()
                        }
                    }
                    .tag(index)
                    .ignoresSafeArea()
                    .accessibilityLabel("Photo \(index + 1) of \(imageUrls.count) for \(String(describing: imageUrls[index].lastPathComponent))")
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            .gesture(
                MagnifyGesture()
                    .onChanged { value in
                        let delta = value.magnification / lastScale
                        lastScale = value.magnification
                        scale = min(max(scale * delta, 0.5), 4.0)
                        // If pinching down toward dismiss threshold
                        if scale < 0.7 {
                            let progress = (0.7 - scale) / 0.2
                            _ = progress // Used to drive opacity if needed
                        }
                    }
                    .onEnded { _ in
                        lastScale = 1.0
                        if scale < 0.75 {
                            // Dismiss on pinch-out
                            HapticEngine.light()
                            onDismissRequest()
                        } else {
                            withAnimation(SGSpring.silky.respectingReduceMotion()) {
                                scale = 1.0
                            }
                        }
                    }
            )

            // Page indicator — flap dots
            VStack {
                Spacer()
                pageIndicator
                    .padding(.bottom, 40)
            }

            // Dismiss button
            VStack {
                HStack {
                    Spacer()
                    Button(action: onDismissRequest) {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.sgWhite)
                            .frame(width: 32, height: 32)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .padding(.top, 56)
                    .padding(.trailing, 16)
                    .accessibilityLabel("Close photo gallery")
                }
                Spacer()
            }
        }
        .statusBarHidden(true)
    }

    // MARK: - Page Indicator
    // Small dots using filled/empty capsules as "flap" indicators
    private var pageIndicator: some View {
        HStack(spacing: 6) {
            ForEach(0..<imageUrls.count, id: \.self) { i in
                Capsule()
                    .fill(i == currentPage ? Color.sgYellow : Color.sgWhite.opacity(0.35))
                    .frame(width: i == currentPage ? 16 : 6, height: 6)
                    .animation(SGSpring.snappy.respectingReduceMotion(), value: currentPage)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(Color.sgBg.opacity(0.55).background(.ultraThinMaterial))
        .clipShape(Capsule())
        .accessibilityLabel("Photo \(currentPage + 1) of \(imageUrls.count)")
    }
}

#Preview("Gallery") {
    DetailGalleryView(
        imageUrls: [
            URL(string: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800")!,
            URL(string: "https://images.unsplash.com/photo-1504109586057-7a2ae83d1338?w=800")!,
        ]
    )
}

import SwiftUI

// MARK: - Vintage Terminal Kit
// Shared surfaces and controls used to push the app toward a more tactile,
// warm, heritage-travel aesthetic without breaking the existing theme tokens.

enum VintageTerminalTone {
    case amber
    case ivory
    case moss
    case ember
    case neutral

    var accent: Color {
        switch self {
        case .amber:
            return Color.sgYellow
        case .ivory:
            return Color.sgWhite
        case .moss:
            return Color.sgGreen
        case .ember:
            return Color.sgOrange
        case .neutral:
            return Color.sgWhiteDim
        }
    }

    var softFill: Color {
        switch self {
        case .amber:
            return Color.sgYellow.opacity(0.11)
        case .ivory:
            return Color.sgWhite.opacity(0.08)
        case .moss:
            return Color.sgGreen.opacity(0.12)
        case .ember:
            return Color.sgOrange.opacity(0.12)
        case .neutral:
            return Color.sgBorder
        }
    }

    var border: Color {
        switch self {
        case .amber:
            return Color.sgYellow.opacity(0.28)
        case .ivory:
            return Color.sgWhiteDim.opacity(0.28)
        case .moss:
            return Color.sgGreen.opacity(0.28)
        case .ember:
            return Color.sgOrange.opacity(0.28)
        case .neutral:
            return Color.sgBorder
        }
    }

    var text: Color {
        switch self {
        case .amber:
            return Color.sgYellow
        case .ivory:
            return Color.sgWhite
        case .moss:
            return Color.sgGreen
        case .ember:
            return Color.sgOrange
        case .neutral:
            return Color.sgWhiteDim
        }
    }
}

// MARK: - Backdrops

struct VintageTerminalBackdrop: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.sgBg,
                    Color.sgSurface,
                    Color.sgBg,
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [
                    Color.sgOrange.opacity(0.12),
                    Color.clear,
                ],
                center: .topLeading,
                startRadius: 40,
                endRadius: 520
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [
                    Color.sgYellow.opacity(0.08),
                    Color.clear,
                ],
                center: .bottomTrailing,
                startRadius: 20,
                endRadius: 420
            )
            .ignoresSafeArea()

            VintageTerminalGridOverlay()
                .ignoresSafeArea()

            VintageTerminalVerticalGlow()
                .ignoresSafeArea()

            VintageTerminalNoiseOverlay()
                .ignoresSafeArea()
                .allowsHitTesting(false)
        }
    }
}

struct VintageTerminalGridOverlay: View {
    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = proxy.size.height

            Path { path in
                stride(from: 0.0, through: width, by: 28).forEach { x in
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: height))
                }

                stride(from: 0.0, through: height, by: 28).forEach { y in
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: width, y: y))
                }
            }
            .stroke(Color.sgWhite.opacity(0.018), lineWidth: 0.5)
        }
    }
}

struct VintageTerminalVerticalGlow: View {
    var body: some View {
        HStack(spacing: 0) {
            LinearGradient(
                colors: [Color.clear, Color.sgYellow.opacity(0.035), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: 140)

            Spacer()

            LinearGradient(
                colors: [Color.clear, Color.sgOrange.opacity(0.03), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: 120)
        }
    }
}

struct VintageTerminalNoiseOverlay: View {
    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                let columns = Int(size.width / 18)
                let rows = Int(size.height / 18)

                for row in 0...rows {
                    for column in 0...columns {
                        let index = row * 73 + column * 19
                        let seed = Double((index % 17) + 3) / 20.0
                        let alpha = 0.01 + (seed * 0.01)
                        let x = CGFloat(column) * 18 + CGFloat((index % 7) - 3)
                        let y = CGFloat(row) * 18 + CGFloat((index % 5) - 2)
                        let rect = CGRect(x: x, y: y, width: 1.4, height: 1.4)
                        context.fill(
                            Path(ellipseIn: rect),
                            with: .color(Color.sgWhite.opacity(alpha))
                        )
                    }
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .blendMode(.screen)
    }
}

// MARK: - Layout Shell

struct VintageTerminalScreen<Header: View, Content: View>: View {
    let headerSpacing: CGFloat
    @ViewBuilder var header: () -> Header
    @ViewBuilder var content: () -> Content

    init(
        headerSpacing: CGFloat = Spacing.lg,
        @ViewBuilder header: @escaping () -> Header,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.headerSpacing = headerSpacing
        self.header = header
        self.content = content
    }

    var body: some View {
        ZStack {
            VintageTerminalBackdrop()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: headerSpacing) {
                    header()
                    content()
                }
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.lg)
                .padding(.bottom, Spacing.xl)
            }
        }
    }
}

// MARK: - Panels

struct VintageTerminalPanel<Content: View>: View {
    var title: String?
    var subtitle: String?
    var stamp: String?
    var tone: VintageTerminalTone = .neutral
    var inset: CGFloat = Spacing.md
    @ViewBuilder var content: () -> Content

    init(
        title: String? = nil,
        subtitle: String? = nil,
        stamp: String? = nil,
        tone: VintageTerminalTone = .neutral,
        inset: CGFloat = Spacing.md,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.stamp = stamp
        self.tone = tone
        self.inset = inset
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            if title != nil || subtitle != nil || stamp != nil {
                HStack(alignment: .top, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: 4) {
                        if let title {
                            Text(title)
                                .font(SGFont.sectionHead)
                                .foregroundStyle(Color.sgWhite)
                        }

                        if let subtitle {
                            Text(subtitle)
                                .font(SGFont.body(size: 12))
                                .foregroundStyle(Color.sgMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Spacer(minLength: 0)

                    if let stamp {
                        VintageTerminalStamp(
                            text: stamp,
                            tone: tone
                        )
                    }
                }
            }

            content()
        }
        .padding(inset)
        .background(VintageTerminalPanelBackground(tone: tone))
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(tone.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.22), radius: 18, y: 10)
    }
}

struct VintageTerminalPanelBackground: View {
    let tone: VintageTerminalTone

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.sgSurface,
                            Color.sgCell,
                            Color.sgBg,
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(
                    LinearGradient(
                        colors: [
                            tone.softFill,
                            Color.clear,
                            tone.softFill.opacity(0.45),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
    }
}

struct VintageTerminalInsetPanel<Content: View>: View {
    var tone: VintageTerminalTone = .neutral
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            content()
        }
        .padding(Spacing.sm + 2)
        .background(tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(tone.border, lineWidth: 1)
        )
    }
}

// MARK: - Typography

struct VintageTerminalHeroLockup: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    var accent: VintageTerminalTone = .amber

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(eyebrow.uppercased())
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(accent.text)
                .tracking(1.6)

            Text(title)
                .font(SGFont.display(size: 40))
                .foregroundStyle(Color.sgWhite)
                .tracking(1.8)

            Text(subtitle)
                .font(SGFont.accent(size: 18))
                .foregroundStyle(Color.sgWhiteDim)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct VintageTerminalSectionLabel: View {
    let text: String
    var tone: VintageTerminalTone = .amber

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Rectangle()
                .fill(tone.text)
                .frame(width: 16, height: 1.5)

            Text(text.uppercased())
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(tone.text)
                .tracking(1.5)
        }
    }
}

struct VintageTerminalCaptionBlock: View {
    let title: String
    let value: String
    var tone: VintageTerminalTone = .neutral
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 4) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 9))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.3)

            Text(value)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(tone.text)
                .lineLimit(2)
        }
    }
}

// MARK: - Stamps and Badges

struct VintageTerminalStamp: View {
    let text: String
    var tone: VintageTerminalTone = .amber

    var body: some View {
        Text(text.uppercased())
            .font(SGFont.bodyBold(size: 10))
            .foregroundStyle(tone.text)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: Radius.pill)
                    .fill(tone.softFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.pill)
                    .strokeBorder(tone.border, lineWidth: 1)
            )
            .tracking(1.1)
    }
}


struct VintageTerminalTagCloud: View {
    let tags: [String]
    var tone: VintageTerminalTone = .amber

    var body: some View {
        FlowLayout(spacing: Spacing.sm) {
            ForEach(tags, id: \.self) { tag in
                VintageTerminalStamp(text: tag, tone: tone)
            }
        }
    }
}

// MARK: - Metrics

struct VintageTerminalMetricTile: View {
    let title: String
    let value: String
    var footnote: String?
    var tone: VintageTerminalTone = .amber

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.3)

            Text(value)
                .font(SGFont.display(size: 28))
                .foregroundStyle(tone.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            if let footnote {
                Text(footnote)
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.sm + 2)
        .background(tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(tone.border, lineWidth: 1)
        )
    }
}

struct VintageTerminalMetricDeck: View {
    let metrics: [VintageTerminalMetric]

    var body: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: Spacing.sm),
                GridItem(.flexible(), spacing: Spacing.sm),
            ],
            spacing: Spacing.sm
        ) {
            ForEach(metrics) { metric in
                VintageTerminalMetricTile(
                    title: metric.title,
                    value: metric.value,
                    footnote: metric.footnote,
                    tone: metric.tone
                )
            }
        }
    }
}

struct VintageTerminalMetric: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let footnote: String?
    let tone: VintageTerminalTone
}

// MARK: - Buttons

struct VintageTerminalActionButton: View {
    let title: String
    var subtitle: String?
    var icon: String?
    var tone: VintageTerminalTone = .amber
    var fillsWidth = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(SGFont.bodyBold(size: 15))
                        .lineLimit(1)

                    if let subtitle {
                        Text(subtitle)
                            .font(SGFont.body(size: 11))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: fillsWidth ? 0 : nil)
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: fillsWidth ? .infinity : nil, alignment: .leading)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.md)
            .background(
                LinearGradient(
                    colors: [
                        tone.accent,
                        tone.accent.opacity(0.92),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: Radius.md)
            )
        }
        .buttonStyle(.plain)
    }
}

struct VintageTerminalSecondaryButton: View {
    let title: String
    var subtitle: String?
    var icon: String?
    var tone: VintageTerminalTone = .neutral
    var fillsWidth = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(SGFont.bodyBold(size: 14))
                    if let subtitle {
                        Text(subtitle)
                            .font(SGFont.body(size: 11))
                            .foregroundStyle(Color.sgMuted)
                    }
                }

                Spacer(minLength: fillsWidth ? 0 : nil)
            }
            .foregroundStyle(tone.text)
            .frame(maxWidth: fillsWidth ? .infinity : nil, alignment: .leading)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.md)
            .background(tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(tone.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct VintageTerminalSelectablePill: View {
    let title: String
    let isSelected: Bool
    var tone: VintageTerminalTone = .amber
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(isSelected ? Color.sgBg : tone.text)
                .padding(.horizontal, Spacing.sm + Spacing.xs)
                .padding(.vertical, Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: Radius.pill)
                        .fill(isSelected ? tone.accent : tone.softFill)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.pill)
                        .strokeBorder(isSelected ? tone.accent : tone.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

struct VintageTerminalSearchField: View {
    let prompt: String
    @Binding var text: String
    var icon: String = "magnifyingglass"
    var tone: VintageTerminalTone = .amber

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tone.text)

            TextField(
                "",
                text: $text,
                prompt: Text(prompt).foregroundStyle(Color.sgMuted)
            )
            .font(SGFont.bodyDefault)
            .foregroundStyle(Color.sgWhite)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .tint(tone.accent)

            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.sgFaint)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear text")
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + Spacing.xs)
        .background(tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(tone.border, lineWidth: 1)
        )
    }
}

// MARK: - Rows

struct VintageTerminalInfoRow: View {
    let icon: String
    let title: String
    let value: String
    var detail: String?
    var tone: VintageTerminalTone = .neutral

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(tone.softFill)
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(tone.text)
            }
            .frame(width: 34, height: 34)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgWhite)

                Text(value)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)

                if let detail {
                    Text(detail)
                        .font(SGFont.body(size: 11))
                        .foregroundStyle(Color.sgMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(Spacing.sm + 2)
        .background(tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(tone.border, lineWidth: 1)
        )
    }
}



struct VintageTerminalManifestRow: View {
    let prefix: String
    let title: String
    let value: String
    var subtitle: String?
    var tone: VintageTerminalTone = .neutral

    var body: some View {
        HStack(spacing: Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text(prefix.uppercased())
                    .font(SGFont.bodyBold(size: 9))
                    .foregroundStyle(tone.text)
                    .tracking(1.2)
                Text(title)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(1)
            }
            .frame(width: 90, alignment: .leading)

            Rectangle()
                .fill(Color.sgBorder)
                .frame(width: 1)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgWhiteDim)
                    .lineLimit(2)
                if let subtitle {
                    Text(subtitle)
                        .font(SGFont.body(size: 11))
                        .foregroundStyle(Color.sgMuted)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, Spacing.sm)
    }
}

// MARK: - Route and Travel Views

struct VintageTerminalRouteDisplay: View {
    let originCode: String
    let originLabel: String
    let destinationCode: String
    let destinationLabel: String
    var detail: String?
    var tone: VintageTerminalTone = .amber

    var body: some View {
        VStack(spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                routeNode(code: originCode, label: originLabel, alignment: .leading)

                VStack(spacing: 6) {
                    Image(systemName: "airplane")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(tone.text)

                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    tone.text.opacity(0.2),
                                    tone.text,
                                    tone.text.opacity(0.2),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(height: 1.5)
                }
                .frame(maxWidth: .infinity)

                routeNode(code: destinationCode, label: destinationLabel, alignment: .trailing)
            }

            if let detail {
                Text(detail)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
        }
    }

    private func routeNode(code: String, label: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(code)
                .font(SGFont.display(size: 30))
                .foregroundStyle(Color.sgWhite)
            Text(label)
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgWhiteDim)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}


struct VintageTerminalChecklistItem: View {
    let title: String
    let detail: String
    var tone: VintageTerminalTone = .amber

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Circle()
                .fill(tone.text)
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                Text(detail)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - Ticket Surfaces

struct VintageTravelTicket<Header: View, Content: View, Footer: View>: View {
    var tone: VintageTerminalTone = .amber
    @ViewBuilder var header: () -> Header
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    init(
        tone: VintageTerminalTone = .amber,
        @ViewBuilder header: @escaping () -> Header,
        @ViewBuilder content: @escaping () -> Content,
        @ViewBuilder footer: @escaping () -> Footer
    ) {
        self.tone = tone
        self.header = header
        self.content = content
        self.footer = footer
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                header()
                content()
            }
            .padding(Spacing.md)

            VintageTerminalPerforatedDivider(tone: tone)

            footer()
                .padding(Spacing.md)
        }
        .background(
            PerforatedTicketBackground(tone: tone)
        )
        .clipShape(PerforatedTicketShape())
        .overlay(
            PerforatedTicketShape()
                .stroke(tone.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.25), radius: 20, y: 10)
    }
}

struct VintageTerminalPerforatedDivider: View {
    var tone: VintageTerminalTone = .neutral

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Color.sgBg)
                .frame(width: 14, height: 14)
                .offset(x: -7)

            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [tone.border.opacity(0.35), tone.border, tone.border.opacity(0.35)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: 1)
                .overlay(alignment: .center) {
                    HStack(spacing: 4) {
                        ForEach(0..<22, id: \.self) { _ in
                            Circle()
                                .fill(Color.sgBg.opacity(0.85))
                                .frame(width: 2, height: 2)
                        }
                    }
                }

            Circle()
                .fill(Color.sgBg)
                .frame(width: 14, height: 14)
                .offset(x: 7)
        }
        .clipped()
        .padding(.horizontal, -Spacing.md)
    }
}

struct PerforatedTicketBackground: View {
    let tone: VintageTerminalTone

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.sgSurface,
                            Color.sgCell,
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(
                    LinearGradient(
                        colors: [
                            tone.softFill,
                            Color.clear,
                            tone.softFill.opacity(0.55),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
    }
}

struct PerforatedTicketShape: Shape {
    func path(in rect: CGRect) -> Path {
        let notchRadius: CGFloat = 12
        let cornerRadius = Radius.lg
        let notchCenterLeft = CGPoint(x: rect.minX, y: rect.midY)
        let notchCenterRight = CGPoint(x: rect.maxX, y: rect.midY)

        var path = Path()
        path.move(to: CGPoint(x: rect.minX + cornerRadius, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - cornerRadius, y: rect.minY))
        path.addArc(
            center: CGPoint(x: rect.maxX - cornerRadius, y: rect.minY + cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(-90),
            endAngle: .degrees(0),
            clockwise: false
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: notchCenterRight.y - notchRadius))
        path.addArc(
            center: notchCenterRight,
            radius: notchRadius,
            startAngle: .degrees(-90),
            endAngle: .degrees(90),
            clockwise: true
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - cornerRadius))
        path.addArc(
            center: CGPoint(x: rect.maxX - cornerRadius, y: rect.maxY - cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(0),
            endAngle: .degrees(90),
            clockwise: false
        )
        path.addLine(to: CGPoint(x: rect.minX + cornerRadius, y: rect.maxY))
        path.addArc(
            center: CGPoint(x: rect.minX + cornerRadius, y: rect.maxY - cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(90),
            endAngle: .degrees(180),
            clockwise: false
        )
        path.addLine(to: CGPoint(x: rect.minX, y: notchCenterLeft.y + notchRadius))
        path.addArc(
            center: notchCenterLeft,
            radius: notchRadius,
            startAngle: .degrees(90),
            endAngle: .degrees(-90),
            clockwise: true
        )
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + cornerRadius))
        path.addArc(
            center: CGPoint(x: rect.minX + cornerRadius, y: rect.minY + cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(180),
            endAngle: .degrees(270),
            clockwise: false
        )
        path.closeSubpath()
        return path
    }
}

// MARK: - Decorative Helpers

struct VintageTerminalRail: View {
    var tone: VintageTerminalTone = .amber

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Rectangle()
                .fill(tone.text)
                .frame(width: 26, height: 1.5)

            Rectangle()
                .fill(Color.sgBorder)
                .frame(maxWidth: .infinity, maxHeight: 1)

            Rectangle()
                .fill(tone.text.opacity(0.35))
                .frame(width: 18, height: 1.5)
        }
    }
}

struct VintageTerminalDividerLabel: View {
    let text: String
    var tone: VintageTerminalTone = .amber

    var body: some View {
        HStack(spacing: Spacing.sm) {
            VintageTerminalRail(tone: tone)
            Text(text.uppercased())
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(tone.text)
                .tracking(1.5)
            VintageTerminalRail(tone: tone)
        }
    }
}


struct VintageTerminalPassportStamp: View {
    let title: String
    let subtitle: String
    var tone: VintageTerminalTone = .ember

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(tone.text)
                .tracking(1.3)

            Text(subtitle)
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgWhiteDim)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.sm)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.sm)
                .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
                .foregroundStyle(tone.border)
        )
        .rotationEffect(.degrees(-2))
    }
}


struct VintageTerminalIconButton: View {
    let systemName: String
    var tone: VintageTerminalTone = .amber
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tone.text)
                .frame(width: 38, height: 38)
                .background(tone.softFill, in: Circle())
                .overlay(
                    Circle()
                        .strokeBorder(tone.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

struct VintageTerminalTopBar: View {
    let eyebrow: String
    let title: String
    var subtitle: String?
    var stamp: String?
    var tone: VintageTerminalTone = .amber
    var leadingIcon: String?
    var leadingAction: (() -> Void)?
    var trailingIcon: String?
    var trailingAction: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            if let leadingIcon, let leadingAction {
                VintageTerminalIconButton(systemName: leadingIcon, tone: tone, action: leadingAction)
            }

            VStack(alignment: .leading, spacing: 6) {
                VintageTerminalSectionLabel(text: eyebrow, tone: tone)

                Text(title)
                    .font(SGFont.display(size: 28))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                if let subtitle {
                    Text(subtitle)
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 0)

            if let stamp {
                VintageTerminalPassportStamp(title: "Status", subtitle: stamp, tone: tone)
            }

            if let trailingIcon, let trailingAction {
                VintageTerminalIconButton(systemName: trailingIcon, tone: tone, action: trailingAction)
            }
        }
    }
}

struct VintageTerminalProgressRail: View {
    let steps: [String]
    let currentIndex: Int
    var tone: VintageTerminalTone = .amber

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, _ in
                    Circle()
                        .fill(index <= currentIndex ? tone.accent : Color.sgBorder.opacity(0.45))
                        .frame(width: 12, height: 12)
                        .overlay(
                            Circle()
                                .strokeBorder(index <= currentIndex ? tone.text : Color.sgBorder, lineWidth: 1)
                        )

                    if index < steps.count - 1 {
                        Rectangle()
                            .fill(index < currentIndex ? tone.text : Color.sgBorder.opacity(0.45))
                            .frame(maxWidth: .infinity)
                            .frame(height: 1.5)
                            .padding(.horizontal, 6)
                    }
                }
            }

            HStack(alignment: .top, spacing: Spacing.xs) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    Text(step.uppercased())
                        .font(SGFont.bodyBold(size: 9))
                        .foregroundStyle(index <= currentIndex ? tone.text : Color.sgMuted)
                        .tracking(1.2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

// MARK: - Reusable Blocks

struct VintageTerminalManifestCard<Content: View>: View {
    let title: String
    var subtitle: String?
    var tone: VintageTerminalTone = .amber
    @ViewBuilder var content: () -> Content

    var body: some View {
        VintageTerminalPanel(
            title: title,
            subtitle: subtitle,
            stamp: "Manifest",
            tone: tone
        ) {
            VStack(spacing: 0) {
                content()
            }
        }
    }
}

struct VintageTerminalActionCluster<Primary: View, Secondary: View>: View {
    @ViewBuilder var primary: () -> Primary
    @ViewBuilder var secondary: () -> Secondary

    var body: some View {
        VStack(spacing: Spacing.sm) {
            primary()
            secondary()
        }
    }
}

struct VintageTerminalCollectionHeader: View {
    let title: String
    let subtitle: String
    var tone: VintageTerminalTone = .amber

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                VintageTerminalSectionLabel(text: title, tone: tone)
                Text(subtitle)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
    }
}

struct VintageTerminalBoardingSummary: View {
    let originCode: String
    let destinationCode: String
    let fare: String
    let detail: String
    var tone: VintageTerminalTone = .amber

    var body: some View {
        VintageTravelTicket(tone: tone) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    VintageTerminalSectionLabel(text: "Trip Summary", tone: tone)
                    Text("\(originCode) - \(destinationCode)")
                        .font(SGFont.display(size: 34))
                        .foregroundStyle(Color.sgWhite)
                        .tracking(1.4)
                }

                Spacer()

                Text(fare)
                    .font(SGFont.display(size: 34))
                    .foregroundStyle(tone.text)
            }
        } content: {
            Text(detail)
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgWhiteDim)
                .fixedSize(horizontal: false, vertical: true)
        } footer: {
            HStack {
                VintageTerminalCaptionBlock(
                    title: "Issued",
                    value: Date().formatted(date: .abbreviated, time: .omitted),
                    tone: tone
                )

                Spacer()

                VintageTerminalCaptionBlock(
                    title: "Status",
                    value: "Ready to board",
                    tone: .moss,
                    alignment: .trailing
                )
            }
        }
    }
}

// MARK: - Demo Previews

#Preview("Vintage Terminal Kit") {
    VintageTerminalScreen {
        VintageTerminalHeroLockup(
            eyebrow: "Travel Desk",
            title: "Vintage Journeys",
            subtitle: "Warm brass, split flaps, and prices worth chasing.",
            accent: .amber
        )
    } content: {
        VintageTerminalPanel(
            title: "Operations Brief",
            subtitle: "A warm-toned shell for the old-school terminal mood.",
            stamp: "Prototype",
            tone: .amber
        ) {
            VintageTerminalMetricDeck(metrics: [
                .init(title: "Routes", value: "128", footnote: "Scanned overnight", tone: .amber),
                .init(title: "Alerts", value: "24", footnote: "Watching fare dips", tone: .moss),
                .init(title: "Archives", value: "87%", footnote: "Price history intact", tone: .ivory),
                .init(title: "Mood", value: "Vintage", footnote: "Terminal-first presentation", tone: .ember),
            ])
        }

        VintageTerminalManifestCard(
            title: "Boarding Manifest",
            subtitle: "A list treatment for schedules, saved routes, or settings details.",
            tone: .ember
        ) {
            VintageTerminalManifestRow(
                prefix: "Gate",
                title: "A12",
                value: "Barcelona departure board",
                subtitle: "Amber panel language with mechanical split-flap cues.",
                tone: .amber
            )
            VintageTerminalManifestRow(
                prefix: "Desk",
                title: "Travel Desk",
                value: "Saved itineraries and notifications",
                subtitle: "Reusable rows for deeper settings wiring.",
                tone: .moss
            )
        }

        VintageTravelTicket(tone: .amber) {
            Text("SOGOJET BOARDING STUB")
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(Color.sgYellow)
        } content: {
            VintageTerminalRouteDisplay(
                originCode: "TPA",
                originLabel: "Tampa",
                destinationCode: "BCN",
                destinationLabel: "Barcelona",
                detail: "Roundtrip special with flexible monthly reseeding.",
                tone: .amber
            )
        } footer: {
            HStack {
                VintageTerminalStamp(text: "Issued", tone: .ivory)
                Spacer()
                VintageTerminalStamp(text: "$287", tone: .amber)
            }
        }
    }
}

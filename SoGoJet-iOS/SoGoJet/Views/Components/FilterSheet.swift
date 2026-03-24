import SwiftUI

// MARK: - Filter Sheet
// Bottom sheet with price range, vibe, and region filters. Multi-select with clear all.

struct FilterSheet: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(\.dismiss) private var dismiss

    @State private var selectedPrices: Set<String> = []
    @State private var selectedVibes: Set<String> = []
    @State private var selectedRegions: Set<String> = []

    private let priceRanges = ["Under $200", "$200-400", "$400-600", "$600+"]
    private let vibes = ["Beach", "City", "Adventure", "Culture", "Nightlife", "Nature", "Food"]
    private let regions = ["Europe", "Asia", "Caribbean", "South America", "Africa", "Middle East"]

    private var hasFilters: Bool {
        !selectedPrices.isEmpty || !selectedVibes.isEmpty || !selectedRegions.isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Price Range
                        filterSection(title: "Price Range", items: priceRanges, selection: $selectedPrices)

                        // Vibes
                        filterSection(title: "Vibes", items: vibes, selection: $selectedVibes)

                        // Regions
                        filterSection(title: "Region", items: regions, selection: $selectedRegions)

                        // Apply Button
                        applyButton
                            .padding(.top, Spacing.sm)
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.md)
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if hasFilters {
                        Button("Clear All") {
                            HapticEngine.light()
                            selectedPrices.removeAll()
                            selectedVibes.removeAll()
                            selectedRegions.removeAll()
                        }
                        .font(SGFont.body(size: 14))
                        .foregroundStyle(Color.sgRed)
                        .accessibilityLabel("Clear all filters")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(Color.sgMuted)
                    }
                    .accessibilityLabel("Close filters")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            // Sync current vibes from feed store
            selectedVibes = Set(feedStore.selectedVibes)
        }
    }

    // MARK: - Filter Section

    private func filterSection(title: String, items: [String], selection: Binding<Set<String>>) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(SGFont.sectionHead)
                .foregroundStyle(Color.sgWhite)
                .accessibilityAddTraits(.isHeader)

            FlowLayout(spacing: Spacing.sm) {
                ForEach(items, id: \.self) { item in
                    filterChip(item, isSelected: selection.wrappedValue.contains(item)) {
                        HapticEngine.selection()
                        if selection.wrappedValue.contains(item) {
                            selection.wrappedValue.remove(item)
                        } else {
                            selection.wrappedValue.insert(item)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Filter Chip

    private func filterChip(_ text: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(isSelected ? Color.sgBg : Color.sgWhiteDim)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(
                    isSelected
                        ? AnyShapeStyle(Color.sgYellow)
                        : AnyShapeStyle(Color.sgCell)
                )
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .strokeBorder(
                            isSelected ? Color.sgYellow : Color.sgBorder,
                            lineWidth: 1
                        )
                )
        }
        .accessibilityLabel("\(text), \(isSelected ? "selected" : "not selected")")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - Apply Button

    private var applyButton: some View {
        Button {
            HapticEngine.medium()
            applyFilters()
            dismiss()
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "line.3.horizontal.decrease")
                    .font(.system(size: 14, weight: .semibold))
                Text(hasFilters ? "Apply Filters" : "Show All Deals")
                    .font(SGFont.bodyBold(size: 16))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
        }
        .accessibilityLabel(hasFilters ? "Apply selected filters" : "Show all deals without filters")
    }

    // MARK: - Apply Logic

    private func applyFilters() {
        // Sync vibes back to feed store and refresh
        Task {
            feedStore.selectedVibes = Array(selectedVibes)
            await feedStore.fetchDeals()
        }
    }
}

// MARK: - Flow Layout
// Simple wrapping layout for filter chips.

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrangeSubviews(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrangeSubviews(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() where index < subviews.count {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private struct ArrangeResult {
        var size: CGSize
        var positions: [CGPoint]
    }

    private func arrangeSubviews(proposal: ProposedViewSize, subviews: Subviews) -> ArrangeResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxX = max(maxX, x)
        }

        return ArrangeResult(
            size: CGSize(width: maxX, height: y + rowHeight),
            positions: positions
        )
    }
}

// MARK: - Preview

#Preview("Filter Sheet") {
    Color.sgBg.ignoresSafeArea()
        .sheet(isPresented: .constant(true)) {
            FilterSheet()
                .environment(FeedStore())
        }
}

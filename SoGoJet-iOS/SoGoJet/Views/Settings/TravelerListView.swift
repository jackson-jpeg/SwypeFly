import SwiftUI

// MARK: - Traveler List View
// Phase 6: swipe-to-reveal edit/delete actions per traveler row.
// Edit opens TravelerEditView in an SGSheet(.large).

struct TravelerListView: View {
    @Environment(TravelerStore.self) private var travelerStore
    @Environment(\.dismiss) private var dismiss

    @State private var showAddSheet = false
    @State private var editingTraveler: SavedTraveler?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        if travelerStore.isLoading && travelerStore.travelers.isEmpty {
                            loadingState
                        } else if travelerStore.travelers.isEmpty {
                            emptyState
                        } else {
                            travelerSection
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.lg)
                }
            }
            .navigationTitle("Saved Travelers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.sgYellow)
                        .accessibilityLabel("Done")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        HapticEngine.selection()
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Color.sgYellow)
                    }
                    .accessibilityLabel("Add traveler")
                }
            }
            .toolbarBackground(Color.sgSurface, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .task {
            await travelerStore.fetchTravelers()
        }
        .sheet(isPresented: $showAddSheet) {
            TravelerEditView(traveler: nil)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $editingTraveler) { traveler in
            TravelerEditView(traveler: traveler)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Traveler Section

    private var travelerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("TRAVELERS")
                .font(SGFont.accent(size: 14))
                .foregroundStyle(Color.sgMuted)
                .padding(.leading, Spacing.xs)

            SGCard(elevation: .flush, padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(travelerStore.travelers.enumerated()), id: \.element.id) { index, traveler in
                        SwipeableTravelerRow(
                            traveler: traveler,
                            onEdit: { editingTraveler = traveler },
                            onDelete: {
                                Task {
                                    HapticEngine.warning()
                                    _ = await travelerStore.deleteTraveler(id: traveler.id)
                                }
                            }
                        )
                        if index < travelerStore.travelers.count - 1 {
                            Divider()
                                .overlay(Color.sgHairline)
                                .padding(.horizontal, Spacing.md)
                        }
                    }
                }
            }
        }
    }

    // MARK: - States

    private var loadingState: some View {
        VStack {
            Spacer(minLength: 80)
            ProgressView()
                .tint(Color.sgYellow)
            Text("Loading travelers...")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .padding(.top, Spacing.sm)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            Spacer(minLength: 60)
            Image(systemName: "person.2.circle")
                .font(.system(size: 48))
                .foregroundStyle(Color.sgMuted.opacity(0.5))
            Text("No Saved Travelers")
                .font(SGFont.bodyBold(size: 18))
                .foregroundStyle(Color.sgWhite)
            Text("Save traveler details to speed up future bookings.")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
            SGButton("Add Traveler", style: .primary) {
                showAddSheet = true
            }
            .padding(.horizontal, Spacing.xl)
            .accessibilityLabel("Add traveler")
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Swipeable Traveler Row

private struct SwipeableTravelerRow: View {
    let traveler: SavedTraveler
    let onEdit: () -> Void
    let onDelete: () -> Void

    @State private var offset: CGFloat = 0
    @State private var showActions = false

    private let actionWidth: CGFloat = 140   // edit + delete combined
    private let threshold: CGFloat = 70

    var body: some View {
        ZStack(alignment: .trailing) {
            // Revealed action buttons
            if showActions {
                HStack(spacing: 0) {
                    // Edit
                    Button {
                        resetSwipe()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            onEdit()
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: "pencil")
                                .font(.system(size: 16, weight: .semibold))
                            Text("Edit")
                                .font(SGFont.body(size: 11))
                        }
                        .foregroundStyle(Color.sgWhite)
                        .frame(width: 70)
                        .frame(maxHeight: .infinity)
                        .background(Color.sgYellow.opacity(0.3))
                    }
                    .accessibilityLabel("Edit \(traveler.fullName)")

                    // Delete
                    Button(role: .destructive) {
                        resetSwipe()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            HapticEngine.warning()
                            onDelete()
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: "trash")
                                .font(.system(size: 16, weight: .semibold))
                            Text("Remove")
                                .font(SGFont.body(size: 11))
                        }
                        .foregroundStyle(Color.sgWhite)
                        .frame(width: 70)
                        .frame(maxHeight: .infinity)
                        .background(Color.sgRed)
                    }
                    .accessibilityLabel("Remove \(traveler.fullName)")
                }
                .frame(width: actionWidth)
            }

            // Row content
            travelerRowContent
                .offset(x: offset)
                .gesture(
                    DragGesture(minimumDistance: 10)
                        .onChanged { value in
                            guard value.translation.width < 0 || showActions else { return }
                            let drag = value.translation.width
                            offset = showActions
                                ? max(drag - actionWidth, -actionWidth)
                                : max(drag, -actionWidth - 10)
                            if drag < -threshold / 2 && !showActions {
                                HapticEngine.warning()
                            }
                        }
                        .onEnded { value in
                            withAnimation(SGSpring.snappy) {
                                if value.translation.width < -threshold {
                                    offset = -actionWidth
                                    showActions = true
                                } else {
                                    offset = 0
                                    showActions = false
                                }
                            }
                        }
                )
        }
        .clipped()
    }

    private var travelerRowContent: some View {
        HStack(spacing: Spacing.sm) {
            // Avatar circle
            ZStack {
                Circle()
                    .fill(traveler.isPrimary ? Color.sgYellow.opacity(0.15) : Color.sgSurface)
                    .frame(width: 40, height: 40)
                Image(systemName: traveler.isPrimary ? "star.circle.fill" : "person.circle")
                    .font(.system(size: 22))
                    .foregroundStyle(traveler.isPrimary ? Color.sgYellow : Color.sgMuted)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(traveler.fullName)
                        .font(SGFont.bodyBold(size: 15))
                        .foregroundStyle(Color.sgWhite)
                        .lineLimit(1)
                    if traveler.isPrimary {
                        Text("PRIMARY")
                            .sgFont(.micro)
                            .foregroundStyle(Color.sgYellow)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.sgYellow.opacity(0.15), in: Capsule())
                    }
                }
                if let email = traveler.email, !email.isEmpty {
                    Text(email)
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                        .lineLimit(1)
                }

                // Info chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        if let passport = traveler.maskedPassport {
                            infoChip(icon: "doc.text", text: passport)
                        }
                        if let dob = traveler.bornOn, !dob.isEmpty {
                            infoChip(icon: "calendar", text: dob)
                        }
                        infoChip(icon: "flag", text: traveler.nationality)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.left")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.sgFaint)
                .opacity(showActions ? 0 : 1)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + 2)
        .background(Color.sgSurfaceElevated)
        .contentShape(Rectangle())
        .onTapGesture {
            if showActions {
                resetSwipe()
            } else {
                onEdit()
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(traveler.fullName)\(traveler.isPrimary ? ", primary traveler" : ""), \(traveler.nationality)")
        .accessibilityHint("Swipe left for edit and delete options, tap to edit")
    }

    private func infoChip(icon: String, text: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 9))
            Text(text)
                .font(SGFont.body(size: 10))
        }
        .foregroundStyle(Color.sgMuted)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(Color.sgBorder, in: Capsule())
    }

    private func resetSwipe() {
        withAnimation(SGSpring.snappy) {
            offset = 0
            showActions = false
        }
    }
}

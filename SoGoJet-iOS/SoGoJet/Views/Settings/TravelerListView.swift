import SwiftUI

// MARK: - Traveler List View
// Displays saved travelers with add/edit/delete capabilities.

struct TravelerListView: View {
    @Environment(TravelerStore.self) private var travelerStore
    @Environment(\.dismiss) private var dismiss

    @State private var showAddSheet = false
    @State private var editingTraveler: SavedTraveler?

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    if travelerStore.isLoading && travelerStore.travelers.isEmpty {
                        loadingState
                    } else if travelerStore.travelers.isEmpty {
                        emptyState
                    } else {
                        travelerCards
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.sgBg)
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
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Color.sgYellow)
                    }
                    .accessibilityLabel("Add traveler")
                }
            }
        }
        .task {
            await travelerStore.fetchTravelers()
        }
        .sheet(isPresented: $showAddSheet) {
            TravelerEditView(traveler: nil)
        }
        .sheet(item: $editingTraveler) { traveler in
            TravelerEditView(traveler: traveler)
        }
    }

    // MARK: - Traveler Cards

    private var travelerCards: some View {
        ForEach(travelerStore.travelers) { traveler in
            TravelerCard(
                traveler: traveler,
                onEdit: { editingTraveler = traveler },
                onDelete: {
                    Task {
                        HapticEngine.medium()
                        _ = await travelerStore.deleteTraveler(id: traveler.id)
                    }
                }
            )
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
            Button {
                showAddSheet = true
            } label: {
                Text("Add Traveler")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add traveler")
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Traveler Card

private struct TravelerCard: View {
    let traveler: SavedTraveler
    let onEdit: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirmation = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Image(systemName: traveler.isPrimary ? "star.circle.fill" : "person.circle")
                    .font(.system(size: 20))
                    .foregroundStyle(traveler.isPrimary ? Color.sgYellow : Color.sgMuted)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(traveler.fullName)
                            .font(SGFont.bodyBold(size: 15))
                            .foregroundStyle(Color.sgWhite)
                        if traveler.isPrimary {
                            Text("PRIMARY")
                                .font(SGFont.bodyBold(size: 9))
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
                    }
                }

                Spacer()

                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.sgYellow)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit \(traveler.fullName)")
            }

            // Info chips
            HStack(spacing: 8) {
                if let passport = traveler.maskedPassport {
                    infoChip(icon: "doc.text", text: passport)
                }
                if let dob = traveler.bornOn, !dob.isEmpty {
                    infoChip(icon: "calendar", text: dob)
                }
                infoChip(icon: "flag", text: traveler.nationality)
            }

            // Delete button
            HStack {
                Spacer()
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Text("Remove")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgRed.opacity(0.8))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(traveler.fullName)")
            }
        }
        .padding(Spacing.md)
        .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
        .alert("Remove Traveler?", isPresented: $showDeleteConfirmation) {
            Button("Remove", role: .destructive, action: onDelete)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Remove \(traveler.fullName) from saved travelers?")
        }
    }

    private func infoChip(icon: String, text: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 9))
            Text(text)
                .font(SGFont.body(size: 11))
        }
        .foregroundStyle(Color.sgMuted)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.sgBorder, in: Capsule())
    }
}

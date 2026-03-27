#!/bin/bash
# ============================================================
# SoGoJet Widget Setup Script
#
# Run this ONCE to add the widget extension target to Xcode.
# After running, open the project in Xcode and build.
#
# Usage: cd SoGoJet-iOS && bash scripts/setup-widget.sh
# ============================================================

set -e

echo "🔧 Setting up SoGoJet Widget Extension..."
echo ""

# Check we're in the right directory
if [ ! -d "SoGoJet.xcodeproj" ]; then
    echo "❌ Run this from the SoGoJet-iOS directory"
    exit 1
fi

# Check widget files exist
if [ ! -f "SoGoJetWidget/SoGoJetWidgetBundle.swift" ]; then
    echo "❌ Widget source files not found in SoGoJetWidget/"
    exit 1
fi

echo "✅ Widget source files found"
echo ""

# Use Ruby to modify the pbxproj (Xcode uses Ruby internally)
ruby << 'RUBY'
require 'xcodeproj'

project_path = 'SoGoJet.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Check if widget target already exists
if project.targets.any? { |t| t.name == 'SoGoJetWidgetExtension' }
  puts "⚠️  Widget target already exists — skipping"
  exit 0
end

# Create the widget extension target
widget_target = project.new_target(
  :app_extension,
  'SoGoJetWidgetExtension',
  :ios,
  '17.0'
)

# Set bundle identifier
widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.sogojet.SoGoJet.Widget'
  config.build_settings['SWIFT_VERSION'] = '5.9'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'SoGoJetWidget/SoGoJetWidget.entitlements'
  config.build_settings['INFOPLIST_FILE'] = 'SoGoJetWidget/Info.plist'
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
  config.build_settings['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  config.build_settings['DEAD_CODE_STRIPPING'] = 'YES'
  config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'YES'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = [
    '$(inherited)',
    '@executable_path/Frameworks',
    '@executable_path/../../Frameworks'
  ]
end

# Add widget source files
widget_group = project.main_group.new_group('SoGoJetWidget', 'SoGoJetWidget')

widget_files = [
  'SoGoJetWidgetBundle.swift',
  'SoGoJetWidget.swift',
  'FlightEntry.swift',
  'WidgetViews.swift',
  'WidgetAPIClient.swift',
  'SharedDefaults.swift',
  'FlightSearchLiveActivity.swift',
]

widget_files.each do |filename|
  path = "SoGoJetWidget/#{filename}"
  if File.exist?(path)
    file_ref = widget_group.new_file(path)
    widget_target.source_build_phase.add_file_reference(file_ref)
  else
    puts "⚠️  Missing: #{path}"
  end
end

# Add shared FlightSearchAttributes model (used by the Live Activity)
shared_model = 'SoGoJet/Models/FlightSearchActivity.swift'
if File.exist?(shared_model)
  shared_ref = project.main_group.find_file_by_path(shared_model)
  if shared_ref
    widget_target.source_build_phase.add_file_reference(shared_ref)
    puts "✅ Added shared FlightSearchActivity.swift to widget target"
  else
    shared_ref = project.main_group.new_file(shared_model)
    widget_target.source_build_phase.add_file_reference(shared_ref)
    puts "✅ Added shared FlightSearchActivity.swift to widget target (new ref)"
  end
end

# Add Info.plist
info_ref = widget_group.new_file('SoGoJetWidget/Info.plist')

# Add entitlements
ent_ref = widget_group.new_file('SoGoJetWidget/SoGoJetWidget.entitlements')

# Link WidgetKit and SwiftUI frameworks
widget_target.frameworks_build_phase
['WidgetKit', 'SwiftUI'].each do |fw_name|
  fw = project.frameworks_group.new_file("System/Library/Frameworks/#{fw_name}.framework", :sdk_root)
  widget_target.frameworks_build_phase.add_file_reference(fw)
end

# Add widget extension to the main app's embed phase
main_target = project.targets.find { |t| t.name == 'SoGoJet' }
if main_target
  # Create embed app extensions build phase
  embed_phase = main_target.new_copy_files_build_phase('Embed App Extensions')
  embed_phase.dst_subfolder_spec = '13' # PlugIns
  embed_phase.add_file_reference(widget_target.product_reference)

  # Add dependency
  main_target.add_dependency(widget_target)

  # Add App Group entitlements to main target
  main_target.build_configurations.each do |config|
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'SoGoJet/SoGoJet.entitlements'
  end
end

project.save

puts "✅ Widget target 'SoGoJetWidgetExtension' added to project"
puts "✅ Linked WidgetKit and SwiftUI frameworks"
puts "✅ Embedded in main app target"
puts "✅ App Group entitlements configured"
RUBY

echo ""
echo "🎉 Widget setup complete!"
echo ""
echo "Next steps:"
echo "  1. Open SoGoJet.xcodeproj in Xcode"
echo "  2. Select SoGoJetWidgetExtension target → Signing & Capabilities"
echo "  3. Set your Team for code signing"
echo "  4. Build & Run the main SoGoJet scheme"
echo "  5. Long-press your home screen → Add Widget → SoGoJet"
echo ""

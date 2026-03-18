#!/bin/bash
# Refresh images for all rejected destinations
CITIES=(
  "Anguilla"
  "Cayman Brac"
  "Charleston"
  "Clearwater"
  "Colombo"
  "Denver"
  "Dominica"
  "Grand Cayman"
  "Ljubljana"
  "Lombok"
  "London"
  "Maldives"
  "Montserrat"
  "Seoul"
  "Turks & Caicos"
  "Warsaw"
)

for city in "${CITIES[@]}"; do
  echo "=== Refreshing: $city ==="
  npx tsx scripts/refresh-images-google.ts --only="$city"
  echo ""
  sleep 2
done

echo "Done! All 16 destinations refreshed."

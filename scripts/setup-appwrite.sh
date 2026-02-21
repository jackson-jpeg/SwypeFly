#!/bin/bash
# Sets up Appwrite database, collections, and attributes for SoGoJet
set -euo pipefail

ENDPOINT="https://nyc.cloud.appwrite.io/v1"
PROJECT="6999fc4200302e0ff341"
KEY="standard_3d8e9a1a283a8f881d9a711f90a88cf0f37690c09d697df851cbf894984e382af3f5334f118b574a1eebc5bb1b2862c16441db0110177215ef547c03de9689ad86b39be3e12c61364fe66864c419388daaa586be6ec1e48ab61762d36e458bee6c781962642b4b1f81f1de3af8e1175b58edae37e948a1ba1a6ce2b4e5cb3fb6"
DB="sogojet"

api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -X "$method" "${ENDPOINT}${path}" \
    -H "X-Appwrite-Project: ${PROJECT}" \
    -H "X-Appwrite-Key: ${KEY}" \
    -H "Content-Type: application/json")
  if [ -n "$body" ]; then
    args+=(-d "$body")
  fi
  local resp
  resp=$(curl "${args[@]}" 2>/dev/null)
  local code
  code=$(echo "$resp" | grep -o '"code":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
  if [ "$code" = "409" ]; then
    echo "  (already exists)"
    return 0
  fi
  if echo "$resp" | grep -q '"message"' && [ "$code" != "0" ] && [ "$code" != "" ] && [ "$code" -ge 400 ] 2>/dev/null; then
    echo "ERROR: $resp"
    return 1
  fi
  echo "$resp"
  return 0
}

str_attr() {
  local coll="$1" key="$2" size="${3:-255}" required="${4:-false}" array="${5:-false}"
  echo -n "  attr: $key..."
  api POST "/databases/${DB}/collections/${coll}/attributes/string" \
    "{\"key\":\"$key\",\"size\":$size,\"required\":$required,\"array\":$array}" > /dev/null
  echo " ✓"
}

float_attr() {
  local coll="$1" key="$2" required="${3:-false}"
  echo -n "  attr: $key..."
  api POST "/databases/${DB}/collections/${coll}/attributes/float" \
    "{\"key\":\"$key\",\"required\":$required,\"min\":-999999999,\"max\":999999999}" > /dev/null
  echo " ✓"
}

int_attr() {
  local coll="$1" key="$2" required="${3:-false}"
  echo -n "  attr: $key..."
  api POST "/databases/${DB}/collections/${coll}/attributes/integer" \
    "{\"key\":\"$key\",\"required\":$required,\"min\":-2147483647,\"max\":2147483647}" > /dev/null
  echo " ✓"
}

bool_attr() {
  local coll="$1" key="$2" default_val="${3:-null}"
  echo -n "  attr: $key..."
  api POST "/databases/${DB}/collections/${coll}/attributes/boolean" \
    "{\"key\":\"$key\",\"required\":false,\"default\":$default_val}" > /dev/null
  echo " ✓"
}

create_index() {
  local coll="$1" key="$2" type="$3" attrs="$4"
  echo -n "  index: $key..."
  api POST "/databases/${DB}/collections/${coll}/indexes" \
    "{\"key\":\"$key\",\"type\":\"$type\",\"attributes\":$attrs,\"orders\":[\"ASC\"]}" > /dev/null
  echo " ✓"
}

echo "=== SoGoJet Appwrite Setup ==="
echo

# 1. Create database
echo "Creating database..."
api POST "/databases" "{\"databaseId\":\"$DB\",\"name\":\"SoGoJet\"}" > /dev/null
echo "  ✓ Database created"

# 2. Destinations collection
echo "Creating destinations collection..."
api POST "/databases/${DB}/collections" \
  "{\"collectionId\":\"destinations\",\"name\":\"Destinations\",\"permissions\":[\"read(\\\"any\\\")\"],\"documentSecurity\":false}" > /dev/null
echo "  ✓ Collection created"

str_attr destinations iata_code 10 true
str_attr destinations city 100 true
str_attr destinations country 100 true
str_attr destinations continent 50
str_attr destinations tagline 500
str_attr destinations description 2000
str_attr destinations image_url 500
str_attr destinations image_urls 500 false true
float_attr destinations flight_price true
float_attr destinations hotel_price_per_night
str_attr destinations currency 10
str_attr destinations vibe_tags 50 false true
float_attr destinations rating
int_attr destinations review_count
str_attr destinations best_months 10 false true
int_attr destinations average_temp
str_attr destinations flight_duration 20
str_attr destinations available_flight_days 10 false true
bool_attr destinations is_active true
float_attr destinations beach_score
float_attr destinations city_score
float_attr destinations adventure_score
float_attr destinations culture_score
float_attr destinations nightlife_score
float_attr destinations nature_score
float_attr destinations food_score
float_attr destinations popularity_score
str_attr destinations itinerary_json 5000
str_attr destinations restaurants_json 5000

# 3. Saved trips collection
echo "Creating saved_trips collection..."
api POST "/databases/${DB}/collections" \
  "{\"collectionId\":\"saved_trips\",\"name\":\"Saved Trips\",\"permissions\":[\"create(\\\"users\\\")\",\"read(\\\"users\\\")\",\"delete(\\\"users\\\")\"],\"documentSecurity\":true}" > /dev/null
echo "  ✓ Collection created"

str_attr saved_trips user_id 100 true
str_attr saved_trips destination_id 100 true
str_attr saved_trips saved_at 30

# 4. User preferences collection
echo "Creating user_preferences collection..."
api POST "/databases/${DB}/collections" \
  "{\"collectionId\":\"user_preferences\",\"name\":\"User Preferences\",\"permissions\":[\"create(\\\"users\\\")\",\"read(\\\"users\\\")\",\"update(\\\"users\\\")\"],\"documentSecurity\":true}" > /dev/null
echo "  ✓ Collection created"

str_attr user_preferences user_id 100 true
str_attr user_preferences traveler_type 20
str_attr user_preferences budget_level 20
float_attr user_preferences budget_numeric
str_attr user_preferences departure_city 50
str_attr user_preferences departure_code 10
str_attr user_preferences currency 10
float_attr user_preferences pref_beach
float_attr user_preferences pref_city
float_attr user_preferences pref_adventure
float_attr user_preferences pref_culture
float_attr user_preferences pref_nightlife
float_attr user_preferences pref_nature
float_attr user_preferences pref_food
bool_attr user_preferences has_completed_onboarding false

# 5. Swipe history collection
echo "Creating swipe_history collection..."
api POST "/databases/${DB}/collections" \
  "{\"collectionId\":\"swipe_history\",\"name\":\"Swipe History\",\"permissions\":[\"create(\\\"users\\\")\",\"read(\\\"users\\\")\"],\"documentSecurity\":true}" > /dev/null
echo "  ✓ Collection created"

str_attr swipe_history user_id 100 true
str_attr swipe_history destination_id 100 true
str_attr swipe_history action 20 true
int_attr swipe_history time_spent_ms
float_attr swipe_history price_shown

# 6. Cached prices collection
echo "Creating cached_prices collection..."
api POST "/databases/${DB}/collections" \
  "{\"collectionId\":\"cached_prices\",\"name\":\"Cached Prices\",\"permissions\":[\"read(\\\"any\\\")\"],\"documentSecurity\":false}" > /dev/null
echo "  ✓ Collection created"

str_attr cached_prices origin 10 true
str_attr cached_prices destination_iata 10 true
float_attr cached_prices price true
str_attr cached_prices currency 10
str_attr cached_prices airline 100
str_attr cached_prices duration 20
str_attr cached_prices source 50
str_attr cached_prices departure_date 20
str_attr cached_prices return_date 20
int_attr cached_prices trip_duration_days
float_attr cached_prices previous_price
str_attr cached_prices price_direction 10
str_attr cached_prices fetched_at 30

# Wait for attributes to propagate
echo
echo "Waiting 5s for attributes to propagate..."
sleep 5

# Indexes
echo "Creating indexes..."
create_index destinations idx_active key '["is_active"]'
create_index destinations idx_iata key '["iata_code"]'
create_index saved_trips idx_user key '["user_id"]'
create_index swipe_history idx_swipe_user key '["user_id"]'
create_index cached_prices idx_price_origin key '["origin"]'
create_index user_preferences idx_pref_user unique '["user_id"]'

echo
echo "✓ Setup complete!"

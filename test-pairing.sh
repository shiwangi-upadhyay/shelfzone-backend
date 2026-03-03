#!/bin/bash

# Test pairing flow

echo "🧪 Testing Agent Bridge Pairing Flow"
echo "===================================="
echo

# Step 1: Login to get access token
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shelfzone.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Logged in successfully"
echo

# Step 2: Generate pairing token
echo "🔑 Step 2: Generating pairing token..."
PAIRING_RESPONSE=$(curl -s -X POST http://localhost:3001/api/bridge/nodes/generate-token \
  -H "Authorization: Bearer $TOKEN")

PAIRING_TOKEN=$(echo $PAIRING_RESPONSE | jq -r '.data.token')
EXPIRES_AT=$(echo $PAIRING_RESPONSE | jq -r '.data.expiresAt')
INSTRUCTIONS=$(echo $PAIRING_RESPONSE | jq -r '.data.instructions')

if [ "$PAIRING_TOKEN" = "null" ] || [ -z "$PAIRING_TOKEN" ]; then
  echo "❌ Failed to generate pairing token"
  echo "Response: $PAIRING_RESPONSE"
  exit 1
fi

echo "✅ Pairing token generated:"
echo "   Token: $PAIRING_TOKEN"
echo "   Expires: $EXPIRES_AT"
echo
echo "$INSTRUCTIONS"
echo

# Step 3: Save token for WebSocket test
echo $PAIRING_TOKEN > /tmp/pairing-token.txt
echo "✅ Token saved to /tmp/pairing-token.txt"
echo

# Step 4: List nodes (should be empty initially)
echo "📋 Step 3: Listing nodes..."
NODES_RESPONSE=$(curl -s -X GET http://localhost:3001/api/bridge/nodes \
  -H "Authorization: Bearer $TOKEN")

echo "Nodes: $NODES_RESPONSE"
echo

echo "✅ Pairing token ready! Use it with the WebSocket test client."

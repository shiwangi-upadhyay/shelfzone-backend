#!/bin/bash
# Test script for Command Center Streaming API (Phase 1 Step 3)
# Usage: ./test-command-center-streaming.sh <EMAIL> <PASSWORD>

set -e

if [ $# -lt 2 ]; then
  echo "Usage: $0 <EMAIL> <PASSWORD>"
  echo "Example: $0 admin@shelfzone.com mypassword"
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"
BASE_URL="http://localhost:3001"

echo "========================================"
echo "Command Center Streaming API Test"
echo "========================================"
echo ""

# Step 1: Login
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:30}..."
echo ""

# Step 2: Get agents
echo "📋 Step 2: Fetching agents..."
AGENTS=$(curl -s -X GET "$BASE_URL/api/agents" \
  -H "Authorization: Bearer $TOKEN")

AGENT_ID=$(echo "$AGENTS" | jq -r '.agents[0].id')
AGENT_NAME=$(echo "$AGENTS" | jq -r '.agents[0].name')

if [ "$AGENT_ID" == "null" ] || [ -z "$AGENT_ID" ]; then
  echo "❌ No agents found!"
  echo "Response: $AGENTS"
  exit 1
fi

echo "✅ Found agent: $AGENT_NAME"
echo "Agent ID: $AGENT_ID"
echo ""

# Step 3: Check API key status
echo "🔑 Step 3: Checking Anthropic API key..."
API_KEY_STATUS=$(curl -s -X GET "$BASE_URL/api/user-api-keys/status" \
  -H "Authorization: Bearer $TOKEN")

HAS_KEY=$(echo "$API_KEY_STATUS" | jq -r '.hasKey')

if [ "$HAS_KEY" != "true" ]; then
  echo "⚠️  No Anthropic API key configured!"
  echo "Please set your API key first:"
  echo ""
  echo "curl -X POST $BASE_URL/api/user-api-keys \\
  -H \"Authorization: Bearer $TOKEN\" \\
  -H \"Content-Type: application/json\" \\
  -d '{\"apiKey\": \"sk-ant-...\"}'"
  echo ""
  exit 1
fi

echo "✅ API key configured"
KEY_PREFIX=$(echo "$API_KEY_STATUS" | jq -r '.keyPrefix')
echo "Key prefix: $KEY_PREFIX"
echo ""

# Step 4: Send streaming message
echo "💬 Step 4: Sending streaming message..."
echo "Message: 'Hello! Count to 5 for me.'"
echo ""
echo "--- STREAMING RESPONSE ---"
echo ""

curl -N -X POST "$BASE_URL/api/command-center/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT_ID\",
    \"conversationId\": null,
    \"message\": \"Hello! Count to 5 for me.\"
  }"

echo ""
echo ""
echo "--- END STREAMING RESPONSE ---"
echo ""
echo "✅ Test complete!"
echo ""
echo "📊 Verify in database:"
echo "SELECT id, instruction, status, \"totalCost\", \"totalTokens\""
echo "FROM task_trace"
echo "ORDER BY \"createdAt\" DESC LIMIT 1;"

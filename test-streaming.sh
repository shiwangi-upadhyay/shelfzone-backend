#!/bin/bash
# Test script for Command Center streaming API

# 1. Login first to get token
echo "=== Step 1: Login to get auth token ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@shelfzone.com",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
echo "Token: ${TOKEN:0:20}..."

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response: $LOGIN_RESPONSE"
  exit 1
fi

# 2. Get list of agents
echo ""
echo "=== Step 2: Get active agents ==="
AGENTS=$(curl -s -X GET http://localhost:3001/api/agents \
  -H "Authorization: Bearer $TOKEN")

AGENT_ID=$(echo $AGENTS | jq -r '.agents[0].id')
AGENT_NAME=$(echo $AGENTS | jq -r '.agents[0].name')
echo "Using Agent: $AGENT_NAME (ID: $AGENT_ID)"

if [ "$AGENT_ID" == "null" ] || [ -z "$AGENT_ID" ]; then
  echo "❌ No agents found. Response: $AGENTS"
  exit 1
fi

# 3. Test streaming endpoint
echo ""
echo "=== Step 3: Test streaming message endpoint ==="
echo "Sending: 'Hello! Count to 5 for me.'"
curl -N -X POST http://localhost:3001/api/command-center/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT_ID\",
    \"conversationId\": null,
    \"message\": \"Hello! Count to 5 for me.\"
  }"

echo ""
echo ""
echo "=== Test Complete ==="

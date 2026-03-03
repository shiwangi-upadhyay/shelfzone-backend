#!/bin/bash

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shelfzone.com", "password": "admin123"}' | jq -r '.data.accessToken')

# Create conversation tab first
TAB_ID=$(curl -s -X POST http://localhost:3001/api/command-center/tabs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test OpenClaw"}' | jq -r '.data.id')

# Create conversation
CONV_ID=$(curl -s -X POST http://localhost:3001/api/command-center/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\": \"main-001\", \"tabId\": \"$TAB_ID\", \"title\": \"OpenClaw Test\"}" | jq -r '.data.id')

echo "Tab ID: $TAB_ID"
echo "Conversation ID: $CONV_ID"
echo ""
echo "Sending test message to OpenClaw..."
echo ""

# Send message (this will stream)
curl -N -X POST http://localhost:3001/api/command-center/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\": \"main-001\", \"conversationId\": \"$CONV_ID\", \"message\": \"Hello! Please respond with just 'Integration working' if you receive this.\"}"


#!/bin/bash

# Test script for multi-agent API

BASE_URL="http://localhost:3001"

echo "=== Testing Multi-Agent API ==="
echo ""

# Step 1: Create test user and get token
echo "1. Creating test user..."
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testagent@test.com",
    "password": "test123456",
    "name": "Test Agent User"
  }')

echo "Register response: ${REGISTER_RESPONSE}"
echo ""

# Step 2: Login to get token
echo "2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testagent@test.com",
    "password": "test123456"
  }')

echo "Login response: ${LOGIN_RESPONSE}"
echo ""

TOKEN=$(echo ${LOGIN_RESPONSE} | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Trying system user..."
  # Try system user
  LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "system@shelfzone.ai",
      "password": "system123"
    }')
  echo "System login response: ${LOGIN_RESPONSE}"
  TOKEN=$(echo ${LOGIN_RESPONSE} | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Could not obtain token. Exiting."
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:30}..."
echo ""

# Step 3: Get agent IDs
echo "3. Fetching agent registry..."
AGENTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/agents" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Agents response (first 500 chars): ${AGENTS_RESPONSE:0:500}"
echo ""

# Extract a few agent IDs (assuming response has array with id field)
AGENT_ID_1=$(echo ${AGENTS_RESPONSE} | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
AGENT_ID_2=$(echo ${AGENTS_RESPONSE} | grep -o '"id":"[^"]*' | head -2 | tail -1 | cut -d'"' -f4)
AGENT_ID_3=$(echo ${AGENTS_RESPONSE} | grep -o '"id":"[^"]*' | head -3 | tail -1 | cut -d'"' -f4)

echo "Agent IDs found:"
echo "  - ${AGENT_ID_1}"
echo "  - ${AGENT_ID_2}"
echo "  - ${AGENT_ID_3}"
echo ""

if [ -z "$AGENT_ID_1" ] || [ -z "$AGENT_ID_2" ]; then
  echo "❌ Could not find agent IDs. Exiting."
  exit 1
fi

# Step 4: Test execute-multi endpoint (parallel mode)
echo "4. Testing execute-multi (parallel mode)..."
MULTI_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agent-gateway/execute-multi" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentIds\": [\"${AGENT_ID_1}\", \"${AGENT_ID_2}\"],
    \"instruction\": \"Test parallel execution: analyze this simple task\",
    \"mode\": \"parallel\"
  }")

echo "Multi-agent response: ${MULTI_RESPONSE}"
echo ""

TRACE_ID=$(echo ${MULTI_RESPONSE} | grep -o '"traceId":"[^"]*' | cut -d'"' -f4)

if [ -z "$TRACE_ID" ]; then
  echo "❌ Failed to create trace"
  exit 1
fi

echo "✅ Trace created: ${TRACE_ID}"
echo ""

# Step 5: Test SSE streaming
echo "5. Testing SSE stream (first 10 seconds)..."
timeout 10 curl -s -N "${BASE_URL}/api/agent-gateway/stream/${TRACE_ID}?token=${TOKEN}" | head -20
echo ""
echo ""

# Step 6: Test sequential mode
echo "6. Testing execute-multi (sequential mode)..."
SEQ_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agent-gateway/execute-multi" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentIds\": [\"${AGENT_ID_1}\", \"${AGENT_ID_2}\"],
    \"instruction\": \"Test sequential execution: process this task\",
    \"mode\": \"sequential\"
  }")

echo "Sequential response: ${SEQ_RESPONSE}"
echo ""

# Step 7: Test delegate mode
echo "7. Testing execute-multi (delegate mode)..."
DEL_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agent-gateway/execute-multi" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentIds\": [\"${AGENT_ID_1}\"],
    \"instruction\": \"Test delegation: coordinate with sub-agents\",
    \"mode\": \"delegate\"
  }")

echo "Delegate response: ${DEL_RESPONSE}"
echo ""

echo "=== Test Complete ==="

#!/bin/bash
# ShelfZone OpenClaw Usage Ingestion Script
# Pushes session usage data to POST /api/billing/ingest
#
# Usage:
#   ./scripts/ingest-openclaw-usage.sh \
#     --agent "SHIWANGI" \
#     --task "Build Phase 5 Billing Ingest" \
#     --model "claude-opus-4-6" \
#     --tokens-in 185000 --tokens-out 42000 \
#     --cost 12.78 --duration 900000 \
#     --status success \
#     --session-type openclaw \
#     --sub "BackendForge|claude-opus-4-6|Build endpoints|95000|28000|7.20|339000|success" \
#     --sub "UIcraft|claude-sonnet-4-20250514|Build UI|78000|35000|3.45|420000|success"
#
# Environment:
#   SHELFZONE_URL    - Backend URL (default: http://localhost:3001)
#   SHELFZONE_EMAIL  - Login email (default: admin@shelfzone.com)
#   SHELFZONE_PASS   - Login password

set -euo pipefail

URL="${SHELFZONE_URL:-http://localhost:3001}"
EMAIL="${SHELFZONE_EMAIL:-admin@shelfzone.com}"
PASS="${SHELFZONE_PASS:-ShelfEx@2025}"

# Defaults
AGENT=""
TASK=""
MODEL=""
TOKENS_IN=0
TOKENS_OUT=0
COST=0
DURATION=0
STATUS="success"
SESSION_TYPE="openclaw"
INSTRUCTION=""
SUBS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --agent) AGENT="$2"; shift 2;;
    --task) TASK="$2"; shift 2;;
    --model) MODEL="$2"; shift 2;;
    --tokens-in) TOKENS_IN="$2"; shift 2;;
    --tokens-out) TOKENS_OUT="$2"; shift 2;;
    --cost) COST="$2"; shift 2;;
    --duration) DURATION="$2"; shift 2;;
    --status) STATUS="$2"; shift 2;;
    --session-type) SESSION_TYPE="$2"; shift 2;;
    --instruction) INSTRUCTION="$2"; shift 2;;
    --sub) SUBS+=("$2"); shift 2;;
    *) echo "Unknown option: $1"; exit 1;;
  esac
done

[[ -z "$AGENT" ]] && { echo "Error: --agent required"; exit 1; }
[[ -z "$TASK" ]] && { echo "Error: --task required"; exit 1; }
[[ -z "$MODEL" ]] && { echo "Error: --model required"; exit 1; }

# Login
TOKEN=$(curl -sf "$URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | jq -r '.accessToken')

[[ -z "$TOKEN" || "$TOKEN" == "null" ]] && { echo "Error: login failed"; exit 1; }

# Build sub-agents JSON array
SUB_JSON="[]"
if [[ ${#SUBS[@]} -gt 0 ]]; then
  SUB_JSON="["
  for i in "${!SUBS[@]}"; do
    IFS='|' read -r sAgent sModel sInstr sTokIn sTokOut sCost sDur sStatus <<< "${SUBS[$i]}"
    [[ $i -gt 0 ]] && SUB_JSON+=","
    SUB_JSON+="{\"agentName\":\"$sAgent\",\"model\":\"$sModel\",\"instruction\":\"$sInstr\",\"tokensIn\":$sTokIn,\"tokensOut\":$sTokOut,\"cost\":$sCost,\"durationMs\":$sDur,\"status\":\"$sStatus\"}"
  done
  SUB_JSON+="]"
fi

# Build payload
PAYLOAD=$(jq -n \
  --arg task "$TASK" \
  --arg agent "$AGENT" \
  --arg model "$MODEL" \
  --argjson tokIn "$TOKENS_IN" \
  --argjson tokOut "$TOKENS_OUT" \
  --argjson cost "$COST" \
  --argjson dur "$DURATION" \
  --arg status "$STATUS" \
  --arg stype "$SESSION_TYPE" \
  --arg instr "${INSTRUCTION:-$TASK}" \
  --argjson subs "$SUB_JSON" \
  '{
    taskDescription: $task,
    agentName: $agent,
    model: $model,
    tokensIn: $tokIn,
    tokensOut: $tokOut,
    cost: $cost,
    durationMs: $dur,
    status: $status,
    sessionType: $stype,
    instruction: $instr,
    subAgents: $subs
  }')

# Ingest
RESULT=$(curl -sf -X POST "$URL/api/billing/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$PAYLOAD")

echo "$RESULT" | jq .
echo "✅ Ingested: $AGENT → $TASK ($(echo "$RESULT" | jq -r '.data.agentsUsed') agents, \$$(echo "$RESULT" | jq -r '.data.totalCost'))"

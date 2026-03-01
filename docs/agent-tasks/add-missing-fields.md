# Task: Add Missing Fields to Org Tree API

**Agent:** BackendForge  
**Priority:** HIGH  
**Branch:** feature/fix-agent-trace-bugs (DO NOT CREATE NEW BRANCH)

---

## Problem

Frontend needs 2 missing fields from `/api/org-tree/agent-overview`:

1. **Designation** - employee's job title (CEO, Tech Lead, Developer, etc.)
2. **Model** - agent's default model (claude-opus-4-6, claude-sonnet-4-5, etc.)

---

## Current Response Structure

```typescript
// GET /api/org-tree/agent-overview
{
  data: [
    {
      employeeId: string;
      name: string;
      managerId: string | null;
      department: { id: string; name: string };
      agents: [
        {
          id: string;
          name: string;
          status: string;
          totalCost: number;
          sessionCount: number;
          // MISSING: model/defaultModel
        }
      ];
      totalCost: number;
      activeAgents: number;
      // MISSING: designation
    }
  ]
}
```

---

## Required Changes

### 1. Add Designation to Employee Data

File: `src/modules/agent-trace/services/cost-service.ts` (or similar)

Find the function that queries employees for org tree. Add designation join:

```typescript
// Current query (approximate):
const employees = await prisma.employee.findMany({
  where: { status: 'ACTIVE' },
  include: {
    department: true,
    // ADD THIS:
    designation: {
      select: {
        id: true,
        title: true,
        level: true,
      }
    }
  }
});

// Return format:
return {
  employeeId: emp.id,
  name: `${emp.firstName} ${emp.lastName}`,
  managerId: emp.managerId,
  designation: emp.designation.title,  // ADD THIS
  designationLevel: emp.designation.level,  // OPTIONAL (for sorting)
  department: {
    id: emp.department.id,
    name: emp.department.name,
  },
  agents: [...],
  totalCost: ...,
  activeAgents: ...,
};
```

### 2. Add Model to Agent Data

In the same function, when building the agents array:

```typescript
// Current (approximate):
const agents = await prisma.agentRegistry.findMany({
  where: { ownerId: employee.userId },
  select: {
    id: true,
    name: true,
    status: true,
    defaultModel: true,  // ADD THIS
  }
});

// Return format for each agent:
{
  id: agent.id,
  name: agent.name,
  status: agent.status,
  model: agent.defaultModel,  // ADD THIS
  totalCost: ...,
  sessionCount: ...,
}
```

---

## Files to Modify

**Likely location:** `src/modules/agent-trace/services/cost-service.ts`

Or check:
```bash
cd /root/.openclaw/workspace/shelfzone-backend
grep -r "org-tree/agent-overview" src/
grep -r "getOrgTreeOverview" src/
```

**Steps:**
1. Find the controller handler for `/api/org-tree/agent-overview`
2. Find the service function it calls
3. Add designation include to employee query
4. Add defaultModel select to agent query
5. Update return type to include both fields

---

## Testing

### 1. Test API endpoint:

```bash
TOKEN=$(curl -s -X POST http://157.10.98.227:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shelfzone.com", "password": "ShelfEx@2025"}' | jq -r '.accessToken')

curl -s "http://157.10.98.227:3001/api/org-tree/agent-overview" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0] | {name, designation, agents: .agents[0] | {name, model}}'
```

**Expected output:**
```json
{
  "name": "Gaurav Sethi",
  "designation": "CEO",
  "agents": {
    "name": "UIcraft",
    "model": "claude-sonnet-4-5"
  }
}
```

### 2. Verify database has data:

```sql
-- Check designations exist:
SELECT e.first_name, e.last_name, d.title as designation
FROM employees e
JOIN designations d ON e.designation_id = d.id
WHERE e.status = 'ACTIVE'
LIMIT 5;

-- Check agents have defaultModel:
SELECT name, default_model FROM agent_registry LIMIT 5;
```

---

## Git Workflow

```bash
cd /root/.openclaw/workspace/shelfzone-backend
git checkout feature/fix-agent-trace-bugs

# Make changes
npm run build
# Restart backend

git add .
git commit -m "fix(agent-trace): Add designation and model fields to org tree API"
git push origin feature/fix-agent-trace-bugs
```

---

## Success Criteria

- [ ] `/api/org-tree/agent-overview` returns designation for each employee
- [ ] `/api/org-tree/agent-overview` returns model for each agent
- [ ] Frontend Org View displays designation
- [ ] Frontend Agent View displays model
- [ ] No breaking changes to existing fields
- [ ] API response validates correctly

---

**Priority:** HIGH - Frontend is waiting for these fields.

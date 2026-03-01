# Task: Add Manager Hierarchy to Database

**Agent:** DataArchitect  
**Priority:** HIGH  
**Branch:** feature/fix-agent-trace-bugs (DO NOT CREATE NEW BRANCH)

---

## Problem

All employees in the database have `manager_id = NULL`.  
There's no reporting structure, so org charts can't be built.

Boss mentioned this hierarchy exists:
- **CEO:** Gaurav Sethi
- **Head of Operations:** Rajmani Shukla (reports to CEO)
- **Department Heads:** Subhro, Prabal, Siddique, Jayant (report to Rajmani)
- **Team Members:** Everyone else reports to their department head

---

## Task

### Option 1: Update manager_id in database

Create a migration/seed script to set manager_id relationships:

```sql
-- 1. Find CEO (designation level 10)
UPDATE employees SET manager_id = NULL WHERE designation_id IN (
  SELECT id FROM designations WHERE level = 10
);

-- 2. Set Rajmani as Head of Ops (reports to CEO)
UPDATE employees 
SET manager_id = (SELECT id FROM employees e JOIN users u ON e.user_id = u.id WHERE u.email = 'gaurav@shelfex.com')
WHERE user_id IN (SELECT id FROM users WHERE email = 'rajmani@shelfex.com');

-- 3. Set department heads to report to Rajmani
UPDATE employees
SET manager_id = (SELECT id FROM employees e JOIN users u ON e.user_id = u.id WHERE u.email = 'rajmani@shelfex.com')
WHERE department_id IN (
  SELECT id FROM departments WHERE name IN ('Development', 'Data', 'AI & Computer Vision', 'UX/UI')
)
AND designation_id IN (SELECT id FROM designations WHERE level >= 7);

-- 4. Set team members to report to their department head
-- This requires matching each employee to the head of their department
```

**OR**

### Option 2: Infer hierarchy from designation levels

Create a database view or backend service method:

```typescript
interface EmployeeHierarchy {
  id: string;
  name: string;
  managerId: string | null; // Computed from designation level + department
  level: number;
  department: string;
}

function inferHierarchy(employees: Employee[]): EmployeeHierarchy[] {
  // 1. Group by designation level
  // 2. Within each department, find highest level person = dept head
  // 3. Everyone else in that dept reports to dept head
  // 4. Dept heads report to level 8 (Tech Lead / Head of Ops)
  // 5. Tech Lead reports to CEO (level 10)
}
```

---

## Recommended Approach

**Use Option 1** (update database) because:
- More accurate
- Boss knows the real reporting structure
- Can be manually verified
- Better for long-term

---

## Implementation

### Step 1: Check current employee data

```sql
SELECT 
  e.first_name || ' ' || e.last_name as name,
  u.email,
  d.name as department,
  des.title as designation,
  des.level
FROM employees e
JOIN users u ON e.user_id = u.id
JOIN departments d ON e.department_id = d.id
JOIN designations des ON e.designation_id = des.id
WHERE e.status = 'ACTIVE'
ORDER BY des.level DESC, d.name, e.first_name;
```

### Step 2: Create migration script

File: `src/scripts/populate-manager-hierarchy.ts`

```typescript
import { prisma } from '../lib/prisma.js';

async function populateManagerHierarchy() {
  // 1. Find CEO
  const ceo = await prisma.employee.findFirst({
    where: { 
      designation: { level: 10 },
      status: 'ACTIVE'
    }
  });
  
  if (!ceo) throw new Error('CEO not found');
  console.log('CEO:', ceo.firstName, ceo.lastName);
  
  // 2. Find Head of Operations (Rajmani)
  const headOfOps = await prisma.employee.findFirst({
    where: {
      user: { email: 'rajmani@shelfex.com' },
      status: 'ACTIVE'
    }
  });
  
  if (headOfOps) {
    await prisma.employee.update({
      where: { id: headOfOps.id },
      data: { managerId: ceo.id }
    });
    console.log('Set Rajmani to report to CEO');
  }
  
  // 3. Find department heads (level 7+, one per department)
  const departments = await prisma.department.findMany();
  
  for (const dept of departments) {
    const deptHead = await prisma.employee.findFirst({
      where: {
        departmentId: dept.id,
        designation: { level: { gte: 7 } },
        status: 'ACTIVE'
      },
      orderBy: { designation: { level: 'desc' } }
    });
    
    if (deptHead && headOfOps) {
      await prisma.employee.update({
        where: { id: deptHead.id },
        data: { managerId: headOfOps.id }
      });
      console.log(`Set ${deptHead.firstName} to report to Rajmani`);
      
      // 4. Set team members to report to dept head
      await prisma.employee.updateMany({
        where: {
          departmentId: dept.id,
          id: { not: deptHead.id },
          status: 'ACTIVE'
        },
        data: { managerId: deptHead.id }
      });
    }
  }
  
  console.log('Hierarchy populated successfully');
}

populateManagerHierarchy().catch(console.error);
```

### Step 3: Run the script

```bash
cd /root/.openclaw/workspace/shelfzone-backend
npx tsx src/scripts/populate-manager-hierarchy.ts
```

### Step 4: Verify

```sql
SELECT 
  e.first_name || ' ' || e.last_name as employee,
  m.first_name || ' ' || m.last_name as manager,
  d.name as department
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id
JOIN departments d ON e.department_id = d.id
WHERE e.status = 'ACTIVE'
ORDER BY m.id NULLS FIRST, d.name;
```

---

## Git Workflow

```bash
cd /root/.openclaw/workspace/shelfzone-backend
git checkout feature/fix-agent-trace-bugs

# Create script
# Run script
# Verify hierarchy

git add src/scripts/populate-manager-hierarchy.ts
git commit -m "feat(data): Add manager hierarchy to employees"
git push origin feature/fix-agent-trace-bugs
```

---

## Success Criteria

- [ ] CEO identified (level 10 designation)
- [ ] Rajmani set as Head of Ops, reports to CEO
- [ ] 4 department heads identified, report to Rajmani
- [ ] All team members report to their department head
- [ ] Query shows proper tree structure
- [ ] UIcraft can now build real org tree

---

**Note:** After this is done, UIcraft's OrgTreeView will automatically render the correct hierarchy.

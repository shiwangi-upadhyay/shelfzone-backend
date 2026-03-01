-- Populate Manager Hierarchy for ShelfZone
-- DataArchitect | 2026-03-01

-- Step 1: Set CEO (Gaurav Sethi) with manager_id = NULL
UPDATE employees 
SET manager_id = NULL 
WHERE user_id IN (SELECT id FROM users WHERE email = 'gaurav@shelfex.com');

-- Step 2: Set Rajmani (Head of Operations) to report to CEO
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'gaurav@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE user_id IN (SELECT id FROM users WHERE email = 'rajmani@shelfex.com');

-- Step 3: Set department heads to report to Rajmani

-- Development: Subha Biswal (Sr. Full Stack Developer, highest level in Dev)
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'rajmani@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE user_id IN (SELECT id FROM users WHERE email = 'subha@shelfex.com');

-- Data: Deepanjali Panda (Sr. Data Engineer, highest level in Data)
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'rajmani@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE user_id IN (SELECT id FROM users WHERE email = 'deepanjali@shelfex.com');

-- AI & Computer Vision: Siddiq Raza (AI Engineer & CV Lead)
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'rajmani@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE user_id IN (SELECT id FROM users WHERE email = 'siddiq@shelfex.com');

-- UX/UI: Jayant Srivastava (Jr. UX/UI Designer)
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'rajmani@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE user_id IN (SELECT id FROM users WHERE email = 'jayant@shelfex.com');

-- Step 4: Set team members to report to their department heads

-- Development team → Subha Biswal
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'subha@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE department_id = (SELECT id FROM departments WHERE name = 'Development')
AND user_id NOT IN (
  SELECT id FROM users WHERE email IN ('subha@shelfex.com', 'gaurav@shelfex.com', 'rajmani@shelfex.com')
)
AND status = 'ACTIVE';

-- Data team → Deepanjali Panda
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'deepanjali@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE department_id = (SELECT id FROM departments WHERE name = 'Data')
AND user_id NOT IN (
  SELECT id FROM users WHERE email IN ('deepanjali@shelfex.com', 'gaurav@shelfex.com', 'rajmani@shelfex.com')
)
AND status = 'ACTIVE';

-- AI & Computer Vision team → Siddiq Raza
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'siddiq@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE department_id = (SELECT id FROM departments WHERE name = 'AI & Computer Vision')
AND user_id NOT IN (
  SELECT id FROM users WHERE email IN ('siddiq@shelfex.com', 'gaurav@shelfex.com', 'rajmani@shelfex.com')
)
AND status = 'ACTIVE';

-- UX/UI team → Jayant Srivastava (currently only one person, but for future)
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'jayant@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE department_id = (SELECT id FROM departments WHERE name = 'UX/UI')
AND user_id NOT IN (
  SELECT id FROM users WHERE email IN ('jayant@shelfex.com', 'gaurav@shelfex.com', 'rajmani@shelfex.com')
)
AND status = 'ACTIVE';

-- Handle Executive Leadership (System Admin should report to CEO)
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'gaurav@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE department_id = (SELECT id FROM departments WHERE name = 'Executive Leadership')
AND user_id NOT IN (
  SELECT id FROM users WHERE email = 'gaurav@shelfex.com'
)
AND status = 'ACTIVE';

-- Legal & Accounts: Vishal Goyal reports to Rajmani
UPDATE employees 
SET manager_id = (
  SELECT e.id 
  FROM employees e 
  JOIN users u ON e.user_id = u.id 
  WHERE u.email = 'rajmani@shelfex.com' 
  AND e.status = 'ACTIVE'
)
WHERE user_id IN (SELECT id FROM users WHERE email = 'vishal@shelfex.com');

# Core HR API Documentation (Layers 3A–3G)

> Complete endpoint reference for Departments, Designations, Employees, Attendance, Reports, Leave, Leave Admin, Payroll, Self-Service, and Notifications modules. Includes request/response schemas, RBAC rules, encryption, pagination, and error handling.

---

## 📋 Table of Contents

1. [Departments API](#departments-api)
2. [Designations API](#designations-api)
3. [Employees API](#employees-api)
4. [Attendance API](#attendance-api)
5. [Reports API](#reports-api)
6. [Leave API](#leave-api)
7. [Leave Admin API](#leave-admin-api)
8. [Payroll API](#payroll-api)
9. [Self-Service API](#self-service-api)
10. [Notifications API](#notifications-api)
11. [Pagination Format](#pagination-format)
12. [RBAC Behavior](#rbac-behavior)
13. [PII Encryption & Decryption](#pii-encryption--decryption)
14. [Error Responses](#error-responses)

---

## Departments API

### POST /api/departments
Create a new department.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  name: string;              // Required. 1-100 chars, trimmed
  description?: string;      // Optional. Max 500 chars, trimmed
  managerId?: string (CUID); // Optional. Manager employee ID
}
```

**Constraints:**
- Department name must be unique (409 Conflict if duplicate)
- Manager must exist in employees table
- Name is case-sensitive for uniqueness

**Response (201 Created):**
```typescript
{
  data: {
    id: string (CUID);
    name: string;
    description: string | null;
    managerId: string | null;
    isActive: boolean;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    manager?: {
      id: string;
      email: string;
    }
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure (Zod error message included)
- **409 Conflict** — Department name already exists
- **401 Unauthorized** — No valid auth token
- **403 Forbidden** — Insufficient role permissions

**Audit Log:** `action: CREATE`, `resource: Department`, includes department name

---

### GET /api/departments
List all departments with pagination and search.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Query Parameters:**
```typescript
{
  page?: number;              // Default: 1. Min 1.
  limit?: number;             // Default: 10. Min 1, Max 100.
  search?: string;            // Optional. Matches department name (case-insensitive)
  isActive?: 'true' | 'false' // Optional. Filter by active status
}
```

**Response (200 OK):**
```typescript
{
  data: Department[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Pagination Details:**
- `skip = (page - 1) * limit`
- Ordered by `name` ascending
- Empty result set returns `[]` with `total: 0`

**Example:**
```bash
GET /api/departments?page=2&limit=20&search=sales&isActive=true
```

---

### GET /api/departments/:id
Retrieve a specific department by ID.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    name: string;
    description: string | null;
    managerId: string | null;
    isActive: boolean;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    manager?: {
      id: string;
      email: string;
    }
  }
}
```

**Error Responses:**
- **400 Bad Request** — Invalid ID format
- **404 Not Found** — Department does not exist
- **401 Unauthorized** — No valid auth token

---

### PUT /api/departments/:id
Update a department.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Request Body (all fields optional):**
```typescript
{
  name?: string;              // 1-100 chars, trimmed
  description?: string;       // Max 500 chars, trimmed, nullable
  managerId?: string (CUID) | null; // Can disconnect manager with null
}
```

**Constraints:**
- Name uniqueness check is skipped if not changing the name
- New manager must exist in employees table

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    name: string;
    description: string | null;
    managerId: string | null;
    isActive: boolean;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    manager?: {
      id: string;
      email: string;
    }
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **404 Not Found** — Department or manager not found
- **409 Conflict** — New name conflicts with existing department

**Audit Log:** `action: UPDATE`, `resource: Department`, includes changed fields

---

### DELETE /api/departments/:id
Soft-delete a department (deactivation). Cannot delete if active employees exist.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Behavior:**
- Sets `isActive = false`
- Checks for active employees (`status = ACTIVE`) before deletion
- Does NOT hard-delete from DB

**Response (200 OK):**
```typescript
{
  data: {
    message: "Department deactivated successfully"
  }
}
```

**Error Responses:**
- **400 Bad Request** — Department has active employees
- **404 Not Found** — Department does not exist
- **403 Forbidden** — Insufficient role permissions

**Audit Log:** `action: DELETE`, `resource: Department`

---

## Designations API

### POST /api/designations
Create a new designation.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  title: string;            // Required. 1-100 chars, trimmed
  level: number;            // Required. Integer 1-5 (hierarchy level)
  description?: string;     // Optional. Max 500 chars, trimmed
}
```

**Constraints:**
- Designation title must be unique (409 Conflict if duplicate)
- Level must be between 1 (lowest) and 5 (highest)

**Response (201 Created):**
```typescript
{
  data: {
    id: string;
    title: string;
    level: number;
    description: string | null;
    isActive: boolean;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **409 Conflict** — Designation title already exists
- **403 Forbidden** — Insufficient role permissions

**Audit Log:** `action: CREATE`, `resource: Designation`, includes title

---

### GET /api/designations
List all designations with filters.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Query Parameters:**
```typescript
{
  page?: number;              // Default: 1. Min 1.
  limit?: number;             // Default: 10. Min 1, Max 100.
  search?: string;            // Optional. Matches title (case-insensitive)
  isActive?: 'true' | 'false' // Optional. Filter by active status
  level?: number;             // Optional. Filter by level (1-5)
}
```

**Response (200 OK):**
```typescript
{
  data: Designation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Pagination Details:**
- Ordered by `createdAt` descending (newest first)
- `skip = (page - 1) * limit`

**Example:**
```bash
GET /api/designations?page=1&limit=10&level=3&isActive=true
```

---

### GET /api/designations/:id
Retrieve a specific designation.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Path Parameters:**
```typescript
{
  id: string // Required
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string;
    title: string;
    level: number;
    description: string | null;
    isActive: boolean;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **404 Not Found** — Designation does not exist
- **401 Unauthorized** — No valid auth token

---

### PUT /api/designations/:id
Update a designation.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Path Parameters:**
```typescript
{
  id: string // Required
}
```

**Request Body (all fields optional):**
```typescript
{
  title?: string;       // 1-100 chars, trimmed
  level?: number;       // Integer 1-5
  description?: string | null; // Max 500 chars, nullable
}
```

**Constraints:**
- Title uniqueness validated only if title is being changed
- Level must be within 1-5 range

**Response (200 OK):**
```typescript
{
  data: {
    id: string;
    title: string;
    level: number;
    description: string | null;
    isActive: boolean;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **404 Not Found** — Designation not found
- **409 Conflict** — New title conflicts with existing designation
- **403 Forbidden** — Insufficient role permissions

**Audit Log:** `action: UPDATE`, `resource: Designation`

---

### DELETE /api/designations/:id
Soft-delete a designation. Cannot delete if active employees exist.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Path Parameters:**
```typescript
{
  id: string // Required
}
```

**Behavior:**
- Sets `isActive = false`
- Checks for active employees (`status = ACTIVE`) with this designation
- Does NOT hard-delete from DB

**Response (200 OK):**
```typescript
{
  data: {
    id: string;
    title: string;
    level: number;
    description: string | null;
    isActive: boolean;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **409 Conflict** — Cannot deactivate designation with active employees
- **404 Not Found** — Designation not found
- **403 Forbidden** — Insufficient role permissions

**Audit Log:** `action: DELETE`, `resource: Designation`

---

## Employees API

### POST /api/employees
Create a new employee record. Links user to department, designation, and manager.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  userId: string (CUID);           // Required. User ID from auth system
  departmentId: string (CUID);     // Required. Department ID
  designationId: string (CUID);    // Required. Designation ID
  firstName: string;               // Required. 1-100 chars, trimmed
  lastName: string;                // Required. 1-100 chars, trimmed
  phone?: string;                  // Optional. Max 20 chars, trimmed
  aadhaar?: string;                // Optional. Max 20 chars. ENCRYPTED
  pan?: string;                    // Optional. Max 20 chars. ENCRYPTED
  salary?: string;                 // Optional. Max 50 chars. ENCRYPTED
  dateOfJoining: ISO8601 | date;   // Required. ISO 8601 datetime or YYYY-MM-DD
  managerId?: string (CUID);       // Optional. Manager employee ID
}
```

**PII Fields (Encrypted):**
- `aadhaar`, `pan`, `salary` are encrypted using AES-256-GCM before storage
- Stored as `encryptedAadhaar`, `encryptedPan`, `encryptedSalary` in DB
- Automatically decrypted in response for admins only

**Constraints:**
- User ID must not already have an employee record (409 Conflict)
- Department and Designation must exist
- Manager must exist in employees table
- Employee code auto-generated (format: `EMP-YYYYMMDD-XXXXX`)

**Response (201 Created):**
```typescript
{
  data: {
    id: string (CUID);
    employeeCode: string;           // Auto-generated
    userId: string (CUID);
    firstName: string;
    lastName: string;
    phone: string | null;
    aadhaar: string | null;         // DECRYPTED (admin only)
    pan: string | null;             // DECRYPTED (admin only)
    salary: string | null;          // DECRYPTED (admin only)
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED'; // Default: ACTIVE
    dateOfJoining: ISO8601;
    dateOfLeaving: ISO8601 | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    user: {
      id: string;
      email: string;
    };
    department: {
      id: string;
      name: string;
    };
    designation: {
      id: string;
      title: string;
    };
    manager?: {
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
    };
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **404 Not Found** — User, Department, Designation, or Manager not found
- **409 Conflict** — User already has an employee record
- **403 Forbidden** — Insufficient role permissions

**Audit Log:** `action: CREATE`, `resource: Employee`, includes `employeeCode`

---

### GET /api/employees
List employees with advanced filtering, search, and pagination.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` (see all), `MANAGER` (see own + directs), `EMPLOYEE` (see self only)

**Query Parameters:**
```typescript
{
  page?: number;                                // Default: 1. Min 1.
  limit?: number;                              // Default: 10. Min 1, Max 100.
  search?: string;                             // Optional. Searches: firstName, lastName, employeeCode, email
  departmentId?: string (CUID);                // Optional. Filter by department
  designationId?: string (CUID);               // Optional. Filter by designation
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED'; // Optional
  managerId?: string (CUID);                   // Optional. Filter by manager
  sortBy?: 'firstName' | 'lastName' | 'employeeCode' | 'dateOfJoining' | 'createdAt'; // Default: createdAt
  sortOrder?: 'asc' | 'desc';                  // Default: desc
}
```

**RBAC Filtering:**
- **SUPER_ADMIN / HR_ADMIN:** See all employees
- **MANAGER:** See self + all direct reports (employees where `managerId = manager.id`)
- **EMPLOYEE:** See self only (filtered by `userId`)

**Response (200 OK):**
```typescript
{
  data: Employee[]; // PII STRIPPED (see below)
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**PII Behavior in List:**
- `encryptedAadhaar`, `encryptedPan`, `encryptedSalary` are **removed** from response
- Non-admin users never see encrypted PII fields
- Admin users do NOT get decrypted PII in list responses (list endpoint strips PII)

**Example:**
```bash
GET /api/employees?page=1&limit=20&departmentId=cuid123&status=ACTIVE&sortBy=firstName&sortOrder=asc
```

---

### GET /api/employees/:id
Retrieve a single employee with full details.

**Access:**
- **SUPER_ADMIN / HR_ADMIN:** See any employee (with decrypted PII)
- **MANAGER:** See self or direct reports (no PII decryption)
- **EMPLOYEE:** See self only (no PII decryption)

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeCode: string;
    userId: string (CUID);
    firstName: string;
    lastName: string;
    phone: string | null;
    aadhaar: string | null;         // DECRYPTED (admin only)
    pan: string | null;             // DECRYPTED (admin only)
    salary: string | null;          // DECRYPTED (admin only)
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';
    dateOfJoining: ISO8601;
    dateOfLeaving: ISO8601 | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    user: {
      id: string;
      email: string;
    };
    department: {
      id: string;
      name: string;
    };
    designation: {
      id: string;
      title: string;
    };
    manager?: {
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
    };
  }
}
```

**PII Decryption Logic:**
- If requesting user is **SUPER_ADMIN** or **HR_ADMIN**: decrypt and return `aadhaar`, `pan`, `salary`
- Otherwise: strip encrypted fields entirely

**Error Responses:**
- **400 Bad Request** — Invalid ID format
- **403 Forbidden** — MANAGER cannot see non-direct employees; EMPLOYEE cannot see others
- **404 Not Found** — Employee not found
- **401 Unauthorized** — No valid auth token

---

### PUT /api/employees/:id
Update employee information.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Request Body (all fields optional):**
```typescript
{
  firstName?: string;                                        // 1-100 chars
  lastName?: string;                                         // 1-100 chars
  phone?: string | null;                                     // Max 20 chars, nullable
  aadhaar?: string | null;                                   // Max 20 chars. RE-ENCRYPTED if changed
  pan?: string | null;                                       // Max 20 chars. RE-ENCRYPTED if changed
  salary?: string | null;                                    // Max 50 chars. RE-ENCRYPTED if changed
  departmentId?: string (CUID);                              // Change department
  designationId?: string (CUID);                             // Change designation
  dateOfJoining?: ISO8601 | date;                            // Change joining date
  managerId?: string (CUID) | null;                          // Change manager or disconnect
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED'; // Change employment status
}
```

**PII Re-encryption:**
- If `aadhaar`, `pan`, or `salary` are provided, they are **re-encrypted** before storage
- Passing `null` removes the value

**Constraints:**
- Department and Designation must exist if changed
- Manager must exist in employees table if set
- userId is immutable (cannot change which user this employee record belongs to)

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeCode: string;
    userId: string (CUID);
    firstName: string;
    lastName: string;
    phone: string | null;
    aadhaar: string | null;         // DECRYPTED
    pan: string | null;             // DECRYPTED
    salary: string | null;          // DECRYPTED
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';
    dateOfJoining: ISO8601;
    dateOfLeaving: ISO8601 | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    user: { id: string; email: string };
    department: { id: string; name: string };
    designation: { id: string; title: string };
    manager?: { id: string; firstName: string; lastName: string; employeeCode: string };
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **403 Forbidden** — Only admins can update
- **404 Not Found** — Employee, Department, Designation, or Manager not found

**Audit Log:** `action: UPDATE`, `resource: Employee`, includes list of changed field names (not values)

---

### DELETE /api/employees/:id
Soft-delete an employee (mark as TERMINATED).

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Behavior:**
- Sets `status = TERMINATED`
- Sets `dateOfLeaving = current timestamp`
- Does NOT hard-delete from DB
- Audit trail preserved

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeCode: string;
    userId: string (CUID);
    firstName: string;
    lastName: string;
    phone: string | null;
    // PII stripped (no decryption on delete)
    status: 'TERMINATED';
    dateOfJoining: ISO8601;
    dateOfLeaving: ISO8601; // Set to now
    createdAt: ISO8601;
    updatedAt: ISO8601;
    user: { id: string; email: string };
    department: { id: string; name: string };
    designation: { id: string; title: string };
  }
}
```

**Error Responses:**
- **403 Forbidden** — Only admins can delete
- **404 Not Found** — Employee not found
- **401 Unauthorized** — No valid auth token

**Audit Log:** `action: DELETE`, `resource: Employee`, includes `{ softDelete: true, status: 'TERMINATED' }`

---

## Attendance API

### POST /api/attendance/check-in
Employee checks in (start of workday).

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE` (all authenticated users)

**Request Body:**
```typescript
{
  note?: string; // Optional. Max 500 chars, trimmed
}
```

**Behavior:**
- Records check-in timestamp (server time)
- One check-in per day per employee
- Auto-linked to authenticated employee
- Status set to `PRESENT` (unless already marked otherwise by admin)

**Response (201 Created):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string (CUID);
    date: ISO8601;
    checkInTime: ISO8601; // Timestamp of check-in
    checkOutTime: ISO8601 | null;
    status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';
    note: string | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **401 Unauthorized** — No valid auth token
- **409 Conflict** — Already checked in today

**Audit Log:** `action: CREATE`, `resource: Attendance`, includes `{ checkIn: true }`

---

### POST /api/attendance/check-out
Employee checks out (end of workday).

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE` (all authenticated users)

**Request Body:**
```typescript
{
  note?: string; // Optional. Max 500 chars, trimmed
}
```

**Behavior:**
- Records check-out timestamp
- Must have checked in earlier today
- Calculates hours worked
- Closes attendance record for the day

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string (CUID);
    date: ISO8601;
    checkInTime: ISO8601;
    checkOutTime: ISO8601; // Now set
    status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';
    hoursWorked: number; // Calculated as (checkOut - checkIn) / 3600
    note: string | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **401 Unauthorized** — No valid auth token
- **409 Conflict** — No check-in found for today or already checked out

**Audit Log:** `action: UPDATE`, `resource: Attendance`, includes `{ checkOut: true }`

---

### POST /api/attendance/regularize
Admin manually creates or corrects attendance record (e.g., for absent employees, manual corrections).

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  employeeId: string (CUID);     // Required. Employee ID
  date: string (YYYY-MM-DD);     // Required. Date to regularize
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND'; // Required
  checkIn?: ISO8601;             // Optional. Check-in timestamp
  checkOut?: ISO8601;            // Optional. Check-out timestamp
  note?: string;                 // Optional. Max 500 chars, admin note
}
```

**Behavior:**
- Creates or overwrites attendance record for specified date
- Used for corrections, holidays, special cases
- Hours calculated if both checkIn and checkOut provided

**Response (201 Created):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string (CUID);
    date: ISO8601;
    checkInTime: ISO8601 | null;
    checkOutTime: ISO8601 | null;
    hoursWorked: number | null; // Only if both times provided
    status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';
    note: string | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **403 Forbidden** — Only admins can regularize
- **404 Not Found** — Employee not found

**Audit Log:** `action: CREATE`, `resource: Attendance`, includes `{ regularized: true, adminNote: note }`

---

### GET /api/attendance
List attendance records with filtering and pagination.

**Access:**
- **SUPER_ADMIN / HR_ADMIN:** See all employees' attendance
- **MANAGER:** See own + direct reports' attendance
- **EMPLOYEE:** See own attendance only

**Query Parameters:**
```typescript
{
  employeeId?: string (CUID);    // Optional. Filter by employee
  startDate?: string (YYYY-MM-DD); // Optional. Range start
  endDate?: string (YYYY-MM-DD);   // Optional. Range end
  status?: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND'; // Optional
  page?: number;                 // Default: 1. Min 1.
  limit?: number;                // Default: 10. Min 1, Max 100.
}
```

**Response (200 OK):**
```typescript
{
  data: Attendance[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**RBAC Filtering:**
- Employees see only their own records
- Managers see their own + all subordinates
- Admins see all

**Ordering:** By `date` descending (most recent first)

---

### GET /api/attendance/:id
Retrieve a specific attendance record.

**Access:**
- **SUPER_ADMIN / HR_ADMIN:** See any record
- **MANAGER:** See own or direct report's record
- **EMPLOYEE:** See own only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string (CUID);
    date: ISO8601;
    checkInTime: ISO8601 | null;
    checkOutTime: ISO8601 | null;
    hoursWorked: number | null;
    status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';
    note: string | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    };
  }
}
```

**Error Responses:**
- **400 Bad Request** — Invalid ID format
- **403 Forbidden** — RBAC violation
- **404 Not Found** — Record not found

---

## Reports API

Reports endpoints are prefixed with `/api/reports/` and provide aggregated attendance analytics.

### GET /api/reports/attendance/daily
Get daily attendance report for a specific date.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER` only

**Query Parameters:**
```typescript
{
  date: string (YYYY-MM-DD);     // Required. ISO date
  departmentId?: string (CUID);  // Optional. Filter by department
}
```

**Response (200 OK):**
```typescript
{
  data: {
    date: ISO8601;
    totalEmployees: number;
    present: number;
    absent: number;
    halfDay: number;
    late: number;
    onLeave: number;
    holiday: number;
    weekend: boolean;
    departmentId: string | null;
    breakdown: [
      {
        status: string;
        count: number;
        employees: [
          {
            id: string;
            employeeCode: string;
            firstName: string;
            lastName: string;
          }
        ];
      }
    ];
    timestamp: ISO8601;
  }
}
```

---

### GET /api/reports/attendance/weekly
Get weekly attendance summary (7 days).

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER` only

**Query Parameters:**
```typescript
{
  startDate: string (YYYY-MM-DD); // Required. Monday of week
  departmentId?: string (CUID);   // Optional. Filter by department
}
```

**Response (200 OK):**
```typescript
{
  data: {
    startDate: ISO8601;
    endDate: ISO8601; // 6 days after startDate
    totalEmployees: number;
    summaryByDay: [
      {
        date: ISO8601;
        present: number;
        absent: number;
        halfDay: number;
        late: number;
        onLeave: number;
      }
    ];
    weeklyStats: {
      avgPresentDays: number;
      avgAbsentDays: number;
      avgLateDays: number;
    };
  }
}
```

---

### GET /api/reports/attendance/monthly
Get monthly attendance report.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER` only

**Query Parameters:**
```typescript
{
  month: number;                 // Required. 1-12
  year: number;                  // Required. 2000-2100
  departmentId?: string (CUID);  // Optional. Filter by department
  employeeId?: string (CUID);    // Optional. Filter by employee
}
```

**Response (200 OK):**
```typescript
{
  data: {
    month: number;
    year: number;
    totalDays: number; // Days in month
    workingDays: number; // Excluding weekends/holidays
    totalEmployees: number;
    summary: {
      totalPresent: number;
      totalAbsent: number;
      totalHalfDay: number;
      totalLate: number;
      totalOnLeave: number;
    };
    employeeWise: [
      {
        employeeId: string;
        employeeCode: string;
        name: string;
        presentDays: number;
        absentDays: number;
        halfDays: number;
        lateDays: number;
        leavesDays: number;
        attendancePercentage: number;
      }
    ];
  }
}
```

---

## Leave API

### POST /api/leave/apply
Employee applies for leave.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE` (all authenticated users)

**Request Body:**
```typescript
{
  leaveType: 'CASUAL' | 'SICK' | 'EARNED' | 'MATERNITY' | 'PATERNITY' | 'COMPENSATORY' | 'UNPAID' | 'BEREAVEMENT'; // Required
  startDate: string (YYYY-MM-DD);  // Required
  endDate: string (YYYY-MM-DD);    // Required. Must be >= startDate
  reason: string;                  // Required. 1-1000 chars, trimmed
  isHalfDay?: boolean;             // Optional. Default: false
  halfDayType?: 'FIRST_HALF' | 'SECOND_HALF'; // Required if isHalfDay = true
}
```

**Behavior:**
- Validates leave balance availability
- Checks for date conflicts (overlapping leaves)
- Auto-linked to authenticated employee
- Status starts as `PENDING` (awaiting manager/HR approval)
- Notification sent to manager/HR

**Response (201 Created):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string (CUID);
    leaveType: string;
    startDate: ISO8601;
    endDate: ISO8601;
    daysRequested: number;
    isHalfDay: boolean;
    halfDayType: string | null;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    reviewNote: string | null;
    reviewedBy: string | null; // Manager/HR ID
    reviewedAt: ISO8601 | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure (invalid dates, insufficient balance)
- **401 Unauthorized** — No valid auth token
- **409 Conflict** — Overlapping leave request exists

**Audit Log:** `action: CREATE`, `resource: LeaveRequest`, includes `{ leaveType, daysRequested }`

---

### PUT /api/leave/:id/review
Manager or HR approves/rejects a leave request.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER` only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required. Leave request ID
}
```

**Request Body:**
```typescript
{
  status: 'APPROVED' | 'REJECTED'; // Required
  reviewNote?: string;             // Optional. Max 500 chars
}
```

**Behavior:**
- Only managers can review their own team's leaves
- HR/SUPER_ADMIN can review any leave
- Once approved, balance is deducted
- Notifications sent to employee
- Attendance records auto-created if approved

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string (CUID);
    leaveType: string;
    startDate: ISO8601;
    endDate: ISO8601;
    daysRequested: number;
    status: 'APPROVED' | 'REJECTED';
    reviewNote: string | null;
    reviewedBy: string (CUID); // Manager/HR ID
    reviewedAt: ISO8601;
    createdAt: ISO8601;
    updatedAt: ISO8601;
  }
}
```

**Error Responses:**
- **403 Forbidden** — RBAC violation; manager cannot approve non-team leaves
- **404 Not Found** — Leave request not found
- **409 Conflict** — Leave already reviewed; cannot change status

**Audit Log:** `action: UPDATE`, `resource: LeaveRequest`, includes `{ newStatus, reviewer }`

---

### PUT /api/leave/:id/cancel
Employee cancels their pending or approved leave.

**Access:** All authenticated users (can cancel own leave only)

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Request Body:**
```typescript
{} // Empty body
```

**Behavior:**
- Only employee who applied can cancel
- Can only cancel pending or approved leaves
- Deducts cancellation from leave balance if approved
- Restores balance on cancellation

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    status: 'CANCELLED';
    cancelledAt: ISO8601;
  }
}
```

**Error Responses:**
- **403 Forbidden** — Cannot cancel another user's leave
- **404 Not Found** — Leave request not found
- **409 Conflict** — Cannot cancel rejected or already cancelled leave

**Audit Log:** `action: UPDATE`, `resource: LeaveRequest`, includes `{ action: 'cancelled' }`

---

### GET /api/leave
List leave requests with filtering and pagination.

**Access:**
- **SUPER_ADMIN / HR_ADMIN:** See all employees' leaves
- **MANAGER:** See own + direct reports' leaves
- **EMPLOYEE:** See own leaves only

**Query Parameters:**
```typescript
{
  employeeId?: string (CUID);    // Optional. Filter by employee
  leaveType?: string;            // Optional. Filter by type
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; // Optional
  startDate?: string (YYYY-MM-DD); // Optional. Range start
  endDate?: string (YYYY-MM-DD);   // Optional. Range end
  page?: number;                 // Default: 1
  limit?: number;                // Default: 10. Max 100
}
```

**Response (200 OK):**
```typescript
{
  data: LeaveRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Ordering:** By `createdAt` descending

---

### GET /api/leave/:id
Retrieve a specific leave request.

**Access:**
- **SUPER_ADMIN / HR_ADMIN:** See any
- **MANAGER:** See own or team's
- **EMPLOYEE:** See own only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string (CUID);
    leaveType: string;
    startDate: ISO8601;
    endDate: ISO8601;
    daysRequested: number;
    isHalfDay: boolean;
    halfDayType: string | null;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    reviewNote: string | null;
    reviewedBy: string | null;
    reviewedAt: ISO8601 | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    };
    reviewer?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }
}
```

---

## Leave Admin API

Administrative endpoints for managing leave balances and allocations.

### POST /api/leave-admin/initialize
Initialize leave balance for a single employee.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  employeeId: string (CUID);  // Required
  year: number;               // Required. 2000-2100
}
```

**Behavior:**
- Creates leave balance records for all leave types
- Sets default allocations (e.g., 12 casual days, 7 sick days per year)
- Overwrites existing balance for the year

**Response (201 Created):**
```typescript
{
  data: {
    employeeId: string;
    year: number;
    balances: [
      {
        leaveType: string;
        allocated: number;
        used: number;
        pending: number; // In pending approvals
        available: number; // allocated - used - pending
      }
    ];
    createdAt: ISO8601;
  }
}
```

**Error Responses:**
- **403 Forbidden** — Only admins
- **404 Not Found** — Employee not found
- **409 Conflict** — Balance already initialized for this year

---

### POST /api/leave-admin/initialize-all
Initialize leave balance for all active employees in a year.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  year: number; // Required. 2000-2100
}
```

**Behavior:**
- Bulk operation
- Only initializes for employees with `status = ACTIVE`
- Returns count of initialized employees

**Response (200 OK):**
```typescript
{
  data: {
    year: number;
    initializedCount: number;
    message: string; // e.g., "Initialized leave balance for 45 employees"
  }
}
```

---

### POST /api/leave-admin/adjust
Manually adjust leave balance (add/subtract days).

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  employeeId: string (CUID);  // Required
  leaveType: string;          // Required
  year: number;               // Required. 2000-2100
  adjustment: number;         // Required. Positive or negative integer
  reason: string;             // Required. 1-500 chars (admin note)
}
```

**Behavior:**
- Add or subtract from leave allocation
- Logs adjustment reason for audit trail
- Can result in negative balance (overuse scenario)

**Response (200 OK):**
```typescript
{
  data: {
    leaveType: string;
    employeeId: string;
    year: number;
    previousBalance: number;
    adjustment: number;
    newBalance: number;
    reason: string;
    adjustedAt: ISO8601;
  }
}
```

**Audit Log:** `action: UPDATE`, `resource: LeaveBalance`, includes `{ adjustment, reason }`

---

### GET /api/leave-admin/balance
Get leave balance for an employee.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Query Parameters:**
```typescript
{
  employeeId: string (CUID);     // Required. Employee ID
  year?: number;                 // Optional. Default: current year
}
```

**Response (200 OK):**
```typescript
{
  data: {
    employeeId: string;
    year: number;
    balances: [
      {
        leaveType: string;
        allocated: number;
        used: number;
        pending: number;
        available: number; // allocated - used - pending
        carryForward: number; // From previous year
      }
    ];
  }
}
```

---

### POST /api/leave-admin/carry-forward
Carry forward unused leaves to next year (bulk operation, typically yearly).

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  year: number; // Required. Current year to close
}
```

**Behavior:**
- For all active employees with unused balance
- Moves unused days to next year (subject to carry-forward limits per leave type)
- Locks previous year's balance

**Response (200 OK):**
```typescript
{
  data: {
    year: number;
    nextYear: number;
    employeesProcessed: number;
    totalCarriedForward: number; // Total days moved
    message: string;
  }
}
```

---

## Payroll API

### POST /api/payroll/salary-structure
Create or update salary structure for an employee.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  employeeId: string (CUID);        // Required
  basicSalary: number;              // Required. Positive, max 10M
  hra?: number;                     // Optional. Nonnegative
  da?: number;                      // Optional. Dearness Allowance
  specialAllowance?: number;        // Optional
  medicalAllowance?: number;        // Optional
  transportAllowance?: number;      // Optional
  effectiveFrom: string (YYYY-MM-DD); // Required. Date structure becomes active
}
```

**Encryption:** Salary amounts are **encrypted** at rest using AES-256-GCM (same as PII).

**Behavior:**
- Can have multiple versions (effective from different dates)
- New structure supersedes old when effectiveFrom date arrives
- Linked to payroll run for calculation

**Response (201 Created):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string;
    basicSalary: number;       // DECRYPTED (admin only)
    hra: number | null;        // DECRYPTED
    da: number | null;         // DECRYPTED
    specialAllowance: number | null;
    medicalAllowance: number | null;
    transportAllowance: number | null;
    grossSalary: number;       // basicSalary + allowances (DECRYPTED)
    effectiveFrom: ISO8601;
    effectiveUntil: ISO8601 | null; // When next structure starts
    createdAt: ISO8601;
  }
}
```

**Error Responses:**
- **400 Bad Request** — Validation failure
- **403 Forbidden** — Only admins
- **404 Not Found** — Employee not found

---

### GET /api/payroll/salary-structure/:employeeId
Get current or historical salary structure.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Path Parameters:**
```typescript
{
  employeeId: string (CUID) // Required
}
```

**Query Parameters:**
```typescript
{
  effectiveDate?: string (YYYY-MM-DD); // Optional. Get structure valid on this date. Default: today
}
```

**RBAC:**
- Employees can see their own only
- Managers can see their direct reports
- Admins can see all

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string;
    basicSalary: number;       // DECRYPTED (admins only; non-admin gets null)
    hra: number | null;
    da: number | null;
    specialAllowance: number | null;
    medicalAllowance: number | null;
    transportAllowance: number | null;
    grossSalary: number | null; // DECRYPTED (admins only)
    effectiveFrom: ISO8601;
    effectiveUntil: ISO8601 | null;
  }
}
```

---

### POST /api/payroll/run
Create a payroll run for a specific month/year.

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Request Body:**
```typescript
{
  month: number;  // Required. 1-12
  year: number;   // Required. 2000-2100
}
```

**Behavior:**
- Creates a batch payroll for all active employees
- Status starts as `DRAFT`
- Not yet processed (no payslips generated)
- Locks payroll parameters (salary, attendance)

**Response (201 Created):**
```typescript
{
  data: {
    id: string (CUID);
    month: number;
    year: number;
    status: 'DRAFT' | 'PROCESSED' | 'PAID' | 'CANCELLED';
    totalEmployees: number;
    totalGrossAmount: number;    // ENCRYPTED
    processedAt: ISO8601 | null;
    paidAt: ISO8601 | null;
    createdAt: ISO8601;
    createdBy: string;           // HR admin ID
  }
}
```

---

### POST /api/payroll/run/:id/process
Process a payroll run (calculate payslips, deductions).

**Access:** `SUPER_ADMIN`, `HR_ADMIN` only

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required. Payroll run ID
}
```

**Request Body:**
```typescript
{} // Empty body
```

**Behavior:**
- Calculates payslip for each employee
- Applies deductions (PF, tax, etc.)
- Generates payslip records
- Status changes to `PROCESSED`
- Cannot re-process; only admins can revert and restart

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    month: number;
    year: number;
    status: 'PROCESSED';
    totalEmployees: number;
    successCount: number;
    failureCount: number; // Employees with issues
    errors: [
      {
        employeeId: string;
        reason: string; // e.g., "No salary structure"
      }
    ];
    processedAt: ISO8601;
  }
}
```

---

### GET /api/payroll/payslips
List payslips with filtering.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Query Parameters:**
```typescript
{
  employeeId?: string (CUID);    // Optional. Filter by employee
  month?: number;                // Optional. 1-12
  year?: number;                 // Optional. 2000-2100
  page?: number;                 // Default: 1
  limit?: number;                // Default: 10. Max 100
}
```

**RBAC:**
- Employees see their own payslips only
- Managers see their direct reports' payslips
- Admins see all

**Response (200 OK):**
```typescript
{
  data: [
    {
      id: string (CUID);
      employeeId: string;
      month: number;
      year: number;
      basicSalary: number;        // ENCRYPTED (decrypted for admin)
      grossSalary: number;        // ENCRYPTED
      totalDeductions: number;    // ENCRYPTED
      netSalary: number;          // ENCRYPTED
      generatedAt: ISO8601;
    }
  ];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

---

### GET /api/payroll/payslips/:id
Get detailed payslip with all components.

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER` (see team), `EMPLOYEE` (see own)

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeId: string;
    month: number;
    year: number;
    earnings: {
      basicSalary: number;        // DECRYPTED (admin only)
      hra: number | null;
      da: number | null;
      specialAllowance: number | null;
      medicalAllowance: number | null;
      transportAllowance: number | null;
      grossSalary: number;
    };
    deductions: {
      pf: number;                 // Provident Fund
      esic: number;               // Employee Social Insurance
      incomeTax: number;
      other: number;
      totalDeductions: number;
    };
    netSalary: number;            // DECRYPTED (admin only)
    attendancePercentage: number; // Based on working days
    generatedAt: ISO8601;
    paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
    paidAt: ISO8601 | null;
  }
}
```

---

## Self-Service API

Employee self-service endpoints for accessing personal data.

### GET /api/me/profile
Get authenticated user's employee profile.

**Access:** All authenticated users

**Query Parameters:** None

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    employeeCode: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string;
    department: {
      id: string;
      name: string;
    };
    designation: {
      id: string;
      title: string;
    };
    dateOfJoining: ISO8601;
    manager?: {
      id: string;
      firstName: string;
      lastName: string;
    };
    emergencyContact: string | null;
    address: string | null;
  }
}
```

**Note:** PII encryption fields (aadhaar, pan, salary) are never exposed to self-service.

---

### PUT /api/me/profile
Update own profile (limited fields only).

**Access:** All authenticated users

**Request Body:**
```typescript
{
  phone?: string;              // Max 20 chars
  emergencyContact?: string;   // Max 100 chars
  address?: string;            // Max 500 chars
}
```

**Behavior:**
- Employees can update only specific fields
- Cannot change department, designation, or core info

**Response (200 OK):**
```typescript
{
  data: {
    id: string (CUID);
    phone: string | null;
    emergencyContact: string | null;
    address: string | null;
    updatedAt: ISO8601;
  }
}
```

---

### GET /api/me/payslips
Get authenticated user's payslips (filtered by employee).

**Access:** All authenticated users

**Query Parameters:**
```typescript
{
  year?: number;              // Optional. 2000-2100
  page?: number;              // Default: 1
  limit?: number;             // Default: 20. Max 100
}
```

**Response (200 OK):**
```typescript
{
  data: [
    {
      id: string (CUID);
      month: number;
      year: number;
      basicSalary: number | null;      // Hidden (null for non-admin)
      grossSalary: number | null;
      totalDeductions: number | null;
      netSalary: number | null;
      generatedAt: ISO8601;
      paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
    }
  ];
  pagination: { page, limit, total, totalPages };
}
```

---

### GET /api/me/attendance
Get authenticated user's attendance records.

**Access:** All authenticated users

**Query Parameters:**
```typescript
{
  month?: number;             // Optional. 1-12
  year?: number;              // Optional. 2000-2100
  page?: number;              // Default: 1
  limit?: number;             // Default: 20. Max 100
}
```

**Response (200 OK):**
```typescript
{
  data: [
    {
      date: ISO8601;
      checkInTime: ISO8601 | null;
      checkOutTime: ISO8601 | null;
      hoursWorked: number | null;
      status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';
      note: string | null;
    }
  ];
  pagination: { page, limit, total, totalPages };
  monthSummary?: {
    presentDays: number;
    absentDays: number;
    halfDays: number;
    attendancePercentage: number;
  };
}
```

---

### GET /api/me/leaves
Get authenticated user's leave requests.

**Access:** All authenticated users

**Query Parameters:**
```typescript
{
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; // Optional
  year?: number;              // Optional. 2000-2100
  page?: number;              // Default: 1
  limit?: number;             // Default: 20. Max 100
}
```

**Response (200 OK):**
```typescript
{
  data: [
    {
      id: string (CUID);
      leaveType: string;
      startDate: ISO8601;
      endDate: ISO8601;
      daysRequested: number;
      status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
      reason: string;
      reviewNote: string | null;
      createdAt: ISO8601;
    }
  ];
  pagination: { page, limit, total, totalPages };
}
```

---

### GET /api/me/dashboard
Get authenticated user's dashboard summary (quick stats).

**Access:** All authenticated users

**Response (200 OK):**
```typescript
{
  data: {
    employee: {
      id: string;
      employeeCode: string;
      name: string;
      designation: string;
      department: string;
    };
    attendance: {
      currentMonth: {
        presentDays: number;
        absentDays: number;
        halfDays: number;
        attendancePercentage: number;
      };
      lastCheckIn: ISO8601 | null;
      lastCheckOut: ISO8601 | null;
    };
    leave: {
      totalAvailable: number;       // Across all types
      pendingRequests: number;
      approvedThisMonth: number;
    };
    payroll: {
      lastPayslipMonth: number;
      lastPayslipYear: number;
      lastNetSalary: number | null;
    };
  }
}
```

---

## Notifications API

Real-time notifications for leave approvals, payroll events, attendance alerts.

### GET /api/notifications
List user's notifications.

**Access:** All authenticated users (see own notifications)

**Query Parameters:**
```typescript
{
  isRead?: boolean;           // Optional. Filter by read status
  page?: number;              // Default: 1
  limit?: number;             // Default: 20. Max 100
}
```

**Response (200 OK):**
```typescript
{
  data: [
    {
      id: string (CUID);
      userId: string;
      type: 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'PAYROLL_PROCESSED' | 'ATTENDANCE_MARKED' | 'GENERAL'; // Examples
      title: string;
      message: string;
      relatedId: string | null; // e.g., leave request ID
      isRead: boolean;
      createdAt: ISO8601;
    }
  ];
  pagination: { page, limit, total, totalPages };
}
```

---

### GET /api/notifications/unread-count
Get count of unread notifications.

**Access:** All authenticated users

**Response (200 OK):**
```typescript
{
  data: {
    unreadCount: number;
  }
}
```

---

### PUT /api/notifications/:id/read
Mark a single notification as read.

**Access:** All authenticated users (own notifications only)

**Path Parameters:**
```typescript
{
  id: string (CUID) // Required
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string;
    isRead: true;
    readAt: ISO8601;
  }
}
```

---

### PUT /api/notifications/read-all
Mark all notifications as read (bulk).

**Access:** All authenticated users

**Request Body:**
```typescript
{} // Empty body
```

**Response (200 OK):**
```typescript
{
  data: {
    updatedCount: number;
    message: string; // e.g., "5 notifications marked as read"
  }
}
```

---

## Pagination Format

All list endpoints return results with a consistent pagination object:

```typescript
{
  data: T[];
  pagination: {
    page: number;      // Current page (1-indexed)
    limit: number;     // Items per page
    total: number;     // Total items in result set
    totalPages: number; // Math.ceil(total / limit)
  }
}
```

**Calculation:**
```typescript
skip = (page - 1) * limit
```

**Defaults:**
- `page = 1`
- `limit = 10`

**Limits:**
- Minimum `page`: 1
- Minimum `limit`: 1
- Maximum `limit`: 100

---

## RBAC Behavior

Role-based access control matrix:

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|----------|-------------|----------|---------|----------|
| **Core HR** |
| POST /api/departments | ✅ | ✅ | ❌ | ❌ |
| GET /api/departments | ✅ | ✅ | ✅ | ✅ |
| GET /api/departments/:id | ✅ | ✅ | ✅ | ✅ |
| PUT /api/departments/:id | ✅ | ✅ | ❌ | ❌ |
| DELETE /api/departments/:id | ✅ | ✅ | ❌ | ❌ |
| POST /api/designations | ✅ | ✅ | ❌ | ❌ |
| GET /api/designations | ✅ | ✅ | ✅ | ✅ |
| GET /api/designations/:id | ✅ | ✅ | ✅ | ✅ |
| PUT /api/designations/:id | ✅ | ✅ | ❌ | ❌ |
| DELETE /api/designations/:id | ✅ | ✅ | ❌ | ❌ |
| POST /api/employees | ✅ | ✅ | ❌ | ❌ |
| GET /api/employees | ✅ All | ✅ All | Own+Directs | Self |
| GET /api/employees/:id | ✅ All | ✅ All | Own+Directs | Self |
| PUT /api/employees/:id | ✅ | ✅ | ❌ | ❌ |
| DELETE /api/employees/:id | ✅ | ✅ | ❌ | ❌ |
| **Attendance** |
| POST /api/attendance/check-in | ✅ | ✅ | ✅ | ✅ |
| POST /api/attendance/check-out | ✅ | ✅ | ✅ | ✅ |
| POST /api/attendance/regularize | ✅ | ✅ | ❌ | ❌ |
| GET /api/attendance | ✅ All | ✅ All | Own+Directs | Self |
| GET /api/attendance/:id | ✅ All | ✅ All | Own+Directs | Self |
| **Reports** |
| GET /api/reports/attendance/daily | ✅ | ✅ | ✅ | ❌ |
| GET /api/reports/attendance/weekly | ✅ | ✅ | ✅ | ❌ |
| GET /api/reports/attendance/monthly | ✅ | ✅ | ✅ | ❌ |
| **Leave** |
| POST /api/leave/apply | ✅ | ✅ | ✅ | ✅ |
| PUT /api/leave/:id/review | ✅ | ✅ | ✅ | ❌ |
| PUT /api/leave/:id/cancel | ✅ All | ✅ All | Own | Own |
| GET /api/leave | ✅ All | ✅ All | Own+Directs | Self |
| GET /api/leave/:id | ✅ All | ✅ All | Own+Directs | Self |
| **Leave Admin** |
| POST /api/leave-admin/initialize | ✅ | ✅ | ❌ | ❌ |
| POST /api/leave-admin/initialize-all | ✅ | ✅ | ❌ | ❌ |
| POST /api/leave-admin/adjust | ✅ | ✅ | ❌ | ❌ |
| GET /api/leave-admin/balance | ✅ | ✅ | Own+Directs | Own |
| POST /api/leave-admin/carry-forward | ✅ | ✅ | ❌ | ❌ |
| **Payroll** |
| POST /api/payroll/salary-structure | ✅ | ✅ | ❌ | ❌ |
| GET /api/payroll/salary-structure/:id | ✅ | ✅ | Own+Directs | Own |
| POST /api/payroll/run | ✅ | ✅ | ❌ | ❌ |
| POST /api/payroll/run/:id/process | ✅ | ✅ | ❌ | ❌ |
| GET /api/payroll/payslips | ✅ All | ✅ All | Own+Directs | Self |
| GET /api/payroll/payslips/:id | ✅ All | ✅ All | Own+Directs | Self |
| **Self-Service** |
| GET /api/me/profile | ✅ | ✅ | ✅ | ✅ |
| PUT /api/me/profile | ✅ | ✅ | ✅ | ✅ |
| GET /api/me/payslips | ✅ | ✅ | ✅ | ✅ |
| GET /api/me/attendance | ✅ | ✅ | ✅ | ✅ |
| GET /api/me/leaves | ✅ | ✅ | ✅ | ✅ |
| GET /api/me/dashboard | ✅ | ✅ | ✅ | ✅ |
| **Notifications** |
| GET /api/notifications | ✅ | ✅ | ✅ | ✅ |
| GET /api/notifications/unread-count | ✅ | ✅ | ✅ | ✅ |
| PUT /api/notifications/:id/read | ✅ | ✅ | ✅ | ✅ |
| PUT /api/notifications/read-all | ✅ | ✅ | ✅ | ✅ |

**Special Cases:**
- **MANAGER on GET /api/employees:** Returns all employees + direct reports (where `managerId = manager.employeeId`)
- **EMPLOYEE on GET /api/employees:** Returns only self (filtered by `userId`)
- **MANAGER on GET /api/employees/:id:** Can access self or direct reports; cannot access non-subordinate employees (403 Forbidden)
- **EMPLOYEE on GET /api/employees/:id:** Can access self only; 403 Forbidden for others

---

## PII Encryption & Decryption

**Encrypted Fields:**
- `aadhaar` (Indian ID number)
- `pan` (Permanent Account Number)
- `salary` (Compensation amount)

**Encryption Algorithm:** AES-256-GCM (Authenticated Encryption)
- **Key:** 32 bytes (256 bits) from `ENCRYPTION_KEY` environment variable (hex-encoded)
- **IV:** 16 bytes random per encryption
- **Auth Tag:** Validates ciphertext integrity

**Ciphertext Format (stored in DB):**
```
iv:authTag:ciphertext
```
All components are hex-encoded for storage.

**Encryption/Decryption Flow:**

**On Create (POST /api/employees):**
```
Input: { aadhaar: "123456789012", ... }
    ↓
encrypt() — AES-256-GCM with random IV
    ↓
Store: encryptedAadhaar = "abc123def456:fedcba654321:xyzencrypted"
```

**On Read (GET /api/employees/:id):**
```
Store: encryptedAadhaar = "abc123def456:fedcba654321:xyzencrypted"
    ↓
Admin? → decrypt() — extract IV, authTag, ciphertext; verify tag; return plaintext
Non-admin? → strip encrypted fields entirely
    ↓
Response: { aadhaar: "123456789012" } OR { } (no PII fields)
```

**On Update (PUT /api/employees/:id):**
```
Input: { aadhaar: "999999999999", ... }
    ↓
Re-encrypt() with new random IV
    ↓
Store: encryptedAadhaar = "new_iv:new_tag:new_ciphertext"
Previous ciphertext discarded
```

**Admin-Only Decryption:**
- Only `SUPER_ADMIN` and `HR_ADMIN` receive decrypted PII in single-employee GET (`/api/employees/:id`)
- All other roles receive responses with PII fields stripped
- List endpoints (`GET /api/employees`) **never** include decrypted PII (all users)

---

## Error Responses

### Standard Error Format

All error responses follow this structure:

```typescript
{
  error: string;    // Error type (e.g., "Validation Error", "Not Found", "Conflict")
  message: string;  // Human-readable description
}
```

### Common HTTP Status Codes

| Status | Error Type | Scenario |
|--------|-----------|----------|
| 400 | Validation Error | Zod schema validation failed |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Insufficient role permissions or RBAC violation |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Business logic conflict (duplicate, active employees, etc.) |
| 500 | Internal Error | Unexpected server error |

### Example Error Responses

**Validation Failure:**
```json
{
  "error": "Validation Error",
  "message": "String must contain at least 1 character"
}
```

**Authorization Failure:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**Business Logic Conflict:**
```json
{
  "error": "Conflict",
  "message": "Department name already exists"
}
```

**RBAC Violation:**
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

---

## Audit Trail

All mutation endpoints (POST, PUT, DELETE) automatically log:

```typescript
{
  userId: string;          // ID of user performing action
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: 'Department' | 'Designation' | 'Employee';
  resourceId: string;      // ID of affected resource
  details: object;         // Endpoint-specific details
  ipAddress: string;       // Request IP
  userAgent: string;       // User-Agent header
  timestamp: ISO8601;      // Auto-set by DB
}
```

**Audit logging is fire-and-forget** — errors in audit logging do not block the main request.

---

## Implementation Notes

- **Typecheck:** All endpoints pass TypeScript strict mode
- **Validation:** Zod schemas enforced at route handler entry
- **Transactions:** Foreign key validation happens before record creation
- **Soft Deletes:** `isActive` flag for departments/designations; `status = TERMINATED` for employees
- **Timestamps:** `createdAt` and `updatedAt` auto-managed by Prisma
- **Error Handling:** All errors caught and returned with appropriate status codes
- **Encryption:** Application-layer, transparent to consumers (decryption happens in service layer)

---

**Last Updated:** 2026-02-27
**API Version:** 2.0.0 (Layers 3A–3G Complete)
**Branch:** feature/layer-3-core-hr
**Coverage:** 39 endpoints across 9 modules (Core HR, Attendance, Reports, Leave, Leave Admin, Payroll, Self-Service, Notifications)
**Security:** RLS + RBAC + Encryption (AES-256-GCM for payroll)

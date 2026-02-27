# Core HR API Documentation (Layer 3A)

> Complete endpoint reference for Departments, Designations, and Employees modules. Includes request/response schemas, RBAC rules, PII encryption, pagination, and error handling.

---

## 📋 Table of Contents

1. [Departments API](#departments-api)
2. [Designations API](#designations-api)
3. [Employees API](#employees-api)
4. [Pagination Format](#pagination-format)
5. [RBAC Behavior](#rbac-behavior)
6. [PII Encryption & Decryption](#pii-encryption--decryption)
7. [Error Responses](#error-responses)

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
**API Version:** 1.0.0
**Branch:** feature/layer-3-core-hr

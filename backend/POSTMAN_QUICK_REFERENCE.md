# 🚀 Postman Quick Reference - API Endpoints

## 🔐 Auth Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/auth/login` | ❌ | Login with username/email + password |
| `POST` | `/auth/refresh` | ❌ | Refresh access token (cookie auto-sent) |
| `POST` | `/auth/logout` | ✅ | Logout current session |
| `GET` | `/auth/me` | ✅ | Get current user info + roles/permissions |

### Login Request
```json
{
  "identifier": "admin",  // email or username
  "password": "password123"
}
```

### Login Response
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "user": {
      "id": "507f...",
      "username": "admin",
      "email": "admin@soosky.co",
      "roles": ["admin"],
      "permissions": ["*"],
      "mustChangePassword": false
    }
  }
}
```

---

## 👥 User Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/users` | ✅ | Create new user |
| `GET` | `/users` | ✅ | List users (with filters) |
| `GET` | `/users/:id` | ✅ | Get single user |
| `PATCH` | `/users/:id` | ✅ | Update user |
| `DELETE` | `/users/:id` | ✅ | Delete user (soft-delete) |

### Create User
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "employeeId": "507f1f77bcf86cd799439011"  // optional
}
```

### Update User
```json
{
  "email": "newemail@example.com",          // optional
  "status": "disabled",                      // optional: active|disabled|locked
  "mustChangePassword": true                 // optional
}
```

### Query Filters
```
GET /users?status=active&search=john
```
- `status` — Filter by user status
- `search` — Search username or email (case-insensitive)

---

## 🔑 Role Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/roles` | ✅ | Create new role |
| `GET` | `/roles` | ✅ | List all roles |
| `GET` | `/roles/:id` | ✅ | Get single role |
| `PATCH` | `/roles/:id` | ✅ | Update role |
| `DELETE` | `/roles/:id` | ✅ | Delete role (custom only) |

### Create Role
```json
{
  "name": "department_head",
  "description": "Department Manager",
  "permissionIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ]
}
```

### Update Role
```json
{
  "description": "Updated description",
  "permissionIds": ["507f1f77bcf86cd799439011"]
}
```

### Special Notes
- ❌ Cannot modify/delete system roles (admin, hr_manager, employee)
- ✅ Can create, update, delete custom roles
- ✅ Permissions can be added/removed on update

---

## 🛡️ Permission Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/permissions` | ✅ | Create new permission |
| `GET` | `/permissions` | ✅ | List all permissions |
| `GET` | `/permissions/:id` | ✅ | Get single permission |
| `PATCH` | `/permissions/:id` | ✅ | Update permission |
| `DELETE` | `/permissions/:id` | ✅ | Delete permission |

### Create Permission
```json
{
  "key": "employee:create",           // must be unique
  "resource": "employee",              // resource name
  "action": "create",                  // create|read|update|delete|approve
  "description": "Can create employees"
}
```

### Update Permission
```json
{
  "description": "Updated description"
}
```

### Valid Actions
- `create` — Create resource
- `read` — Read/view resource
- `update` — Update resource
- `delete` — Delete resource
- `approve` — Approve resource (workflows)

---

## 🎯 Common Patterns

### Get Token (first request)
```bash
# Login → save accessToken to {{accessToken}}
POST /auth/login
{
  "identifier": "admin",
  "password": "password123"
}

# Use token in all subsequent requests
GET /users
Header: Authorization: Bearer {{accessToken}}
```

### Create and Link Resources
```bash
# 1. Create permissions
POST /permissions → save permissionId1, permissionId2

# 2. Create role with those permissions
POST /roles
{
  "name": "manager",
  "permissionIds": ["{{permissionId1}}", "{{permissionId2}}"]
}

# 3. Assign role to user (later, via user-role endpoint)
```

### Error Codes
| Code | Status | Meaning |
|------|--------|---------|
| `IAM_001` | 401 | Invalid credentials |
| `IAM_002` | 401/404 | User not found / Unauthenticated |
| `IAM_003` | 403 | Account disabled/locked |
| `IAM_004` | 409 | Email/username already exists |
| `IAM_005` | 401 | Refresh token invalid/missing |
| `IAM_006` | 409 | Role name already exists |
| `IAM_007` | 404 | Role not found |
| `IAM_008` | 403 | Cannot modify system role |
| `IAM_009` | 409 | Permission key already exists |
| `IAM_010` | 404 | Permission not found |
| `SYS_002` | 422 | Validation error |

---

## 📝 Environment Variables in Postman

### Pre-filled (set automatically)
```
{{baseUrl}}          = http://localhost:3000/api/v1
{{accessToken}}      = Set by login response
{{refreshToken}}     = Set by login response
{{userId}}           = Set by login response
{{newUserId}}        = Set by create user response
{{roleId}}           = Set by create role response
{{permissionId1}}    = Set by create permission response
{{permissionId2}}    = Set by create 2nd permission response
```

### To change baseUrl
1. Click **Environment** dropdown (top-right)
2. Edit `baseUrl` variable

---

## ✅ Validation Rules

### Users
- ✅ Username: min 3, max 120 chars
- ✅ Email: valid email format
- ✅ Password: min 8, max 200 chars
- ✅ EmployeeId: 24-char MongoDB ObjectId (optional)

### Roles
- ✅ Name: min 1, max 120 chars, unique
- ✅ Description: max 500 chars
- ✅ PermissionIds: array of 24-char ObjectIds

### Permissions
- ✅ Key: unique, min 1, max 120 chars
- ✅ Resource: min 1, max 120 chars
- ✅ Action: enum [create|read|update|delete|approve]
- ✅ Description: max 500 chars

---

## 🔄 Token Lifecycle

```
┌─────────────────────────────────────────┐
│ 1. Login                                 │
│ POST /auth/login                         │
│ → Get accessToken (15m) + refreshToken   │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────▼──────────────┐
    │ 2. Use accessToken           │
    │ GET /users                   │
    │ Header: Authorization: Bearer │
    │ Valid for 15 minutes          │
    └──────────────┬───────────────┘
                   │
    ┌──────────────▼──────────────┐
    │ 3. Token expires            │
    │ Receive 401 Unauthorized    │
    └──────────────┬───────────────┘
                   │
    ┌──────────────▼──────────────┐
    │ 4. Refresh token            │
    │ POST /auth/refresh           │
    │ Cookie sent auto            │
    │ → Get new accessToken        │
    └──────────────┬───────────────┘
                   │
    ┌──────────────▼──────────────┐
    │ 5. Use new token             │
    │ Continue requests...          │
    │ Repeat from step 2            │
    └──────────────────────────────┘
```

---

## 🧪 Test Execution Order

For collection to work properly (auto-saves variables):

1. ✅ Auth → Login (saves `{{accessToken}}`)
2. ✅ Users → Create User (saves `{{newUserId}}`)
3. ✅ Users → List/Get/Update/Delete
4. ✅ Permissions → Create (saves `{{permissionId1}}`, `{{permissionId2}}`)
5. ✅ Roles → Create/List/Get/Update/Delete
6. ✅ Complex Scenarios

**Don't jump around** — Each request depends on variables from previous ones.

---

## 💾 Save Data for Later

If you want to test specific endpoints repeatedly:

1. **After Login** → Copy `accessToken` value
2. **After Create** → Copy `id` values
3. **Paste into request URL/header** directly

Example:
```
GET /users/507f1f77bcf86cd799439011
Header: Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 🚀 Running in Postman

### Automatic Mode (Recommended)
1. Click **Run** (collection level)
2. Select entire collection
3. Click **Run Soosky HRM IAM**
4. Watch all tests execute automatically
5. View results and failures

### Manual Mode
1. Click each request one by one
2. Click **Send**
3. Check **Tests** tab for results
4. Review response body

---

**Base URL:** `http://localhost:3000/api/v1`

**Auth Header Format:** `Bearer {accessToken}`

**Response Format:**
```json
{
  "data": { /* result */ },
  "meta": { /* pagination if applicable */ },
  "code": "ERROR_CODE",  // only on error
  "message": "Error description"  // only on error
}
```

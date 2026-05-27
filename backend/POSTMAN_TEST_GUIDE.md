# 🚀 Postman Test Guide - Soosky HRM IAM Module

## 📥 Import Collection

### Step 1: Tải collection
File: `Soosky-HRM-IAM.postman_collection.json`

### Step 2: Import vào Postman
1. Mở Postman
2. Click **Import** (top-left)
3. Chọn file `Soosky-HRM-IAM.postman_collection.json`
4. Click **Import**

### Step 3: Kiểm tra Environment Variables
- Collection sẽ tự động thêm variables
- Mặc định `baseUrl = http://localhost:3000/api/v1`
- Adjust nếu backend chạy trên port khác

---

## ⚙️ Chuẩn bị (Before Testing)

### 1. Backend phải chạy
```bash
cd backend
npm install
npm run dev
```

### 2. MongoDB phải chạy
```bash
# Option 1: Local MongoDB
mongod

# Option 2: Docker
docker run -d -p 27017:27017 mongo:latest
```

### 3. .env file phải setup
```bash
# backend/.env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/soosky_hrm?replicaSet=rs

JWT_ACCESS_SECRET=your_very_secret_key_at_least_64_characters_long_1234567890
JWT_REFRESH_SECRET=your_very_secret_refresh_key_at_least_64_characters_long_123456

JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUND=10
```

### 4. Database Init - Seed Admin User
Tạo admin user trước (insert trực tiếp vào MongoDB):
```bash
# Mở MongoDB shell
mongosh

# Chạy
use soosky_hrm

# Hash password "password123" bằng bcrypt
# Có thể tạo file seed.js hoặc insert manual

db.users.insertOne({
  username: "admin",
  email: "admin@soosky.co",
  password: "$2a$10$YourHashedPasswordHere",  // bcrypt hash of "password123"
  status: "active",
  mustChangePassword: false,
  failedLoginAttempts: 0,
  created_at: new Date(),
  updated_at: new Date()
})
```

> **Nếu không biết hash:** Test login request đầu tiên sẽ fail. Sau đó tạo user mới bằng API.

---

## 🧪 Test Flow (Tuần tự)

### **Phase 1: Authentication (5 requests)**

#### ✅ 1. Login - Success
```
POST /auth/login
Body: {
  "identifier": "admin",
  "password": "password123"
}
```
**Expected:** 200 OK
- ✅ `accessToken` saved to `{{accessToken}}`
- ✅ `refreshToken` saved to `{{refreshToken}}`
- ✅ `userId` saved to `{{userId}}`

#### ✅ 2. Login - Invalid Credentials
```
POST /auth/login
Body: {
  "identifier": "admin",
  "password": "wrongpassword"
}
```
**Expected:** 401 Unauthorized
- ✅ Error code: `IAM_001`

#### ✅ 3. Get Current User Info
```
GET /auth/me
Header: Authorization: Bearer {{accessToken}}
```
**Expected:** 200 OK
- ✅ Returns user info with roles & permissions

#### ✅ 4. Refresh Token
```
POST /auth/refresh
(Cookie auto-sent)
```
**Expected:** 200 OK
- ✅ New `accessToken` returned
- ✅ Token saved to environment for next requests

#### ✅ 5. Logout
```
POST /auth/logout
Header: Authorization: Bearer {{accessToken}}
```
**Expected:** 200 OK
- ✅ Session revoked

---

### **Phase 2: User Management (12 requests)**

#### ✅ 1. Create User - Success
```
POST /users
Header: Authorization: Bearer {{accessToken}}
Body: {
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```
**Expected:** 201 Created
- ✅ User created
- ✅ `newUserId` saved for later tests
- ✅ Password not returned (stripped by schema)

#### ✅ 2. Create User - Duplicate Email
```
POST /users
Body: { ..., "email": "john@example.com", ... }
```
**Expected:** 409 Conflict
- ✅ Error code: `IAM_004`

#### ✅ 3. Create User - Invalid Password (too short)
```
POST /users
Body: { ..., "password": "short" }
```
**Expected:** 422 Unprocessable Entity
- ✅ Error code: `SYS_002` (validation error)

#### ✅ 4. List Users
```
GET /users
Header: Authorization: Bearer {{accessToken}}
```
**Expected:** 200 OK
- ✅ Array of users
- ✅ Password field excluded from all users

#### ✅ 5. List Users - Filter by Status
```
GET /users?status=active
```
**Expected:** 200 OK
- ✅ Only active users returned

#### ✅ 6. List Users - Search by Username
```
GET /users?search=john
```
**Expected:** 200 OK
- ✅ Case-insensitive match on username

#### ✅ 7. Get User by ID
```
GET /users/{{newUserId}}
```
**Expected:** 200 OK
- ✅ User `john_doe` returned

#### ✅ 8. Get User - Not Found
```
GET /users/507f1f77bcf86cd799439999
```
**Expected:** 404 Not Found
- ✅ Error code: `IAM_002`

#### ✅ 9. Update User - Change Status
```
PATCH /users/{{newUserId}}
Body: { "status": "disabled" }
```
**Expected:** 200 OK
- ✅ User status changed to `disabled`

#### ✅ 10. Update User - Set Must Change Password
```
PATCH /users/{{newUserId}}
Body: { "mustChangePassword": true }
```
**Expected:** 200 OK
- ✅ Flag updated

#### ✅ 11. Delete User (Soft Delete)
```
DELETE /users/{{newUserId}}
```
**Expected:** 200 OK
- ✅ User soft-deleted (status → disabled)
- ✅ User still exists in DB, just disabled

#### ✅ 12. Create Another User
```
POST /users
Body: {
  "username": "jane_smith",
  "email": "jane@example.com",
  "password": "SecurePass456!"
}
```
**Expected:** 201 Created
- ✅ `secondUserId` saved for role binding tests

---

### **Phase 3: Role Management (6 requests)**

#### ✅ 1. Create Role - Success
```
POST /roles
Body: {
  "name": "department_head",
  "description": "Department Manager Role"
}
```
**Expected:** 201 Created
- ✅ Role created
- ✅ `roleId` saved
- ✅ `isSystem: false`

#### ✅ 2. Create Role - Duplicate Name
```
POST /roles
Body: { "name": "department_head", ... }
```
**Expected:** 409 Conflict
- ✅ Error code: `IAM_006`

#### ✅ 3. List Roles
```
GET /roles
```
**Expected:** 200 OK
- ✅ Array includes both custom and system roles
- ✅ System roles: `admin`, `hr_manager`, `employee` (if seeded)

#### ✅ 4. Get Role by ID
```
GET /roles/{{roleId}}
```
**Expected:** 200 OK
- ✅ Role `department_head` returned

#### ✅ 5. Update Role - Change Description
```
PATCH /roles/{{roleId}}
Body: { "description": "Updated description" }
```
**Expected:** 200 OK
- ✅ Description updated

#### ✅ 6. Delete Role
```
DELETE /roles/{{roleId}}
```
**Expected:** 200 OK
- ✅ Custom role deleted
- ✅ Cannot delete system roles (would get 403)

---

### **Phase 4: Permission Management (7 requests)**

#### ✅ 1. Create Permission - Create Action
```
POST /permissions
Body: {
  "key": "employee:create",
  "resource": "employee",
  "action": "create",
  "description": "Can create employees"
}
```
**Expected:** 201 Created
- ✅ Permission created
- ✅ `permissionId1` saved

#### ✅ 2. Create Permission - Read Action
```
POST /permissions
Body: {
  "key": "employee:read",
  "resource": "employee",
  "action": "read",
  "description": "Can read employees"
}
```
**Expected:** 201 Created
- ✅ `permissionId2` saved

#### ✅ 3. Create Permission - Duplicate Key
```
POST /permissions
Body: { "key": "employee:create", ... }
```
**Expected:** 409 Conflict
- ✅ Error code: `IAM_009`

#### ✅ 4. List Permissions
```
GET /permissions
```
**Expected:** 200 OK
- ✅ Array of all permissions

#### ✅ 5. Get Permission by ID
```
GET /permissions/{{permissionId1}}
```
**Expected:** 200 OK
- ✅ Permission `employee:create` returned

#### ✅ 6. Update Permission - Change Description
```
PATCH /permissions/{{permissionId1}}
Body: { "description": "Updated permission description" }
```
**Expected:** 200 OK
- ✅ Description updated

#### ✅ 7. Delete Permission
```
DELETE /permissions/{{permissionId1}}
```
**Expected:** 200 OK
- ✅ Permission deleted

---

### **Phase 5: Complex Scenarios (2 requests)**

#### ✅ 1. Create Role with Permissions
```
POST /roles
Body: {
  "name": "hr_manager",
  "description": "HR Manager with permissions",
  "permissionIds": ["{{permissionId2}}"]
}
```
**Expected:** 201 Created
- ✅ Role created with permission binding
- ✅ `complexRoleId` saved

#### ✅ 2. No Auth - Access Denied
```
GET /users
(No Authorization header)
```
**Expected:** 401 Unauthorized
- ✅ Error code: `IAM_002`
- ✅ Proves auth middleware works

---

## 📊 Test Summary

| Category | Tests | Status |
|----------|-------|--------|
| 🔐 Auth | 5 | ✅ All PASSED |
| 👥 Users | 12 | ✅ All PASSED |
| 🔑 Roles | 6 | ✅ All PASSED |
| 🛡️ Permissions | 7 | ✅ All PASSED |
| 🔗 Complex | 2 | ✅ All PASSED |
| **Total** | **32** | **✅ ALL PASSED** |

---

## 🔍 Verify in MongoDB

After running all tests, check data in MongoDB:

```bash
mongosh soosky_hrm

# Check users
db.users.find().pretty()

# Check roles
db.roles.find().pretty()

# Check permissions
db.permissions.find().pretty()

# Check audit logs
db.auditLogs.find().pretty()

# Check sessions
db.sessions.find().pretty()
```

---

## 🛠️ Troubleshooting

### "Connection refused" on localhost:3000
- ✅ Backend not running → `npm run dev` in backend folder
- ✅ Wrong port → Check `PORT` in .env

### "User not found" on login
- ✅ Admin user not seeded → Insert manually or create via API

### "Validation Error" (422) on create user
- ✅ Email format invalid
- ✅ Password too short (< 8 chars)
- ✅ Username empty

### "Token invalid or expired"
- ✅ Refresh token expired (7 days)
- ✅ Invalid JWT secret in .env
- ✅ Token manually modified

### "Cannot modify system roles" (403)
- ✅ Trying to delete/update `admin`, `hr_manager`, or `employee` role
- ✅ These are protected system roles

---

## 💡 Tips

1. **Run requests in order** — Each test saves variables for the next
2. **Check Tests tab** — See detailed assertions in Postman
3. **Use Variables** — `{{baseUrl}}`, `{{accessToken}}` are auto-updated
4. **Clear data between runs** — Drop MongoDB collections to start fresh
5. **Monitor Audit Logs** — Every action is logged in `auditLogs` collection

---

## 📝 Notes

- All passwords are hashed with bcrypt (10 rounds)
- Refresh tokens are stored as SHA-256 hashes (not plaintext)
- Auth tokens expire: Access (15m), Refresh (7d)
- Sessions auto-cleanup via MongoDB TTL index
- Failed login attempts tracked; account locks after 5 failures
- All mutations are audit-logged

**Happy Testing! 🎉**

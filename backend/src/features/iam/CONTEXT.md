# IAM Feature — Identity & Access Management

## Overview

Handles all authentication, authorization, user management, roles, permissions, and audit logging.

## Entities

- **User** — account credentials, status (active/disabled/locked), login attempt tracking
- **Role** — permission groups (admin, hr_manager, employee); system roles are immutable
- **Permission** — granular access control (resource:action, e.g., `employee:create`)
- **UserRole** — junction between users and roles; supports temporary grants via `expiresAt`
- **RolePermission** — junction between roles and permissions
- **Session** — refresh token storage (hashed); TTL-based auto-cleanup via MongoDB TTL index
- **AuditLog** — all mutations (login, create, update, delete) with optional change tracking

## Key Flows

### 1. Login
- `POST /api/v1/auth/login` → `authService.login()`
  - Verify credentials (username or email + password)
  - Check user status (active/disabled/locked)
  - Increment failed attempts on password mismatch; lock after 5 attempts
  - Resolve active roles & permissions
  - Issue access + refresh tokens
  - Create session record with hashed refresh token
  - Emit event + audit log

### 2. Refresh
- `POST /api/v1/auth/refresh` → `authService.refresh()`
  - Validate refresh token (JWT)
  - Find active session matching token hash (reuse detection)
  - Rotate refresh token (new hash + TTL on session)
  - Issue new access token
  - Audit log + event emit

### 3. Logout
- `POST /api/v1/auth/logout` → `authService.logout()`
  - Revoke session (set `revokedAt`)
  - Audit log + event emit

### 4. User Management
- `POST /api/v1/users` → `userService.create()` — create user account
- `GET /api/v1/users` → `userService.list()` — list users with optional filters
- `GET /api/v1/users/:id` → `userService.findById()` — fetch single user
- `PATCH /api/v1/users/:id` → `userService.update()` — update status, email, password flag
- `DELETE /api/v1/users/:id` → `userService.delete()` — soft-delete (status→disabled)

### 5. Role Management
- `POST /api/v1/roles` → `roleService.create()` — create custom role + bind permissions
- `GET /api/v1/roles` → `roleService.list()` — list all roles
- `GET /api/v1/roles/:id` → `roleService.findById()` — fetch single role
- `PATCH /api/v1/roles/:id` → `roleService.update()` — update description, reassign permissions
- `DELETE /api/v1/roles/:id` → `roleService.delete()` — hard-delete (unless system role)

### 6. Permission Management
- `POST /api/v1/permissions` → `permissionService.create()` — define new permission
- `GET /api/v1/permissions` → `permissionService.list()` — list all permissions
- `GET /api/v1/permissions/:id` → `permissionService.findById()` — fetch single permission
- `PATCH /api/v1/permissions/:id` → `permissionService.update()` — update description
- `DELETE /api/v1/permissions/:id` → `permissionService.delete()` — remove permission

## Token Strategy

**Access Token** (15 min):
- Subject: `userId`
- Payload: `{ roles, permissions, mustChangePassword, sessionId }`
- Used for every request; verify in `authenticate` middleware
- No blacklist; expiration is the revocation mechanism

**Refresh Token** (7 days, rotated on each use):
- Subject: `userId`
- Payload: `{ sessionId, tokenVersion }`
- Stored hashed in `Session` for reuse detection
- On rotation: old hash replaced with new hash + new TTL
- If hash mismatch on refresh: reuse detected → revoke all sessions for user

## Error Codes

| Code | Meaning |
| --- | --- |
| `IAM_001` | Invalid credentials (login failed) |
| `IAM_002` | User not found / Unauthenticated |
| `IAM_003` | Account disabled/locked |
| `IAM_004` | Username/email already exists |
| `IAM_005` | Refresh token invalid/missing |
| `IAM_006` | Role name already exists |
| `IAM_007` | Role not found |
| `IAM_008` | Cannot modify/delete system roles |
| `IAM_009` | Permission key already exists |
| `IAM_010` | Permission not found |

## Audit Logging

All mutations are logged to `AuditLog` collection:
- **User actions**: login, login-failed, login-blocked, logout, refresh, session-reuse
- **Admin actions**: user/role/permission create, update, delete

Audit writes are fire-and-forget (errors logged but don't block the user request).

## Dependencies

- ✅ `core/logger`, `core/events` — logging, event bus
- ✅ `shared/errors`, `shared/utils/hash` — error types, hashing
- ✅ Models: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Session`, `AuditLog`
- ❌ No cross-feature dependencies (IAM is foundational)

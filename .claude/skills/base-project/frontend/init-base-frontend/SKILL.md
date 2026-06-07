---
name: init-base-frontend
description: >
  Initialize a clean frontend foundation using Vite + React + TypeScript by detecting existing setup, asking framework preferences, and installing only essential base dependencies without generating business features, pages, layouts, auth flow, API services, or feature-specific modules.

  Use when user says: 
  - init frontend
  - create frontend app
  - setup vite
  - create react project
  - khởi tạo frontend
  - tạo project react
argument-hint: "[frontend]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# Pre-flight Checks:

1. Ensure argument is exactly `frontend` - If missing, ask the user.

2. Detect existing frontend folder - Check: `frontend/`

3. If project already exists: - Verify `package.json`

4. Ask version preferences: - latest stable - or custom versions

5. Ask package manager: - pnpm (recommended) - npm - yarn

6. Warn before overwriting existing files.

# Responsibilities - Initialize Vite + React + TS - Install foundational dependencies - Prepare clean project base

# Do NOT - generate feature code - create business modules - create auth implementation - create layouts/pages - create API services

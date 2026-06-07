---
name: setup-frontend-config
description: >
  Configure frontend project tooling and developer environment.
  Focuses on:
  - tsconfig
  - vite config
  - eslint
  - prettier
  - env setup
  - path aliases implementation

  Does NOT generate architecture or business modules.

  Use when user says:

  - setup frontend config
  - configure vite
  - setup tsconfig
  - setup eslint
  - setup prettier
  - setup frontend tooling
argument-hint: "[frontend]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# Pre-flight Checks

1. Verify frontend project exists. - Check `frontend/package.json`

2. Detect framework:

- React
- Vite
- Next.js

3. Detect language:

- TypeScript
- JavaScript

4. Check existing config files:

- tsconfig.json
- vite.config.ts
- eslint config
- prettier config

5. Ask before overwriting existing configs.

# Responsibilities

- Configure TypeScript settings.
- Configure Vite/Next.js project settings.
- Configure ESLint and Prettier.
- Configure environment files.
- Configure path aliases implementation.
- Configure developer tooling consistency.

# Do NOT

- create frontend architecture
- generate feature modules
- generate pages/layouts
- generate business logic
- install UI libraries
- generate auth implementation

# Configuration Rules

## Typescript

Configure:

- strict mode
- baseUrl
- path aliases
- module resolution
- type safety defaults

Example aliases:

{
"@/_": ["src/_"],
"@/shared/_": ["src/shared/_"],
"@/features/_": ["src/features/_"],
"@/core/_": ["src/core/_"]
}

# Vite Configuration

Configure:

- alias resolution
- environment support
- build defaults
- development server settings

Do NOT:

- modify business logic
- install plugins automatically unless requested

# ESLint Configuration

Configure:

- TypeScript linting
- React hooks rules
- import ordering
- unused imports detection

Recommended:

- eslint-plugin-import
- eslint-plugin-react-hooks

# Prettier Configuration

Configure:

- consistent formatting
- import formatting
- trailing commas
- quote style

# Environment Configuration

Create:

- .env
- .env.example

Configure:

- typed environment variables convention
- frontend-safe variable naming

# Alias Implementation Rules

Implement aliases consistently in:

- tsconfig.json
- vite.config.ts
- next.config.js

Aliases should follow architecture conventions defined by:

- setup-frontend-architecture

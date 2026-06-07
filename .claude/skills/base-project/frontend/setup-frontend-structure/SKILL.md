---
name: setup-frontend-structure
description: >
  Setup scalable frontend folder structure using feature-based architecture.
  Configure barrel exports, path aliases, and clean architectural boundaries. 

  Focuses on:
  - folder structure
  - feature organization
  - architectural boundaries
  - barrel exports
  - code organization conventions

  Does NOT configure tooling or project configs.

  Use when user says: 
  - setup frontend structure
  - create frontend architecture
  - setup feature structure
  - organize frontend folders
  - setup scalable frontend

argument-hint: "[frontend]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# Pre-flight Checks

1. Verify `frontend/package.json` exists. - Abort if missing with error message.

2. Verify `src/` exists. - Create if missing with `mkdir -p src`.

3. Detect framework:

- React
- Vite
- Next.js

4. Detect language:

- TypeScript
- JavaScript

5. Detect existing architecture.

- If `src/features/*` already exists: ask before overwriting.
  - List existing features
  - Ask: "Overwrite existing structure? (yes/no/merge)"
  - Abort if user says no.

4. Check framework:

- Detect if React (check dependencies for 'react')
- Detect if Vite (check for 'vite' or `vite.config.ts`)
- Detect if Next.js (check for 'next')

5. Ask project scale:

- Small (1-5 features)
- Medium (6-20 features)
- Large (21+ features)

# Responsibilities

- Create scalable frontend folder structure.
- Organize source code by architecture level.
- Create barrel exports (index.ts).
- Add architecture documentation comments.
- Define module boundaries and conventions.
- Keep structure understandable for the team.

# Architecture Selection Rules

## 1. Beginner Architecture

Use when:

- small project
- fresher/junior team
- MVP
- internal tools
- landing pages

**Structure:**

src/
├── components/ # Reusable UI components shared across pages
├── pages/ # Application pages/screens
├── hooks/ # Shared custom React hooks
├── services/ # API calls and external requests
├── utils/ # Utility/helper functions
├── types/ # Global TypeScript types
├── styles/ # Global styles and theme files
└── assets/ # Static assets (images, icons, fonts)

## 2. Intermediate Architecture

Use when:

- medium project
- multiple business domains
- growing team
- reusable features starting to appear

**Structure:**

src/
├── app/ # App initialization and global providers
│
├── shared/ # Reusable modules shared across features
│ ├── ui/ # Shared UI components
│ ├── hooks/ # Shared hooks
│ ├── utils/ # Shared helper functions
│ └── types/ # Shared TypeScript types
│
├── features/ # Business/domain features
│ └── [feature-name]/
│ ├── components/ # Feature UI components
│ ├── hooks/ # Feature-specific hooks
│ ├── services/ # Feature API/business logic
│ ├── types/ # Feature types
│ └── index.ts # Barrel export
│
├── pages/ # Route-level pages
└── assets/ # Static assets

## 3. Scalable Architecture

Use when:

- long-term product
- SaaS
- HRM/CRM/ERP systems
- multiple teams
- large feature set

**Structure:**

src/
├── app/ # App bootstrap, routes, providers, global store
│ ├── providers/ # React providers (theme, query, auth)
│ ├── routes/ # Route configuration
│ └── store/ # Global state management
├── core/ # Framework/business agnostic core logic
│ ├── api/ # HTTP client, interceptors, API base config
│ ├── config/ # Environment configuration
│ ├── constants/ # Global constants
│ └── utils/ # Pure utility functions
|
├── shared/ # Reusable modules shared across app
│ ├── ui/ # Shared UI components
│ ├── hooks/ # Shared hooks
│ ├── lib/ # Shared libraries/helpers
│ ├── types/ # Shared types/interfaces
│ └── utils/ # Shared utility functions
├── features/ # Self-contained business features
│ └── [feature-name]/
│ ├── components/ # Feature UI components
│ ├── hooks/ # Feature hooks
│ ├── services/ # Feature business logic + API calls
│ ├── store/ # Feature state management
│ ├── types/ # Feature types
│ ├── utils/ # Feature utilities
│ └── index.ts # Main feature barrel export
├── widgets/ # Complex composed UI blocks
│ └── [widget-name]/
│ ├── components/ # Widget internal components
│ ├── types.ts # Widget types
│ └── index.ts # Widget export
└── assets/ # Static assets

## 4. Enterprise Architecture

Use when:

- very large organization
- multiple frontend teams
- microfrontend ecosystem
- strict architecture governance

**Structure:**
src/
├── app/ # Application composition layer
├── core/ # Infrastructure and framework core
├── shared/ # Shared reusable modules
├── entities/ # Enterprise business entities
├── features/ # Feature modules
├── widgets/ # Composite business widgets
├── processes/ # Cross-feature workflows
└── pages/ # Route-level pages

### Barrel Export Rules

Create index.ts for:

- shared modules
- features
- widgets
- reusable folders

Example:

export _ from './components';
export _ from './hooks';
export _ from './services';
export _ from './types';

### Path Alias Rules

Configure aliases:

@/app
@/core
@/shared
@/features
@/widgets
@/pages

Sync aliases in:

tsconfig.json
vite.config.ts
next.config.js

### Architecture Boundary Rules

- shared cannot import from features
- core cannot import from app
- features should avoid direct coupling with other features
- widgets may compose multiple features
- business logic should stay inside features

# Do NOT

- config vite, modify tsconfig, setup eslint/prettier
- configure path aliases implementation
- install dependencies automatically
- generate business features
- generate authentication implementation
- generate pages/screens automatically
- generate backend services
- generate fake demo data
- over-engineer small projects

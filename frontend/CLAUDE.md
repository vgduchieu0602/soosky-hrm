# Frontend: Soosky HRM

## Tech Stack

- React 19 + Vite: fast dev server, modern React features
- TypeScript: type safety, better DX, catch errors early
- TanStack Query: server state management, caching, auto-refetch
- Zustand: minimal global state (auth, cart only)
- Tailwind CSS: utility-first, fast styling, consistent design
- Axios: interceptors for auth, error handling
- React Router v7: modern routing, type-safe routes, improved data loading

## Documentation

### Must Read

- @docs/FE-PROJECT-RULES.md - Conventions, patterns, MUST/MUST NOT
- @docs/FE-ARCHITECTURE.md - Folder structure, components, state

### Reference

- @../01-share-docs/API_SPEC.md - API contract to consume

## Design System (UI/UX Pro Max)

Before building or refactoring any UI, read **@design-system/soosky-hrm/MASTER.md** (global source of truth: style, colors, typography, effects, anti-patterns).
When working on a specific page, first check `design-system/soosky-hrm/pages/<page>.md` — if it exists, its rules override MASTER.md; otherwise use MASTER.md.

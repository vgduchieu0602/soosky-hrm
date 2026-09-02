# Backend: Soosky HRM

## Tech Stack

- Language: TypeScript
- Framework: Express.js
- ODM: Mongoose
- Database: MongoDB (replica set — transactions are used)
- Validation: Zod
- Logging: Pino
- Tests: Vitest (`npm test`)

## Documentation

### Must Read

- @docs/BE-PROJECT-RULES.md - Conventions, patterns, MUST/MUST NOT
- @docs/BE-ARCHITECTURE.md - Module layout, layers, module anatomy

### Reference

- @../01-share-docs/API_SPEC.md - API contract
- @../01-share-docs/DATABASE.md - Schema

## Quick Reference

### Layout

```
src/
├── server.ts          # bootstrap
├── infra/             # config · db · logger · events · mail · express factory
├── shared/            # only what 2+ modules use (http middleware, errors, crypto, types)
└── modules/
    ├── auth/          # "who is this user?"  login · sessions · JWT · password links
    ├── iam/           # "what may they do?"  users · roles · permissions · audit
    └── hrm/           # HR business: employee · attendance · payroll · performance ·
                       # organization · settings · period · dashboard · notification · storage
```

Each module: `core/` (framework-free domain + use-cases + ports) ·
`adapters/` (http, persistence, container) · `index.ts` (the ONLY public surface).

### Boundaries — enforced by `eslint.config.mjs`

- Import another module through its barrel: `@modules/iam`, `@modules/auth`. Never a deep path.
- `iam` must not import `auth` or `hrm` — it stays reusable by another product.
- `shared/` and `infra/` must not import module internals.
- HRM touches accounts through `iamDirectory` from `@modules/iam`, never IAM's models.

### HRM sub-domains

`modules/hrm/core/[name]/` — sub-domains are folders inside HRM, not top-level modules.

### Error Code Prefix

`[MODULE]_[NUMBER]` - e.g., IAM_001, EMP_001

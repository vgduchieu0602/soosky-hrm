# Soosky HRM — Frontend Project Rules

> Coding standards, folder structure, and patterns for the **Soosky HRM web client**.
> All contributors (human + AI assistants) MUST follow this document.

---

## Tech Stack

- **Framework:** React 19 + Vite
- **Language:** TypeScript (strict mode)
- **Routing:** React Router v7 (import from `react-router`, NOT `react-router-dom`)
- **State management:**
  - **Local:** `useState` / `useReducer`
  - **Server state:** TanStack Query v5
  - **Global client state:** Zustand (only `auth` and lightweight UI prefs)
  - **URL state:** `useSearchParams` (filters, pagination)
- **Styling:** Tailwind CSS
- **HTTP client:** Axios (with interceptors for auth + error normalization)
- **Forms:** React Hook Form + Zod resolver
- **Testing:** Vitest + React Testing Library
- **Icons:** lucide-react

---

## 1. Feature Structure

```
src/
├── features/
│   ├── auth/             # login, change-password, forgot/reset, session list
│   ├── iam/              # admin: users, roles, permissions, audit logs
│   ├── organization/     # departments tree, positions
│   ├── employee/         # employee CRUD + profile/documents/contracts/contacts/bank/history/assets
│   ├── attendance/       # check-in/out, attendance records, shifts, holidays, leave requests/approval/balances
│   ├── payroll/          # periods, compute, payrolls, payslips, salary structures, allowances/deductions/bonuses
│   └── performance/      # appraisal cycles, goals, KPIs, reviews, feedbacks
├── shared/
│   ├── components/       # Button, Input, Modal, DataTable, DateRangePicker, FileUploader
│   ├── hooks/            # useDebounce, useLocalStorage, useMediaQuery
│   ├── layouts/          # AppLayout (sidebar + topbar), AuthLayout, AdminLayout
│   ├── lib/              # axios instance, queryClient, dayjs config
│   ├── stores/           # auth.store.ts (global auth state)
│   └── types/            # AuthUser, Paginated<T>, ApiError, …
├── config/
│   ├── env.ts            # validated import.meta.env
│   ├── constants.ts      # MAX_FILE_SIZE, PAGE_SIZE_OPTIONS, …
│   └── permissions.ts    # PERMISSIONS.PAYROLL_APPROVE, …
├── routes/
│   ├── index.tsx         # createBrowserRouter config
│   ├── routes.ts         # ROUTES path constants (type-safe)
│   ├── ProtectedRoute.tsx
│   ├── RoleRoute.tsx     # role / permission guard
│   └── MustChangePasswordRoute.tsx  # forces /change-password before app
├── App.tsx
└── main.tsx
```

**Each feature folder:**

```
features/[feature-name]/
├── components/
│   ├── EmployeeCard.tsx
│   └── EmployeeList.tsx
├── hooks/
│   └── useEmployees.ts        # TanStack Query hooks
├── services/
│   └── employee.service.ts    # axios calls only — no React inside
├── stores/                    # Zustand slice (rarely needed in HRM)
├── types/
│   └── employee.types.ts
├── utils/
│   └── employee.utils.ts      # formatters, mappers
├── schemas/
│   └── employee.schema.ts     # Zod schemas for forms
├── pages/
│   ├── EmployeeListPage.tsx
│   ├── EmployeeDetailPage.tsx
│   └── EmployeeCreatePage.tsx
├── index.ts                   # barrel exports — public surface
└── CONTEXT.md
```

---

## 2. Naming Conventions

- **Feature folders:** `kebab-case` — `employee`, `payroll`, `performance`
- **Components:** `PascalCase.tsx` — `EmployeeCard.tsx`, `LeaveRequestForm.tsx`
- **Hooks:** `useXxx.ts` — `useEmployees.ts`, `useLeaveBalance.ts`
- **Services:** `xxx.service.ts` — `employee.service.ts`, `payroll.service.ts`
- **Stores (Zustand):** `xxx.store.ts` — `auth.store.ts`
- **Types:** `xxx.types.ts` — `employee.types.ts`
- **Utils:** `xxx.utils.ts` — `money.utils.ts`, `date.utils.ts`
- **Schemas (Zod):** `xxx.schema.ts` — `leave-request.schema.ts`
- **Pages:** `XxxPage.tsx` — `EmployeeListPage.tsx`, `PayslipDetailPage.tsx`
- **Constants:** `UPPER_SNAKE_CASE` — `MAX_AVATAR_SIZE`, `PAGE_SIZE_OPTIONS`
- **Route paths:** `ROUTES.EMPLOYEE_DETAIL` in `routes/routes.ts`
- **Permission keys:** `PERMISSIONS.PAYROLL_APPROVE` in `config/permissions.ts`

---

## 3. Feature Rules

- Feature MUST be **self-contained** — own components, hooks, services, pages.
- Public surface exposed via `index.ts` only — internal files are private.
- **No cross-feature internal imports.** Cross-feature talks via:
  - **Global Zustand store** (`shared/stores/auth.store.ts`) — auth user only
  - **URL params / search params** — `useParams`, `useSearchParams`
  - **TanStack Query cache** — share `queryKey`s through `shared/lib/query-keys.ts`
- **Shared UI** lives in `src/shared/components/` (DataTable, Modal, DateRangePicker, FileUploader).

**Feature boundaries:**

| Feature        | Responsibilities                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`         | Login form, change password (forced on first login when `mustChangePassword=true`), forgot/reset, session listing                                        |
| `iam`          | Admin pages: users list, role editor, permission matrix, audit log viewer                                                                                |
| `organization` | Departments tree, positions CRUD                                                                                                                         |
| `employee`     | List/search employees, employee detail tabs (profile, documents, contracts, contacts, bank, history, assets), create employee wizard, grant-login action |
| `attendance`   | Check-in/out widget, my attendance, shift admin, holidays, leave request form, leave approval queue, leave balances                                      |
| `payroll`      | Periods list, compute action, payrolls table, payslip viewer (employee), salary structure history, allowance/deduction/bonus editors                     |
| `performance`  | Cycle list, my goals/KPIs, review draft/submit/acknowledge, feedback forms                                                                               |

---

## 4. Component Rules

- **One component per file.** Co-locate `*.test.tsx` next to it.
- **Props typing required** — `interface Props { ... }`; no implicit `any`.
- **Max 200 lines** per component. Split into smaller pieces when larger.
- **Container vs presentational** — keep data fetching and state at the page/container; pass data and callbacks down to presentational components.
- `React.memo` / `useMemo` / `useCallback` only with a measured reason.

**File template:**

```tsx
// 1. Imports
import { useState } from "react";
import { useNavigate } from "react-router";
import type { Employee } from "../types/employee.types";

// 2. Types
interface Props {
  employee: Employee;
  onSelect?: (id: string) => void;
}

// 3. Component
export function EmployeeCard({ employee, onSelect }: Props) {
  // ...
  return <article className="rounded-lg border p-4">...</article>;
}
```

---

## 5. Code Patterns (MUST follow)

### API calls — only via services + TanStack Query

```ts
// features/employee/services/employee.service.ts
import { api } from "@/shared/lib/axios";
export const employeeService = {
  list: (params: ListEmployeesParams) =>
    api.get("/employees", { params }).then((r) => r.data),
  grantLogin: (id: string) =>
    api.post(`/admin/employees/${id}/grant-login`).then((r) => r.data),
};

// features/employee/hooks/useEmployees.ts
export function useEmployees(params: ListEmployeesParams) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => employeeService.list(params),
  });
}

export function useGrantLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: employeeService.grantLogin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}
```

### State management

- **Local first** (`useState`) — UI toggles, form steps, modal open.
- **Server state** — TanStack Query for ALL data from `/api/v1/*`. Never store API data in Zustand.
- **Global client state** — Zustand for the **auth user** and very lightweight UI prefs (sidebar collapsed). Nothing else.
- **URL state** — `useSearchParams` for filters and pagination (so links are shareable):

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const departmentId = searchParams.get("departmentId") ?? undefined;
```

### Routing (React Router v7)

```ts
// routes/routes.ts
export const ROUTES = {
  // Auth
  LOGIN: "/login",
  CHANGE_PASSWORD: "/change-password",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  // App
  DASHBOARD: "/",
  // Self-service
  MY_PROFILE: "/me/profile",
  MY_ATTENDANCE: "/me/attendance",
  MY_LEAVE: "/me/leave",
  MY_PAYSLIPS: "/me/payslips",
  MY_GOALS: "/me/goals",
  // Employee (HR / Admin)
  EMPLOYEES: "/employees",
  EMPLOYEE_DETAIL: "/employees/:id",
  EMPLOYEE_NEW: "/employees/new",
  // Organization
  DEPARTMENTS: "/organization/departments",
  POSITIONS: "/organization/positions",
  // Attendance / Leave admin
  ATTENDANCE: "/attendance",
  LEAVE_APPROVAL: "/leave/approval",
  // Payroll
  PAYROLL_PERIODS: "/payroll/periods",
  PAYROLL_PERIOD_DETAIL: "/payroll/periods/:id",
  // Performance
  APPRAISAL_CYCLES: "/performance/cycles",
  PERFORMANCE_REVIEWS: "/performance/reviews",
  REVIEW_DETAIL: "/performance/reviews/:id",
  // Admin
  ADMIN_USERS: "/admin/users",
  ADMIN_ROLES: "/admin/roles",
  ADMIN_AUDIT_LOGS: "/admin/audit-logs",
} as const;
```

- Import only from `react-router`:

  ```ts
  import {
    useNavigate,
    useParams,
    useSearchParams,
    Navigate,
    Outlet,
  } from "react-router";
  ```

- Type-safe params: `const { id } = useParams<{ id: string }>();`
- Navigate using constants: `navigate(ROUTES.EMPLOYEE_DETAIL.replace(':id', id));`
- Lazy-load pages: `React.lazy(() => import('@/features/payroll/pages/PayrollPeriodsPage'))` with `Suspense` fallback skeleton.
- **Guards:** `ProtectedRoute` (auth) → `MustChangePasswordRoute` (force password reset) → `RoleRoute roles={['admin','hr_manager']}` (role) wrap the relevant route subtrees.

### Error handling

- **Route-level `errorElement`** for navigation/loading failures.
- **TanStack Query `onError`** for API errors; format messages from `error.error.code` lookup.
- **Axios response interceptor** centralizes:
  - 401 → attempt `/auth/refresh` once; on second 401 → clear auth store → `Navigate to ROUTES.LOGIN`
  - 403 → toast "Insufficient permission"
  - 5xx → toast "Something went wrong"
- **React Error Boundary** at `AppLayout` for unexpected render errors.
- **Toasts** (e.g., sonner / react-hot-toast) for user feedback on mutations.

### Loading states

- **Skeletons** for first-paint of data-heavy screens (employee list, payroll table).
- **Spinners / disabled buttons** for in-flight mutations (check-in, approve leave, compute payroll).
- **Optimistic updates** for cheap toggles (set primary bank account, toggle goal progress).
- **Suspense fallback** for lazy-loaded routes.

### Forms

- **React Hook Form + Zod resolver** for every form.
- Schema lives in `features/<feature>/schemas/*.schema.ts`.
- Show inline errors under each input; disable submit while `isSubmitting`.

```ts
// features/attendance/schemas/leave-request.schema.ts
export const leaveRequestSchema = z
  .object({
    leaveType: z.enum([
      "annual",
      "sick",
      "unpaid",
      "maternity",
      "paternity",
      "bereavement",
    ]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });
```

### Authentication

- **Access token** kept in memory (Zustand auth store) — never in localStorage.
- **Refresh token** in httpOnly cookie (server-set) — invisible to JS.
- Axios request interceptor attaches `Authorization: Bearer <accessToken>`.
- Axios response interceptor handles `401` → call `/auth/refresh` → retry original request once.
- On `mustChangePassword=true` after login → redirect to `ROUTES.CHANGE_PASSWORD` and block all other routes via `MustChangePasswordRoute`.

### Permissions in UI

- Hide / disable actions by checking `auth.user.permissions`:

  ```tsx
  const can = useCan();
  {can(PERMISSIONS.PAYROLL_APPROVE) && <Button onClick={...}>Approve</Button>}
  ```

- Page-level: use `RoleRoute` / `PermissionRoute`. Always assume the server enforces the same rules — UI gating is for UX, not security.

---

## 6. Anti-patterns (MUST NOT do)

| ❌ DON'T                                                | ✅ DO                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Import `EmployeeCard` from `payroll/components/...`     | Re-export via `features/employee/index.ts` and import from `@features/employee` |
| `axios.get(...)` inside a component                     | Service layer → TanStack Query hook                                             |
| Business logic in JSX (compute net salary in component) | Move to `payroll.utils.ts` or backend                                           |
| `useEffect(() => fetch(...))` for data                  | `useQuery`                                                                      |
| Store `employees` array in Zustand                      | TanStack Query cache                                                            |
| Hardcode `'/employees/' + id` in components             | `ROUTES.EMPLOYEE_DETAIL.replace(':id', id)`                                     |
| Hardcode role string `'admin'`                          | `ROLES.ADMIN` from `config/permissions.ts`                                      |
| Hardcode API URL `https://api...`                       | `env.API_BASE_URL`                                                              |
| Store access token in `localStorage`                    | In-memory Zustand store; refresh via httpOnly cookie                            |
| Inline styles `style={{ color: 'red' }}`                | Tailwind classes                                                                |
| `import { ... } from 'react-router-dom'`                | `from 'react-router'` (v7)                                                      |
| Use array index as React `key`                          | Use stable `_id` from the API                                                   |
| `useEffect` for derived state                           | Compute during render                                                           |
| Deep prop drilling                                      | Composition / context / split components                                        |
| `any` types                                             | Proper typing (Zod-inferred is great)                                           |

---

## 7. Git Workflow

- **Branch naming:** `[type]/[feature]-[short-description]`
  - `feature/employee-grant-login-modal`
  - `fix/leave-balance-display`
  - `refactor/payroll-table-columns`
- **Commit message:** `[type](scope): description`
  - `feat(employee): add grant-login confirmation dialog`
  - `fix(attendance): correct check-in timezone`
  - `style(payroll): polish payslip detail layout`
- **PR scope:**
  - One feature or bugfix per PR.
  - Include screenshots / GIFs for UI changes.
  - Update `CONTEXT.md` of the feature if domain logic changes.

---

## 8. Testing

- **Location:** same folder as the source — `EmployeeCard.test.tsx`, `useLeaveRequest.test.ts`.
- **Tools:** Vitest + React Testing Library + `@testing-library/user-event`.
- **What to test (priority order):**
  1. **Critical flows:** login + must-change-password redirect, leave request submission, check-in/out, grant-login dialog, payroll computation trigger.
  2. **Hooks** with TanStack Query — assert correct `queryKey`, optimistic update, invalidation.
  3. **Conditional rendering** by role / permission.
  4. **Form validation** edge cases via Zod schema.
- **Mock services:** stub axios with `msw` or jest-style mocks; never hit the real API.
- **Route navigation:** use `MemoryRouter` (or createMemoryRouter) for route-aware tests.
- **Coverage targets:** critical flows ≥ 80%, shared components ≥ 70%, leaf UI components optional.

---

## 9. React 19 + Misc

- **StrictMode** enabled.
- Prefer **`use()` hook** for sync-reading a promise/context in suspense boundaries when applicable.
- **Lazy-load pages** with `React.lazy()` + `Suspense` skeleton.
- **Custom hooks** for reusable logic: `useDebounce`, `useLocalStorage`, `useMediaQuery`, `useCan`.
- **Context** only for static-ish values (theme, locale) — NOT for frequently-changing state.
- **Stable list keys** — always use `item._id`, never index.
- **Avoid `useEffect` for derived state** — compute it during render.
- **Zustand slice pattern** when (and only when) global client state grows beyond `auth`:

  ```ts
  const useUiStore = create<UiState>((set) => ({
    sidebarCollapsed: false,
    toggleSidebar: () =>
      set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  }));
  ```

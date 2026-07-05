# Attendance — Clean Architecture (pilot module)

This feature is the reference implementation of Clean Architecture (pragmatic,
ports + DI) for the Soosky HRM backend. Other features still use the legacy
`controller → service → repository` layout; migrate them by following this one.

## Layers (dependency rule points inward)

```
interfaces/http   → application → domain
infrastructure    → application → domain      (adapters implement domain ports)
container.ts      → wires infrastructure into application (composition root)
```

- **domain/** — pure, framework-free. No Express, no Mongoose.
  - `attendance-calc.ts` — status/hours/session from check-in/out (pure).
  - `leave-policy.ts` — annual quota, 3-year carry-over pool, working-days,
    holiday checker, `computeFields`, tenure. Pure functions.
  - `ports/` — the interfaces the application depends on (repositories,
    gateways, Clock, AuditPort, EventsPort, UnitOfWork). IDs cross as `string`;
    `Tx` is an opaque transaction handle.

- **application/** — use-cases; orchestrate ports only, never import Mongoose.
  - `attendance.usecases.ts`, `leave.usecases.ts`, `catalog.usecases.ts`,
    `leave-entitlement.service.ts`.

- **infrastructure/** — adapters implementing the ports.
  - `*.repository.mongoose.ts`, `gateways.mongoose.ts` (employee/shift/policy/
    payroll-lock), `services.ts` (Clock, Audit, EventBus, Mongoose UnitOfWork).

- **interfaces/http/** — Express controllers + routes (thin; call the container).

- **container.ts** — the ONLY place that instantiates concrete adapters and
  injects them into the use-cases. Swap an adapter here to change tech.

## Public surface (`index.ts`)

`attendanceRouter`, plus `shiftService/holidayService/symbolService` (catalog
use-cases under legacy names) and `attendanceUseCases/leaveUseCases/
leaveEntitlement` for cross-feature/test callers.

## Testing

- Domain is unit-tested directly with no mocks (`attendance-calc.spec`,
  `leave-calc.spec` — inject a fake holiday checker instead of mocking Mongoose).
- Carry-over + flows are integration-tested against `mongodb-memory-server`
  through the container (`leave-carryover.spec`).

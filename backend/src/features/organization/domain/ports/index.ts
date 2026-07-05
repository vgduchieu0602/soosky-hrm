import type { DepartmentRow, HeadRow } from '@features/organization/domain/department-tree';

/**
 * Ports — the abstractions the application (use-cases) depend on. Concrete
 * implementations live in `infrastructure/`. IDs cross the boundary as strings;
 * adapters convert to/from Mongoose ObjectId. `Tx` is an opaque transaction
 * handle (a Mongoose ClientSession under the hood).
 */
export type Id = string;
export type Tx = unknown;

/** Plain JSON department record (a `toJSON()` output). */
export type DepartmentDoc = Record<string, unknown>;
export type PositionDoc = Record<string, unknown>;

// ---- repository ports ----

export interface DepartmentRepository {
  findAll(): Promise<DepartmentRow[]>;
  findById(id: Id): Promise<DepartmentDoc | null>;
  findByCode(code: string): Promise<DepartmentDoc | null>;
  findChildren(parentId: Id): Promise<{ status: string }[]>;
  create(input: Record<string, unknown>): Promise<DepartmentDoc>;
  updateById(id: Id, patch: Record<string, unknown>, tx?: Tx): Promise<DepartmentDoc | null>;
  deleteById(id: Id): Promise<DepartmentDoc | null>;
  countChildren(deptId: Id): Promise<number>;
}

export interface PositionRepository {
  list(filter: { departmentId?: string; status?: string }): Promise<PositionDoc[]>;
  findById(id: Id): Promise<PositionDoc | null>;
  findByCode(code: string): Promise<PositionDoc | null>;
  create(input: Record<string, unknown>): Promise<PositionDoc>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<PositionDoc | null>;
  deleteById(id: Id): Promise<PositionDoc | null>;
}

// ---- cross-feature gateways ----

export interface EmployeeGateway {
  /** Non-terminated headcount grouped by department. */
  headcountByDepartment(): Promise<{ departmentId: string; count: number }[]>;
  /** Name parts + avatar of the given (non-terminated) manager employees. */
  findHeads(managerIds: Id[]): Promise<HeadRow[]>;
  /** Employee status lookup for department-head validation. */
  findEmployeeStatus(id: Id): Promise<{ status: string } | null>;
  countActiveInDepartment(deptId: Id): Promise<number>;
  countAllInDepartment(deptId: Id): Promise<number>;
  countByStatuses(deptId: Id, statuses: readonly string[]): Promise<number>;
  countByPosition(positionId: Id): Promise<number>;
  /** Ids of non-terminated employees in a department (optionally filtered). */
  findTransferableIds(deptId: Id, employeeIds?: Id[]): Promise<string[]>;
  moveEmployees(ids: Id[], targetDeptId: Id, tx: Tx): Promise<void>;
}

export interface TransferHistoryEntry {
  employeeId: Id;
  fromDepartmentId: Id;
  toDepartmentId: Id;
  effectiveDate: Date;
  note: string;
  createdBy: Id;
}

export interface EmployeeHistoryGateway {
  recordTransfers(entries: TransferHistoryEntry[], tx: Tx): Promise<void>;
}

export interface PositionGateway {
  countByDepartment(deptId: Id): Promise<number>;
  moveAll(sourceDeptId: Id, targetDeptId: Id, tx: Tx): Promise<void>;
}

export interface DepartmentRefGateway {
  exists(id: Id): Promise<boolean>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}

export interface IdValidator {
  isValid(id: Id): boolean;
}

export interface AuditPort {
  record(entry: {
    userId: string;
    resource: string;
    action: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
  list(filter: { resource?: string; resourceId?: string }): Promise<unknown[]>;
}

export interface UnitOfWork {
  withTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

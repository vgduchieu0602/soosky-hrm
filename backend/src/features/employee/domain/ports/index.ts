/**
 * Ports — the abstractions the application (use-cases) depend on. Concrete
 * implementations live in `infrastructure/`. IDs cross the boundary as strings;
 * adapters convert to/from Mongoose ObjectId. `Tx` is an opaque transaction
 * handle (a Mongoose ClientSession under the hood). Records cross the boundary
 * as plain objects (the same shapes the legacy repositories returned).
 */
export type Id = string;
export type Tx = unknown;
export type Doc = Record<string, any>;

// ---- employee list filter ----

export interface ListEmployeesFilter {
  departmentId?: string;
  status?: string;
  employeeType?: string;
  managerId?: string;
  q?: string;
}

export interface PaginateOpts {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
  filter: ListEmployeesFilter;
}

export interface CreateEmployeeData {
  employeeCode: string;
  fingerprintId: string | null;
  departmentId: string;
  positionId: string;
  managerId: string | null;
  shiftId: string | null;
  hireDate: Date;
  employeeType: string;
  salaryZone?: string;
}

// ---- repository ports ----

export interface EmployeeRepository {
  findById(id: Id): Promise<Doc | null>;
  findByIdJson(id: Id): Promise<Doc | null>;
  findByIdPopulatedJson(id: Id): Promise<Doc | null>;
  findByCode(code: string): Promise<Doc | null>;
  findByUserIdJson(userId: Id): Promise<Doc | null>;
  findOtherByFingerprint(fingerprintId: string, exceptId: Id): Promise<Doc | null>;
  paginate(opts: PaginateOpts): Promise<{ items: Doc[]; total: number }>;
  countByStatus(): Promise<{ _id: string; count: number }[]>;
  countByDepartment(): Promise<{ _id: string; count: number }[]>;
  create(data: CreateEmployeeData, tx: Tx): Promise<Doc>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null>;
  linkUser(employeeId: Id, userId: Id, tx?: Tx): Promise<void>;
  unlinkUser(employeeId: Id): Promise<void>;
  setTerminated(id: Id, terminationDate: Date, tx: Tx): Promise<void>;
  unsetUserId(id: Id, tx: Tx): Promise<void>;
  detachManager(managerId: Id, tx: Tx): Promise<void>;
}

export interface EmployeeProfileRepository {
  findByEmployeeId(employeeId: Id): Promise<Doc | null>;
  create(employeeId: Id, data: Record<string, unknown>, tx: Tx): Promise<void>;
  upsertByEmployeeId(employeeId: Id, patch: Record<string, unknown>): Promise<Doc>;
  findEmail(employeeId: Id): Promise<{ exists: boolean; email: string | null }>;
  updateEmail(employeeId: Id, email: string): Promise<void>;
}

export interface ContactRepository {
  listByEmployee(employeeId: Id): Promise<Doc[]>;
  create(employeeId: Id, input: Record<string, unknown>): Promise<Doc>;
  updateById(employeeId: Id, id: Id, patch: Record<string, unknown>): Promise<Doc | null>;
  deleteById(employeeId: Id, id: Id): Promise<boolean>;
  clearPrimary(employeeId: Id): Promise<void>;
}

export interface BankAccountRepository {
  listByEmployee(employeeId: Id): Promise<Doc[]>;
  create(employeeId: Id, input: Record<string, unknown>): Promise<Doc>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null>;
  deleteById(id: Id): Promise<boolean>;
  clearPrimary(employeeId: Id): Promise<void>;
}

export interface DocumentRepository {
  listByEmployee(employeeId: Id): Promise<Doc[]>;
  create(employeeId: Id, input: Record<string, unknown>): Promise<Doc>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null>;
  deleteById(id: Id): Promise<boolean>;
}

export interface AssetRepository {
  listByEmployee(employeeId: Id): Promise<Doc[]>;
  create(employeeId: Id, input: Record<string, unknown>): Promise<Doc>;
  markReturned(id: Id, patch: Record<string, unknown>): Promise<Doc | null>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null>;
  deleteById(id: Id): Promise<boolean>;
}

export interface ContractRepository {
  listByEmployee(employeeId: Id): Promise<Doc[]>;
  findByNumber(contractNumber: string): Promise<Doc | null>;
  employeeIdOf(contractId: Id): Promise<string | null>;
  expireActive(employeeId: Id, tx: Tx): Promise<void>;
  expireActiveExcept(employeeId: Id, exceptContractId: Id): Promise<void>;
  create(employeeId: Id, input: Record<string, unknown>, tx: Tx): Promise<Doc>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null>;
}

export interface HistoryRepository {
  listByEmployee(employeeId: Id): Promise<Doc[]>;
  create(
    data: {
      employeeId: Id;
      eventType: string;
      fromValue?: Record<string, unknown>;
      toValue?: Record<string, unknown>;
      effectiveDate: Date;
      note?: string;
      createdBy: string | null;
    },
    tx?: Tx,
  ): Promise<void>;
}

// ---- cross-feature gateways ----

export interface OrganizationGateway {
  findDepartment(id: Id): Promise<Doc | null>;
  findPosition(id: Id): Promise<Doc | null>;
  listDepartmentCodes(): Promise<{ _id: string; code: string }[]>;
  listPositionCodes(): Promise<{ _id: string; code: string }[]>;
}

export interface UserRec {
  id: string;
  username: string;
  email: string;
  status: string;
  lastLoginAt?: Date | null;
  mustChangePassword: boolean;
}

export interface UpdateUserAccountPatch {
  username?: string;
  email?: string;
  password?: string;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  status?: string;
  activateIfLocked?: boolean;
}

export interface AccountGateway {
  findEmployeeRoleId(): Promise<string | null>;
  findRoleIdByName(name: string): Promise<string | null>;
  getUser(userId: Id): Promise<UserRec | null>;
  getUserByEmployeeId(employeeId: Id): Promise<UserRec | null>;
  findUserConflict(username: string, email: string, exceptUserId?: Id): Promise<{ username: string } | null>;
  roleNameOf(userId: Id): Promise<string>;
  createUser(
    data: {
      username: string;
      email: string;
      password: string;
      employeeId: string;
      status: string;
      mustChangePassword: boolean;
      failedLoginAttempts: number;
    },
    tx: Tx,
  ): Promise<{ id: string }>;
  assignRole(userId: Id, roleId: Id, tx: Tx): Promise<void>;
  replaceRoles(userId: Id, roleId: Id, tx: Tx): Promise<void>;
  updateUserAccount(userId: Id, patch: UpdateUserAccountPatch, tx?: Tx): Promise<void>;
  writeUserAudit(
    entry: { userId: string; resource: string; action: string; resourceId: string; changes?: Record<string, unknown> },
    tx?: Tx,
  ): Promise<void>;
  revokeUserSessions(userId: Id): Promise<void>;
  revokeAllSessions(userId: Id, tx: Tx): Promise<void>;
  disableUser(userId: Id, tx: Tx): Promise<void>;
}

export interface LeaveSeedGateway {
  seedLeaveBalances(employeeId: Id): Promise<void>;
}

export interface CascadeGateway {
  deleteEmployeeCascade(employeeId: Id, linkedUserId: string | null, tx: Tx): Promise<void>;
}

export interface NotificationGateway {
  userIdsByRoles(roles: string[]): Promise<string[]>;
  notifyMany(
    recipients: string[],
    payload: { type: string; severity: string; title: string; message: string; link: string },
  ): Promise<void>;
}

export interface CompletenessGateway {
  gather(
    employeeId: Id,
  ): Promise<
    | {
        userId: unknown;
        profile: { dateOfBirth?: unknown; phone?: unknown; email?: unknown; address?: unknown } | null;
        contacts: number;
        banks: number;
        contracts: number;
        docs: number;
      }
    | null
  >;
}

export interface ReminderRepository {
  expiring(withinDays: number, now: Date): Promise<import('@features/employee/domain/employee-rules').ReminderRow[]>;
}

export interface ExportPort {
  export(rows: Doc[]): Promise<Buffer>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}

export interface AuditPort {
  record(entry: {
    userId: string;
    resource: string;
    action: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}

export interface EventsPort {
  grantedLogin(p: { userId: string; employeeId: string; username: string; sendTo?: string }): void;
  passwordReset(p: { userId: string; employeeId: string; username: string; sendTo?: string }): void;
  inviteResent(p: { userId: string; employeeId: string; username: string; sendTo?: string }): void;
}

export interface UnitOfWork {
  withTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

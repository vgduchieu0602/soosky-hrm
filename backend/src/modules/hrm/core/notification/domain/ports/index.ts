import type { NotificationSeverity, NotificationType } from '@modules/hrm/adapters/persistence/mongoose/models/notification.model';

/**
 * Ports — abstractions the notification use-cases depend on. Concrete
 * implementations live in `infrastructure/`. IDs cross the boundary as strings;
 * adapters convert to/from Mongoose ObjectId.
 */
export type Id = string;

export { NotificationSeverity, NotificationType };

/** A notification payload with all defaults already resolved by the use-case. */
export interface NewNotification {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link: string | null;
}

// ---- repository port ----

export interface NotificationRepository {
  /** Create one notification. No-op if `userId` is not a valid id. */
  create(userId: Id, data: NewNotification): Promise<void>;
  /** Create the same notification for many recipients (ids already deduped). */
  insertMany(userIds: Id[], data: NewNotification): Promise<void>;
  listMine(userId: Id, opts: { unreadOnly: boolean; limit: number }): Promise<unknown[]>;
  unreadCount(userId: Id): Promise<number>;
  /** Marks a single notification read. Returns false when `id` is not valid. */
  markRead(id: Id, userId: Id): Promise<boolean>;
  /** Marks all unread as read; returns the number of updated documents. */
  markAllRead(userId: Id): Promise<number>;
}

// ---- cross-feature gateways ----

export interface RoleGateway {
  /** User ids holding any of the given role names (for HR/admin fan-out). */
  userIdsByRoles(roleNames: string[]): Promise<string[]>;
}

export interface EmployeeGateway {
  userIdOfEmployee(employeeId: Id): Promise<string | null>;
  employeeCode(employeeId: Id): Promise<string | null>;
  countActive(): Promise<number>;
}

export interface PayrollGateway {
  /** User ids of every employee holding a payroll in the given period. */
  userIdsForPeriod(periodId: Id): Promise<string[]>;
}

export interface EvaluationGateway {
  /** Count of approved/acknowledged evaluations for the period. */
  countApprovedForPeriod(periodId: Id): Promise<number>;
}

// ---- infrastructure services ----

export interface LoggerPort {
  error(obj: unknown, msg: string): void;
  info(msg: string): void;
}

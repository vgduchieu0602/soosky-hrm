/**
 * Ports — abstractions the performance application depends on. Concrete
 * implementations live in `infrastructure/`. IDs cross the boundary as strings;
 * adapters convert to/from Mongoose ObjectId. Evaluation records are the plain
 * JSON shape the model produces (`doc.toJSON()` / `.lean()`); the application
 * only reads a few typed fields off them and passes the whole object through.
 */
import type { ScoreInput } from '@features/performance/domain/evaluation-ratio';

export type Id = string;

// ---- read-model ----

/** Plain evaluation object as returned by the model (toJSON / lean). */
export interface EvaluationRecord {
  _id: unknown;
  employeeId: unknown;
  payrollPeriodId: unknown;
  status: string;
  [key: string]: unknown;
}

/** Fields persisted on an upsert (direct evaluate). */
export interface EvaluationUpsertFields {
  criteriaScores: ScoreInput[];
  performanceRatio: number;
  goalResult: number;
  goalRatio: number;
  strengths: string | null;
  improvements: string | null;
  developmentPlan: string | null;
  managerId: string | null;
  evaluatedBy: string;
  status: 'draft' | 'approved';
  approvedAt: Date | null;
}

// ---- repository ports ----

export interface EvaluationRepository {
  /** List (optionally filtered by period), newest first. Invalid id → unfiltered. */
  list(payrollPeriodId?: string): Promise<EvaluationRecord[]>;
  /** All of one employee's evaluations, newest first. Invalid id → []. */
  findByEmployee(employeeId: Id): Promise<EvaluationRecord[]>;
  /** One evaluation by id (invalid id or missing → null). */
  findById(id: Id): Promise<EvaluationRecord | null>;
  /** One evaluation for an employee+period, or null. */
  findByEmployeePeriod(employeeId: Id, payrollPeriodId: Id): Promise<EvaluationRecord | null>;
  /** Upsert the employee+period evaluation with the given fields. */
  upsert(employeeId: Id, payrollPeriodId: Id, fields: EvaluationUpsertFields): Promise<EvaluationRecord>;
  /** approved → acknowledged for the employee. */
  acknowledge(
    id: Id,
    patch: { acknowledgedAt: Date; acknowledgedBy: Id; disputeNote: string | null },
  ): Promise<EvaluationRecord>;
  /** approved → draft (clears approvedAt). */
  reopen(id: Id): Promise<EvaluationRecord>;
  /** Aggregated export rows (employee/profile/department/period joined). */
  exportRows(payrollPeriodId?: string): Promise<Record<string, unknown>[]>;
}

// ---- cross-feature gateways ----

export interface EmployeeGateway {
  /** Employee id for a user account, or null. */
  findEmployeeIdByUserId(userId: Id): Promise<string | null>;
  /** `managerId` (string|null) of an employee, or null when the employee is absent. */
  findManager(employeeId: Id): Promise<{ managerId: string | null } | null>;
}

export interface CriterionGateway {
  /** Active criterion ids split by type — performance vs goal. */
  activeTypeSets(): Promise<{ performance: Set<string>; goal: Set<string> }>;
}

export interface PayrollLockGateway {
  /** Approved/paid payroll locking this employee+period, or null. */
  findLockedPayroll(payrollPeriodId: Id, employeeId: Id): Promise<{ status: string } | null>;
  /** When the period's evaluations were locked (chốt đánh giá), or null. */
  evaluationLockedAt(payrollPeriodId: Id): Promise<Date | null>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}

export interface AuditPort {
  record(entry: {
    userId: string; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}

export interface EventsPort {
  evaluationFinalized(p: { employeeId: string; payrollPeriodId: string }): void;
  evaluationReopened(p: { employeeId: string }): void;
  evaluationDisputed(p: { employeeId: string; evaluationId: string }): void;
}

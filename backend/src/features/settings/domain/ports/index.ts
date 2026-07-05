import type {
  CreateSalaryPolicyDto,
  UpdateSalaryPolicyDto,
  CreateBankDto,
  UpdateBankDto,
  UpdateCriterionDto,
} from '@features/settings/dto/settings.dto';

/**
 * Ports — the abstractions the application (use-cases) depends on. Concrete
 * implementations live in `infrastructure/`. IDs cross the boundary as strings;
 * adapters convert to/from Mongoose ObjectId and Decimal128.
 */
export type Id = string;

/** A persisted record returned to the application: JSON plus its string id. */
export interface Persisted {
  id: string;
  data: Record<string, unknown>;
}

// ---- repository ports ----

export interface CompanyConfigRepository {
  /** Upsert-on-read: there is always exactly one config document. */
  getOrCreate(): Promise<Record<string, unknown>>;
  update(input: Record<string, unknown>): Promise<Persisted>;
}

export interface SalaryPolicyRepository {
  list(): Promise<Record<string, unknown>[]>;
  existsByKey(country: string, year: number, effectiveFrom: Date): Promise<boolean>;
  create(input: CreateSalaryPolicyDto, createdBy: Id): Promise<Persisted>;
  /** Returns null when id is invalid or the policy does not exist. */
  update(id: Id, input: UpdateSalaryPolicyDto, updatedBy: Id): Promise<Persisted | null>;
}

export interface PerformanceCriterionRepository {
  list(includeArchived: boolean): Promise<Record<string, unknown>[]>;
  existsByKey(key: string): Promise<boolean>;
  create(data: {
    key: string;
    label: string;
    description?: string;
    type: string;
    order: number;
  }): Promise<Persisted>;
  /** Returns null when id is invalid or the criterion does not exist. */
  update(id: Id, input: UpdateCriterionDto): Promise<Persisted | null>;
  /** Sets status = archived. Returns null when id is invalid or not found. */
  archive(id: Id): Promise<Persisted | null>;
}

export interface BankRepository {
  list(): Promise<Record<string, unknown>[]>;
  create(input: CreateBankDto): Promise<Persisted>;
  /** Returns null when id is invalid or the bank does not exist. */
  update(id: Id, input: UpdateBankDto): Promise<Persisted | null>;
  /** Sets status = archived. Returns null when id is invalid or not found. */
  archive(id: Id): Promise<Persisted | null>;
}

// ---- infrastructure services ----

export interface AuditPort {
  record(entry: {
    userId: string;
    resource: string;
    action: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}

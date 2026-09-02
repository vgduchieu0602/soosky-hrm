import { vi } from 'vitest';
import type { Mocked } from 'vitest';
import { HttpError } from '@shared/errors/http-error';
import { DepartmentUseCases } from '@modules/hrm/core/organization/app/department.usecases';
import type {
  AuditPort,
  Clock,
  DepartmentRepository,
  EmployeeGateway,
  EmployeeHistoryGateway,
  IdValidator,
  PositionGateway,
  UnitOfWork,
} from '@modules/hrm/core/organization/domain/ports';

// --- Fakes for the ports the department use-cases depend on ----------------
const repo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findChildren: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  countChildren: vi.fn(),
} as unknown as Mocked<DepartmentRepository>;

const employees = {
  headcountByDepartment: vi.fn(),
  findHeads: vi.fn(),
  findEmployeeStatus: vi.fn(),
  countActiveInDepartment: vi.fn(),
  countAllInDepartment: vi.fn(),
  countByStatuses: vi.fn(),
  countByPosition: vi.fn(),
  findTransferableIds: vi.fn(),
  moveEmployees: vi.fn(),
} as unknown as Mocked<EmployeeGateway>;

const employeeHistory = {
  recordTransfers: vi.fn(),
} as unknown as Mocked<EmployeeHistoryGateway>;
const positions = {
  countByDepartment: vi.fn(),
  moveAll: vi.fn(),
} as unknown as Mocked<PositionGateway>;
const audit = {
  record: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
} as unknown as Mocked<AuditPort>;
const uow = {
  withTransaction: vi.fn((work) => work({})),
} as unknown as Mocked<UnitOfWork>;
const clock = { now: () => new Date('2026-07-05T00:00:00Z') } as Clock;
const ids = { isValid: () => true } as IdValidator;

const service = new DepartmentUseCases(
  repo,
  employees,
  employeeHistory,
  positions,
  audit,
  uow,
  clock,
  ids,
);

const AUDIT_USER = '507f1f77bcf86cd799439099';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('departmentService.create — manager validation (UC-06)', () => {
  it('rejects a head that is not an active employee with ORG_008', async () => {
    repo.findByCode.mockResolvedValue(null);
    employees.findEmployeeStatus.mockResolvedValue(null);

    await expect(
      service.create(
        { name: 'Eng', code: 'ENG', managerId: '507f1f77bcf86cd799439011' },
        AUDIT_USER,
      ),
    ).rejects.toMatchObject({ code: 'ORG_008' } as Partial<HttpError>);
  });
});

describe('departmentService.move — cycle guard (UC-08)', () => {
  it('rejects moving a department under its own descendant with ORG_009', async () => {
    const A = '507f1f77bcf86cd799439001';
    const B = '507f1f77bcf86cd799439002';
    repo.findById.mockResolvedValue({ parentDepartmentId: null } as never);
    repo.findAll.mockResolvedValue([
      { id: A, parentDepartmentId: null },
      { id: B, parentDepartmentId: A },
    ] as never);

    await expect(
      service.move(A, { parentDepartmentId: B }, AUDIT_USER),
    ).rejects.toMatchObject({ code: 'ORG_009' });
  });
});

describe('departmentService.archive — sub-department guard (UC-05)', () => {
  it('blocks archive when an active sub-department exists with ORG_011', async () => {
    employees.countByStatuses.mockResolvedValue(0);
    repo.findChildren.mockResolvedValue([{ status: 'active' }]);

    await expect(
      service.archive('507f1f77bcf86cd799439003', AUDIT_USER),
    ).rejects.toMatchObject({ code: 'ORG_011' });
  });
});

describe('departmentService.assignHead — remove head (UC-07)', () => {
  it('clears managerId without validating an employee', async () => {
    repo.updateById.mockResolvedValue({ managerId: null });

    const result = await service.assignHead('507f1f77bcf86cd799439004', null, AUDIT_USER);

    expect(result).toEqual({ managerId: null });
    expect(employees.findEmployeeStatus).not.toHaveBeenCalled();
  });
});

/// <reference types="jest" />
import { HttpError } from '@shared/errors/http-error';

// --- Mock data-access + cross-feature dependencies -------------------------
jest.mock('@features/organization/repositories/department.repository', () => ({
  departmentRepository: {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    findChildren: jest.fn(),
    create: jest.fn(),
    updateById: jest.fn(),
  },
}));

jest.mock('@shared/models/employee.model', () => ({
  Employee: {
    findById: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
  },
}));

jest.mock('@shared/models/employee-history.model', () => ({ EmployeeHistory: { create: jest.fn() } }));
jest.mock('@shared/models/position.model', () => ({ Position: { updateMany: jest.fn() } }));
jest.mock('@features/iam/services/audit.service', () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import { departmentService } from '@features/organization/services/department.service';
import { departmentRepository } from '@features/organization/repositories/department.repository';
import { Employee } from '@shared/models/employee.model';

const repo = departmentRepository as jest.Mocked<typeof departmentRepository>;
const EmployeeMock = Employee as unknown as {
  findById: jest.Mock;
  countDocuments: jest.Mock;
};

const AUDIT_USER = '507f1f77bcf86cd799439099';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('departmentService.create — manager validation (UC-06)', () => {
  it('rejects a head that is not an active employee with ORG_008', async () => {
    repo.findByCode.mockResolvedValue(null as never);
    EmployeeMock.findById.mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(
      departmentService.create(
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
      { _id: A, parentDepartmentId: null },
      { _id: B, parentDepartmentId: A },
    ] as never);

    await expect(
      departmentService.move(A, { parentDepartmentId: B }, AUDIT_USER),
    ).rejects.toMatchObject({ code: 'ORG_009' });
  });
});

describe('departmentService.archive — sub-department guard (UC-05)', () => {
  it('blocks archive when an active sub-department exists with ORG_011', async () => {
    EmployeeMock.countDocuments.mockResolvedValue(0);
    repo.findChildren.mockResolvedValue([{ status: 'active' }] as never);

    await expect(
      departmentService.archive('507f1f77bcf86cd799439003', AUDIT_USER),
    ).rejects.toMatchObject({ code: 'ORG_011' });
  });
});

describe('departmentService.assignHead — remove head (UC-07)', () => {
  it('clears managerId without validating an employee', async () => {
    repo.updateById.mockResolvedValue({ toJSON: () => ({ managerId: null }) } as never);

    const result = await departmentService.assignHead(
      '507f1f77bcf86cd799439004',
      null,
      AUDIT_USER,
    );

    expect(result).toEqual({ managerId: null });
    expect(EmployeeMock.findById).not.toHaveBeenCalled();
  });
});

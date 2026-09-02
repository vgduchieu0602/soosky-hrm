import { z } from 'zod';
import { CONTRACT_TYPE, EMPLOYMENT_STATUS } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';
import { EMPLOYEE_TYPE } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { SEPARATION_TYPE } from '@modules/hrm/core/employee/domain/employee-lifecycle';

const objectId = z.string().length(24);
/** Lý do là bắt buộc với mọi thay đổi vòng đời — lịch sử không có lý do là vô dụng. */
const reason = z.string().min(3).max(500).trim();

/** Điều chuyển phòng ban; kèm đổi chức vụ/quản lý nếu chuyển kéo theo. */
export const transferDepartmentDto = z
  .object({
    newDepartmentId: objectId,
    newPositionId: objectId.optional(),
    newManagerId: objectId.nullable().optional(),
    effectiveDate: z.coerce.date(),
    reason,
  })
  .strict();
export type TransferDepartmentDto = z.infer<typeof transferDepartmentDto>;

/** Đổi chức vụ; `changeType` phân biệt điều chuyển ngang và thăng chức. */
export const changePositionDto = z
  .object({
    newPositionId: objectId,
    changeType: z.enum(['position_change', 'promotion']).default('position_change'),
    effectiveDate: z.coerce.date(),
    reason,
  })
  .strict();
export type ChangePositionDto = z.infer<typeof changePositionDto>;

/** Đổi quản lý trực tiếp. `null` = gỡ quản lý. */
export const changeManagerDto = z
  .object({
    newManagerId: objectId.nullable(),
    effectiveDate: z.coerce.date(),
    reason,
  })
  .strict();
export type ChangeManagerDto = z.infer<typeof changeManagerDto>;

/** Hoàn tất thử việc: hợp đồng đang hiệu lực chuyển sang chính thức. */
export const completeProbationDto = z
  .object({
    effectiveDate: z.coerce.date(),
    reason,
  })
  .strict();
export type CompleteProbationDto = z.infer<typeof completeProbationDto>;

/** Gia hạn thử việc: dời ngày kết thúc của hợp đồng thử việc. */
export const extendProbationDto = z
  .object({
    newEndDate: z.coerce.date(),
    reason,
  })
  .strict();
export type ExtendProbationDto = z.infer<typeof extendProbationDto>;

/**
 * Thay đổi lương: KHÔNG sửa hợp đồng cũ mà kết thúc nó và lập hợp đồng mới, để
 * kỳ lương đã chốt vẫn giữ nguyên ảnh chụp lương của nó.
 */
export const changeSalaryDto = z
  .object({
    newBaseSalary: z.coerce.number().nonnegative(),
    contractNumber: z.string().min(1).max(80).trim(),
    contractType: z.enum(CONTRACT_TYPE).optional(),
    employmentStatus: z.enum(EMPLOYMENT_STATUS).optional(),
    endDate: z.coerce.date().optional(),
    effectiveDate: z.coerce.date(),
    reason,
  })
  .strict();
export type ChangeSalaryDto = z.infer<typeof changeSalaryDto>;

/** Kết thúc hợp tác — nghỉ theo nguyện vọng hoặc chấm dứt từ phía công ty. */
export const endEmploymentDto = z
  .object({
    separationType: z.enum(SEPARATION_TYPE),
    noticeDate: z.coerce.date().optional(),
    lastWorkingDate: z.coerce.date(),
    reason,
    note: z.string().max(1000).trim().optional(),
  })
  .strict();
export type EndEmploymentDto = z.infer<typeof endEmploymentDto>;

/** Tái tuyển: giữ nguyên hồ sơ/lịch sử cũ, mở một giai đoạn làm việc mới. */
export const rehireDto = z
  .object({
    rehireDate: z.coerce.date(),
    departmentId: objectId,
    positionId: objectId,
    managerId: objectId.nullable().optional(),
    employeeType: z.enum(EMPLOYEE_TYPE).optional(),
    contract: z
      .object({
        contractType: z.enum(CONTRACT_TYPE),
        employmentStatus: z.enum(EMPLOYMENT_STATUS).default('probation'),
        contractNumber: z.string().min(1).max(80).trim(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional(),
        baseSalary: z.coerce.number().nonnegative(),
        currency: z.string().min(3).max(3).default('VND'),
      })
      .strict()
      .optional(),
    reason,
  })
  .strict();
export type RehireDto = z.infer<typeof rehireDto>;

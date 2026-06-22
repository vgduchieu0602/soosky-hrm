import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { employeeService } from '@features/employee/services/employee.service';
import type { ImportEmployeeRowDto } from '@features/employee/dto/import-employees.dto';

const log = logger.child({ feature: 'employee', module: 'import' });

export interface ImportRowResult {
  index: number;
  employeeCode: string;
  status: 'created' | 'error';
  employeeId?: string;
  error?: string;
}

export const employeeImportService = {
  /**
   * Bulk-create employees from parsed CSV rows. Each row is resolved
   * (departmentCode/positionCode → ids) and created independently — a bad row
   * is reported and skipped, never aborting the batch.
   */
  async importEmployees(rows: ImportEmployeeRowDto[], auditUserId: string) {
    // Pre-resolve code → id maps in one pass (case-insensitive on trimmed code).
    const [depts, positions] = await Promise.all([
      Department.find({}).select('code').lean(),
      Position.find({}).select('code').lean(),
    ]);
    const deptByCode = new Map(depts.map((d) => [d.code.toUpperCase(), String(d._id)]));
    const posByCode = new Map(positions.map((p) => [p.code.toUpperCase(), String(p._id)]));

    const results: ImportRowResult[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      try {
        const departmentId = deptByCode.get(row.departmentCode.toUpperCase());
        if (!departmentId) throw new HttpError(404, `Mã phòng ban không tồn tại: ${row.departmentCode}`, 'ORG_001');
        const positionId = posByCode.get(row.positionCode.toUpperCase());
        if (!positionId) throw new HttpError(404, `Mã chức vụ không tồn tại: ${row.positionCode}`, 'ORG_005');

        const created = await employeeService.create(
          {
            employeeCode: row.employeeCode,
            departmentId,
            positionId,
            hireDate: row.hireDate,
            employeeType: row.employeeType,
            salaryZone: row.salaryZone,
            profile: {
              firstName: row.firstName,
              middleName: row.middleName,
              lastName: row.lastName,
              gender: row.gender,
              email: row.email,
              phone: row.phone,
            },
          },
          auditUserId,
        );
        results.push({ index: i, employeeCode: row.employeeCode, status: 'created', employeeId: String(created._id) });
      } catch (e) {
        results.push({
          index: i,
          employeeCode: row.employeeCode,
          status: 'error',
          error: e instanceof HttpError ? e.message : 'Lỗi không xác định',
        });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    log.info({ total: rows.length, created, failed: rows.length - created }, 'employee import finished');
    return { total: rows.length, created, failed: rows.length - created, results };
  },
};

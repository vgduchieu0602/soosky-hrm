import { vi } from 'vitest';
/**
 * TIER 1 — HTTP integration cho nhập/xuất CSV nhân viên, chạy qua đúng chuỗi
 * middleware thật trên MongoDB replica set trong bộ nhớ (giao dịch chạy thật).
 *
 * Điều được khoá: xem trước không ghi gì; ghi thật chỉ chạy khi sạch lỗi và đúng
 * checksum; nhập vẫn sinh lịch sử/audit như thao tác tay; và bản xuất tôn trọng
 * bộ lọc lẫn phạm vi quyền.
 */
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@/test-support/http';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { EmployeeHistory } from '@shared/models/employee-history.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeBankAccount } from '@shared/models/employee-bank-account.model';
import { AuditLog } from '@shared/models/audit-log.model';
import { IMPORT_COLUMNS, EXPORT_COLUMNS } from '@features/employee/domain/employee-csv-schema';

vi.setConfig({ testTimeout: 90_000 });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const hr = () => bearer(tokenFor(['hr_manager']).token);
const employee = () => bearer(tokenFor(['employee']).token);

let seq = 0;
const uniq = () => `${Date.now()}${(seq += 1)}`;

const stripBom = (csv: string) => csv.replace(/^﻿/, '');
const lines = (csv: string) => stripBom(csv).trim().split('\r\n');

async function seedOrg() {
  const suffix = uniq();
  const eng = await Department.create({ name: 'Engineering', code: `ENG${suffix}` });
  const sales = await Department.create({ name: 'Sales', code: `SAL${suffix}` });
  const dev = await Position.create({ title: 'Backend Engineer', code: `BE${suffix}`, departmentId: eng._id, level: 1 });
  return { engCode: eng.code, salesCode: sales.code, devCode: dev.code, engId: eng._id.toString(), devId: dev._id.toString() };
}

function csvRow(org: { engCode: string; devCode: string }, overrides: Record<string, string> = {}) {
  return {
    employee_code: `EMP${uniq()}`,
    last_name: 'Nguyễn',
    middle_name: 'Văn',
    first_name: 'An',
    department_code: org.engCode,
    position_code: org.devCode,
    employment_type: 'full_time',
    join_date: '2026-01-15',
    ...overrides,
  };
}

async function previewImport(rows: Record<string, string>[], mode: 'CREATE_ONLY' | 'UPSERT' = 'CREATE_ONLY') {
  const res = await api
    .post('/api/v1/admin/employees/import/preview')
    .set(hr())
    .send({ mode, rows, headers: [...IMPORT_COLUMNS], fileName: 'nhan-vien.csv' });
  return res;
}

async function commitImport(
  rows: Record<string, string>[],
  previewBody: { importId: string; checksum: string },
  mode: 'CREATE_ONLY' | 'UPSERT' = 'CREATE_ONLY',
) {
  return await api
    .post('/api/v1/admin/employees/import/commit')
    .set(hr())
    .send({
      importId: previewBody.importId,
      checksum: previewBody.checksum,
      mode,
      rows,
      headers: [...IMPORT_COLUMNS],
      fileName: 'nhan-vien.csv',
    });
}

describe('Tệp mẫu & đặc tả cột', () => {
  it('tải được tệp mẫu CSV có BOM, đủ cột nhập được, chỉ một dòng header', async () => {
    const res = await api.get('/api/v1/employees/import/template').set(hr()).expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('employees-import-template.csv');
    expect(res.text.startsWith('﻿')).toBe(true);

    const rows = lines(res.text);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.split(',')).toEqual([...IMPORT_COLUMNS]);
  });

  it('đặc tả cột đủ dữ liệu để giao diện dựng bảng hướng dẫn', async () => {
    const res = await api.get('/api/v1/employees/import/schema').set(hr()).expect(200);

    expect(res.body.data.dateFormat).toBe('YYYY-MM-DD');
    const code = res.body.data.columns.find((c: { key: string }) => c.key === 'employee_code');
    expect(code).toMatchObject({ required: true, importable: true, label: 'Mã nhân viên' });
  });

  it('nhân viên thường không tải được tệp mẫu (403)', async () => {
    await api.get('/api/v1/employees/import/template').set(employee()).expect(403);
  });
});

describe('Xem trước', () => {
  it('không ghi bất cứ gì và trả tham chiếu đã tra được', async () => {
    const org = await seedOrg();

    const res = await previewImport([csvRow(org)]);

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0, createRows: 1 });
    expect(res.body.data.rows[0].resolved).toMatchObject({
      departmentId: org.engId, departmentName: 'Engineering',
      positionId: org.devId,
    });
    expect(res.body.data.rows[0].resolved.positionName).toBe('Backend Engineer');
    expect(await Employee.countDocuments({})).toBe(0);
  });

  it('báo lỗi theo từng dòng/từng cột, không trả "CSV không hợp lệ"', async () => {
    const org = await seedOrg();

    const res = await previewImport([
      csvRow(org),
      csvRow(org, { department_code: 'KHONG-CO' }),
      csvRow(org, { work_email: 'sai-email' }),
    ]);

    expect(res.body.data.summary).toMatchObject({ totalRows: 3, validRows: 1, invalidRows: 2 });
    expect(res.body.data.rows[1]).toMatchObject({ rowNumber: 3, valid: false });
    expect(res.body.data.rows[1].errors[0].field).toBe('department_code');
    expect(res.body.data.rows[2].errors[0].field).toBe('work_email');
  });

  it('thiếu cột bắt buộc trong header → chặn', async () => {
    const org = await seedOrg();

    const res = await api
      .post('/api/v1/admin/employees/import/preview')
      .set(hr())
      .send({ rows: [csvRow(org)], headers: ['employee_code', 'first_name'] });

    expect(res.status).toBe(200);
    expect(res.body.data.headers.missing).toContain('last_name');
    expect(res.body.data.summary.invalidRows).toBe(1);
  });

  it('ghi audit bước xem trước (chỉ metadata)', async () => {
    const org = await seedOrg();

    await previewImport([csvRow(org, { personal_email: 'rieng@tu.com' })]);

    const entry = await AuditLog.findOne({ resource: 'employeeImport', action: 'preview' });
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry!.changes)).toContain('nhan-vien.csv');
    expect(JSON.stringify(entry!.changes)).not.toContain('rieng@tu.com');
  });

  it('vượt trần số dòng bị chặn với thông báo rõ ràng', async () => {
    const org = await seedOrg();
    const rows = Array.from({ length: 5001 }, () => csvRow(org));

    const res = await api
      .post('/api/v1/admin/employees/import/preview')
      .set(hr())
      .send({ rows, headers: [...IMPORT_COLUMNS] });

    // Hoặc bị chặn vì quá số dòng, hoặc vì vượt trần dung lượng — cả hai đều là
    // lỗi 4xx có thông báo, KHÔNG phải 500.
    expect([413, 422, 400]).toContain(res.status);
    expect(res.body.error.message).toBeTruthy();
  });
});

describe('Ghi thật', () => {
  it('tạo nhân viên, hồ sơ, hợp đồng đầu tiên và tài khoản ngân hàng chính', async () => {
    const org = await seedOrg();
    const rows = [
      csvRow(org, {
        work_email: 'an.nv@soosky.co',
        phone: '0901234567',
        contract_number: `HD-${uniq()}`,
        contract_start_date: '2026-01-15',
        contract_base_salary: '15000000',
        contract_employment_status: 'probation',
        bank_name: 'VCB',
        bank_account_number: '0123456789',
        bank_account_holder: 'NGUYEN VAN AN',
      }),
    ];
    const preview = await previewImport(rows);

    const res = await commitImport(rows, preview.body.data);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 1, updated: 0, failed: 0 });

    const created = await Employee.findOne({ employeeCode: rows[0]!.employee_code });
    expect(created).toBeTruthy();
    expect(await EmployeeProfile.countDocuments({ employeeId: created!._id })).toBe(1);
    const contract = await EmployeeContractModel.findOne({ employeeId: created!._id });
    expect(contract).toMatchObject({ employmentStatus: 'probation', status: 'active' });
    const bank = await EmployeeBankAccount.findOne({ employeeId: created!._id });
    expect(bank).toMatchObject({ bankName: 'VCB', isPrimary: true });
  });

  it('sinh lịch sử `hired` — nhập không đi vòng qua domain', async () => {
    const org = await seedOrg();
    const rows = [csvRow(org)];
    const preview = await previewImport(rows);

    expect((await commitImport(rows, preview.body.data)).status).toBe(200);

    const created = await Employee.findOne({ employeeCode: rows[0]!.employee_code });
    expect(await EmployeeHistory.countDocuments({ employeeId: created!._id, eventType: 'hired' })).toBe(1);
  });

  it('quản lý trỏ tới người cũng được tạo trong cùng tệp, dù đứng sau', async () => {
    const org = await seedOrg();
    const managerCode = `MGR${uniq()}`;
    const rows = [
      csvRow(org, { employee_code: `SUB${uniq()}`, manager_employee_code: managerCode }),
      csvRow(org, { employee_code: managerCode }),
    ];
    const preview = await previewImport(rows);
    expect(preview.body.data.summary.invalidRows).toBe(0);

    expect((await commitImport(rows, preview.body.data)).status).toBe(200);

    const manager = await Employee.findOne({ employeeCode: managerCode });
    const subordinate = await Employee.findOne({ employeeCode: rows[0]!.employee_code });
    expect(String(subordinate?.managerId)).toBe(String(manager?._id));
  });

  it('còn dòng lỗi → 422, không ghi gì', async () => {
    const org = await seedOrg();
    const rows = [csvRow(org), csvRow(org, { department_code: 'KHONG-CO' })];
    const preview = await previewImport(rows);

    const res = await commitImport(rows, preview.body.data);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMP_021');
    expect(await Employee.countDocuments({})).toBe(0);
  });

  it('checksum lệch (dữ liệu đổi sau khi duyệt) → 409', async () => {
    const org = await seedOrg();
    const rows = [csvRow(org)];
    const preview = await previewImport(rows);

    const res = await commitImport([{ ...rows[0]!, first_name: 'Bình' }], preview.body.data);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMP_020');
    expect(await Employee.countDocuments({})).toBe(0);
  });

  it('CREATE_ONLY từ chối mã đã tồn tại', async () => {
    const org = await seedOrg();
    const rows = [csvRow(org)];
    const first = await previewImport(rows);
    expect((await commitImport(rows, first.body.data)).status).toBe(200);

    const again = await previewImport(rows);

    expect(again.body.data.summary.invalidRows).toBe(1);
    expect(again.body.data.rows[0].errors[0].field).toBe('employee_code');
  });

  it('UPSERT cập nhật người đã có và ghi lịch sử điều chuyển', async () => {
    const org = await seedOrg();
    const rows = [csvRow(org)];
    const first = await previewImport(rows);
    expect((await commitImport(rows, first.body.data)).status).toBe(200);
    const created = await Employee.findOne({ employeeCode: rows[0]!.employee_code });

    const updatedRows = [{ ...rows[0]!, department_code: org.salesCode, employment_type: 'part_time' }];
    const second = await previewImport(updatedRows, 'UPSERT');
    expect(second.body.data.summary).toMatchObject({ updateRows: 1, createRows: 0 });

    const res = await commitImport(updatedRows, second.body.data, 'UPSERT');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 0, updated: 1 });
    const after = await Employee.findById(created!._id);
    expect(after?.employeeType).toBe('part_time');
    expect(await EmployeeHistory.countDocuments({ employeeId: created!._id, eventType: 'transfer' })).toBe(1);
  });

  it('UPSERT: ô trống KHÔNG xoá dữ liệu đang có', async () => {
    const org = await seedOrg();
    const rows = [csvRow(org, { phone: '0901234567', address: 'Hà Nội' })];
    const first = await previewImport(rows);
    expect((await commitImport(rows, first.body.data)).status).toBe(200);
    const created = await Employee.findOne({ employeeCode: rows[0]!.employee_code });

    // Tệp thứ hai thiếu hẳn cột phone/address.
    const slim = [
      {
        employee_code: rows[0]!.employee_code,
        last_name: 'Nguyễn',
        first_name: 'An',
        department_code: org.engCode,
        position_code: org.devCode,
        employment_type: 'full_time',
        join_date: '2026-01-15',
      },
    ];
    const second = await previewImport(slim, 'UPSERT');
    expect((await commitImport(slim, second.body.data, 'UPSERT')).status).toBe(200);

    const profile = await EmployeeProfile.findOne({ employeeId: created!._id });
    expect(profile?.phone).toBe('0901234567');
    expect(profile?.address).toBe('Hà Nội');
  });

  it('ghi audit bước commit (chỉ metadata)', async () => {
    const org = await seedOrg();
    const rows = [csvRow(org)];
    const preview = await previewImport(rows);

    expect((await commitImport(rows, preview.body.data)).status).toBe(200);

    const entry = await AuditLog.findOne({ resource: 'employeeImport', action: 'commit' });
    expect(entry).toBeTruthy();
    expect(entry!.changes).toMatchObject({ created: 1, updated: 0 });
  });

  it('nhân viên thường không được nhập (403)', async () => {
    const org = await seedOrg();
    await api
      .post('/api/v1/admin/employees/import/preview')
      .set(employee())
      .send({ rows: [csvRow(org)] })
      .expect(403);
  });
});

describe('Xuất CSV', () => {
  async function seedTwoEmployees(org: Awaited<ReturnType<typeof seedOrg>>) {
    const rows = [
      csvRow(org, { work_email: 'a@soosky.co', tax_code: 'TAX-1', bank_name: 'VCB', bank_account_number: '0123' }),
      csvRow(org, { department_code: org.salesCode, work_email: 'b@soosky.co' }),
    ];
    const preview = await previewImport(rows);
    expect((await commitImport(rows, preview.body.data)).status).toBe(200);
    return rows;
  }

  it('xuất đủ cột, ô trống vẫn giữ cột', async () => {
    const org = await seedOrg();
    await seedTwoEmployees(org);

    const res = await api.get('/api/v1/employees/export').set(hr()).expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    const rows = lines(res.text);
    expect(rows[0]!.split(',')).toEqual([...EXPORT_COLUMNS]);
    for (const line of rows.slice(1)) {
      expect(line.split(',')).toHaveLength(EXPORT_COLUMNS.length);
    }
  });

  it('giữ nguyên bộ lọc HR đang xem', async () => {
    const org = await seedOrg();
    const rows = await seedTwoEmployees(org);
    const engDept = await Department.findOne({ code: org.engCode });

    const res = await api
      .get(`/api/v1/employees/export?departmentId=${engDept!._id.toString()}`)
      .set(hr())
      .expect(200);

    const body = lines(res.text);
    expect(body).toHaveLength(2); // header + 1 nhân viên
    expect(body[1]).toContain(rows[0]!.employee_code);
    expect(body[1]).not.toContain(rows[1]!.employee_code);
  });

  it('tiếng Việt và BOM được giữ để Excel mở đúng', async () => {
    const org = await seedOrg();
    await seedTwoEmployees(org);

    const res = await api.get('/api/v1/employees/export').set(hr()).expect(200);

    expect(res.text.startsWith('﻿')).toBe(true);
    expect(res.text).toContain('Nguyễn');
  });

  it('ghi audit hành động xuất', async () => {
    const org = await seedOrg();
    await seedTwoEmployees(org);

    await api.get('/api/v1/employees/export?status=onboarding').set(hr()).expect(200);

    const entry = await AuditLog.findOne({ resource: 'employee', action: 'export' });
    expect(entry).toBeTruthy();
    expect(entry!.changes).toMatchObject({ format: 'csv', includeSensitive: true });
  });

  it('nhân viên thường không xuất được danh sách (403)', async () => {
    await api.get('/api/v1/employees/export').set(employee()).expect(403);
  });
});

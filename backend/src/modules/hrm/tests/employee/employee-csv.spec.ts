/**
 * Lược đồ CSV chuẩn + bộ ghi CSV — thuần, không DB.
 *
 * Điều được khoá: một nguồn cột duy nhất cho tệp mẫu/bản xuất/trình nhập; cột
 * luôn tồn tại kể cả khi ô rỗng; tiếng Việt không hỏng khi mở bằng Excel; và ô
 * bắt đầu bằng ký tự công thức không bị bảng tính thực thi.
 */
import {
  EMPLOYEE_CSV_SCHEMA,
  EXPORT_COLUMNS,
  IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
  SENSITIVE_COLUMNS,
  csvColumn,
  csvSchemaForClient,
} from '@modules/hrm/core/employee/domain/employee-csv-schema';
import { CsvEmployeeExporter } from '@modules/hrm/adapters/files/employee-csv';
import {
  inspectHeaders,
  missingRequired,
  normalizeRow,
  validateCells,
} from '@modules/hrm/core/employee/domain/employee-csv-row';

const exporter = new CsvEmployeeExporter();
const stripBom = (csv: string) => csv.replace(/^﻿/, '');
const lines = (csv: string) => stripBom(csv).trim().split('\r\n');

function employeeRow(overrides: Record<string, unknown> = {}) {
  return {
    employeeCode: 'EMP001',
    employeeType: 'full_time',
    status: 'active',
    hireDate: new Date('2026-01-15T00:00:00.000Z'),
    userId: 'user-1',
    profile: { lastName: 'Nguyễn', middleName: 'Văn', firstName: 'An', workEmail: 'a@company.com', phone: '0900000000', taxCode: 'TAX-9' },
    departmentId: { code: 'ENG', name: 'Engineering' },
    positionId: { code: 'BE01', title: 'Backend Engineer' },
    managerId: { employeeCode: 'EMP010', profile: { lastName: 'Trần', firstName: 'B', workEmail: 'b@company.com' } },
    bankAccount: { bankName: 'VCB', accountNumber: '0123456789', accountHolder: 'NGUYEN VAN AN', isPrimary: true },
    contract: { contractNumber: 'HD-1', contractType: 'fixed_term', employmentStatus: 'official', startDate: new Date('2026-01-15T00:00:00.000Z'), baseSalary: '15000000', status: 'active' },
    ...overrides,
  };
}

describe('lược đồ CSV chuẩn', () => {
  it('mọi cột đều khai báo nguồn từ model thật', () => {
    for (const column of EMPLOYEE_CSV_SCHEMA) {
      expect(column.source).toMatch(/^(Employee|EmployeeProfile|EmployeeBankAccount|EmployeeContract|Department|Position)\./);
    }
  });

  it('cột bắt buộc khớp business rule tạo nhân viên', () => {
    expect([...REQUIRED_COLUMNS].sort()).toEqual(
      ['department_code', 'employee_code', 'employment_type', 'first_name', 'join_date', 'last_name', 'position_code'].sort(),
    );
  });

  it('cột chỉ đọc không nằm trong tập nhập được', () => {
    for (const key of ['status', 'termination_date', 'contract_status', 'has_login_account']) {
      expect(IMPORT_COLUMNS).not.toContain(key);
      expect(EXPORT_COLUMNS).toContain(key);
    }
  });

  it('đánh dấu đúng các cột nhạy cảm', () => {
    for (const key of ['bank_account_number', 'contract_base_salary', 'tax_code', 'social_insurance_no', 'date_of_birth']) {
      expect(SENSITIVE_COLUMNS).toContain(key);
    }
    expect(SENSITIVE_COLUMNS).not.toContain('employee_code');
  });

  it('bản gửi cho giao diện đủ thông tin dựng bảng hướng dẫn', () => {
    const client = csvSchemaForClient();
    expect(client.dateFormat).toBe('YYYY-MM-DD');
    const code = client.columns.find((c) => c.key === 'employee_code')!;
    expect(code).toMatchObject({ label: 'Mã nhân viên', required: true, importable: true, example: 'EMP001' });
    const gender = client.columns.find((c) => c.key === 'gender')!;
    expect(gender.enumValues).toContain('male');
  });
});

describe('tệp mẫu', () => {
  it('có BOM để Excel đọc đúng tiếng Việt', () => {
    expect(exporter.template().startsWith('﻿')).toBe(true);
  });

  it('chứa ĐỦ cột nhập được, và CHỈ một dòng header (không có dòng ví dụ)', () => {
    const rows = lines(exporter.template());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.split(',')).toEqual([...IMPORT_COLUMNS]);
  });
});

describe('bản xuất', () => {
  it('giữ nguyên số cột kể cả khi thiếu dữ liệu — ô trống chứ không bỏ cột', () => {
    const csv = lines(
      exporter.export([
        employeeRow({ profile: { lastName: 'Trần', firstName: 'B' }, managerId: null, bankAccount: null, contract: null }),
      ]),
    );
    const header = csv[0]!.split(',');
    const row = csv[1]!.split(',');
    expect(header).toEqual([...EXPORT_COLUMNS]);
    expect(row).toHaveLength(header.length);
    expect(row[header.indexOf('manager_employee_code')]).toBe('');
    expect(row[header.indexOf('bank_account_number')]).toBe('');
  });

  it('không dùng N/A hay null cho ô trống', () => {
    const csv = exporter.export([employeeRow({ bankAccount: null, contract: null })]);
    expect(csv).not.toMatch(/,(N\/A|null|undefined|-),/);
  });

  it('giữ nguyên tiếng Việt có dấu', () => {
    const csv = exporter.export([employeeRow()]);
    expect(csv).toContain('Nguyễn');
    expect(csv).toContain('Văn');
  });

  it('bọc đúng chuẩn khi ô có dấu phẩy, nháy kép hoặc xuống dòng', () => {
    const csv = exporter.export([
      employeeRow({ profile: { lastName: 'Lê', firstName: 'C', address: 'Số 1, ngõ "A"\nHà Nội' } }),
    ]);
    expect(csv).toContain('"Số 1, ngõ ""A""\nHà Nội"');
  });

  it('vô hiệu hoá công thức: ô mở đầu bằng = + - @ được thêm dấu nháy', () => {
    const csv = exporter.export([
      employeeRow({ profile: { lastName: 'X', firstName: 'Y', address: '=cmd|calc' }, employeeCode: '@EVIL' }),
    ]);
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain("'@EVIL");
  });

  it('số âm KHÔNG bị coi là công thức', () => {
    const csv = exporter.export([employeeRow({ contract: { baseSalary: '-1500', contractNumber: 'HD-2' } })]);
    expect(csv).toContain(',-1500,');
  });

  it('ẩn dữ liệu nhạy cảm nhưng vẫn giữ nguyên cột', () => {
    const csv = lines(exporter.export([employeeRow()], false));
    const header = csv[0]!.split(',');
    const row = csv[1]!.split(',');
    expect(row).toHaveLength(header.length);
    expect(row[header.indexOf('bank_account_number')]).toBe('');
    expect(row[header.indexOf('contract_base_salary')]).toBe('');
    expect(row[header.indexOf('tax_code')]).toBe('');
    // Cột không nhạy cảm vẫn có dữ liệu.
    expect(row[header.indexOf('employee_code')]).toBe('EMP001');
  });

  it('xuất mã phòng ban/chức vụ/quản lý thay vì id nội bộ', () => {
    const csv = lines(exporter.export([employeeRow()]));
    const header = csv[0]!.split(',');
    const row = csv[1]!.split(',');
    expect(row[header.indexOf('department_code')]).toBe('ENG');
    expect(row[header.indexOf('position_code')]).toBe('BE01');
    expect(row[header.indexOf('manager_employee_code')]).toBe('EMP010');
    expect(row[header.indexOf('manager_email')]).toBe('b@company.com');
  });
});

describe('kiểm tra header', () => {
  it('phát hiện thiếu cột bắt buộc', () => {
    const report = inspectHeaders(['employee_code', 'first_name']);
    expect(report.missing).toContain('last_name');
    expect(report.missing).toContain('department_code');
  });

  it('phát hiện cột lặp', () => {
    const report = inspectHeaders([...IMPORT_COLUMNS, 'employee_code']);
    expect(report.duplicated).toEqual(['employee_code']);
  });

  it('cột lạ chỉ là cảnh báo', () => {
    const report = inspectHeaders([...IMPORT_COLUMNS, 'cot_la']);
    expect(report.unknown).toEqual(['cot_la']);
    expect(report.missing).toEqual([]);
  });
});

describe('chuẩn hoá dòng', () => {
  it('cắt khoảng trắng, bỏ ô rỗng, bỏ cột lạ và BOM sót', () => {
    expect(normalizeRow({ employee_code: '﻿ EMP001 ', middle_name: '   ', khong_biet: 'x' })).toEqual({
      employee_code: 'EMP001',
    });
  });

  it('đổi ngày kiểu Việt Nam sang ISO, giữ nguyên ISO', () => {
    expect(normalizeRow({ join_date: '15/01/2026' }).join_date).toBe('2026-01-15');
    expect(normalizeRow({ date_of_birth: '5-3-1998' }).date_of_birth).toBe('1998-03-05');
    expect(normalizeRow({ join_date: '2026-01-15' }).join_date).toBe('2026-01-15');
  });

  it('mã viết hoa, enum và email viết thường', () => {
    const row = normalizeRow({
      department_code: 'eng', position_code: 'be01', employment_type: 'FULL_TIME',
      gender: 'Male', work_email: 'A@Company.COM',
    });
    expect(row).toMatchObject({
      department_code: 'ENG', position_code: 'BE01', employment_type: 'full_time',
      gender: 'male', work_email: 'a@company.com',
    });
  });

  it('boolean nhận true/false, 1/0, yes/no', () => {
    expect(normalizeRow({ bank_is_primary: 'YES' }).bank_is_primary).toBe('true');
    expect(normalizeRow({ bank_is_primary: '0' }).bank_is_primary).toBe('false');
  });

  it('nhận ô kiểu số từ trình đọc bảng tính', () => {
    expect(normalizeRow({ phone: 901234567 }).phone).toBe('901234567');
  });
});

describe('kiểm tra ô theo lược đồ', () => {
  it('ngày sai định dạng bị chặn, không đoán theo vùng', () => {
    const issues = validateCells({ join_date: '08/09/2026' });
    expect(issues[0]!.field).toBe('join_date');
    expect(issues[0]!.message).toContain('YYYY-MM-DD');
  });

  it('enum sai được liệt kê giá trị hợp lệ', () => {
    const issues = validateCells({ employment_type: 'astronaut' });
    expect(issues[0]!.message).toContain('full_time');
  });

  it('email và số kiểm tra được', () => {
    expect(validateCells({ work_email: 'khong-phai-email' })[0]!.field).toBe('work_email');
    expect(validateCells({ contract_base_salary: 'abc' })[0]!.field).toBe('contract_base_salary');
  });

  it('cột tuỳ chọn để trống thì không có lỗi', () => {
    expect(validateCells({ employee_code: 'EMP001' })).toEqual([]);
    expect(missingRequired({ employee_code: 'EMP001' }).map((i) => i.field)).not.toContain('phone');
  });

  it('nhãn trong thông báo lấy từ lược đồ', () => {
    expect(csvColumn('join_date')?.label).toBe('Ngày vào làm');
    expect(validateCells({ join_date: 'xx' })[0]!.message).toContain('Ngày vào làm');
  });
});

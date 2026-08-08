/// <reference types="jest" />
/**
 * Nhập nhân viên từ CSV — bước xem trước và bước ghi thật, chạy trên cổng giả.
 *
 * Trọng tâm: lỗi gắn ĐÚNG cột để giao diện tô được ô sai; tham chiếu giải bằng
 * mã chứ không đoán; quản lý có thể trỏ tới người cũng nằm trong tệp; và bước ghi
 * chỉ chạy khi dữ liệu đúng bằng thứ HR đã duyệt.
 */
import { EmployeeImportUseCases, checksumOf } from '@features/employee/application/employee-import.usecases';
import type { EmployeeUseCases } from '@features/employee/application/employee.usecases';
import { normalizeRow } from '@features/employee/domain/employee-csv-row';
import { IMPORT_COLUMNS } from '@features/employee/domain/employee-csv-schema';
import type {
  AuditPort,
  BankAccountRepository,
  ContractRepository,
  Doc,
  EmployeeRepository,
  OrganizationGateway,
  UnitOfWork,
} from '@features/employee/domain/ports';


/** `createEmployeeDto` đòi id dài 24 ký tự, nên id giả trong test cũng phải đủ dài. */
const id24 = (seed: string) => seed.padEnd(24, '0');

const DEPARTMENTS = [
  { _id: id24('dept-1'), code: 'ENG', name: 'Engineering', status: 'active' },
  { _id: id24('dept-2'), code: 'OLD', name: 'Phòng cũ', status: 'archived' },
  { _id: id24('dept-3'), code: 'DUP1', name: 'Trùng tên', status: 'active' },
  { _id: id24('dept-4'), code: 'DUP2', name: 'Trùng tên', status: 'active' },
];
const POSITIONS = [{ _id: id24('pos-1'), code: 'BE01', name: 'Backend Engineer', status: 'active' }];

interface Calls {
  created: Record<string, unknown>[];
  updated: { id: string; patch: Record<string, unknown> }[];
  profiles: { id: string; patch: Record<string, unknown> }[];
  contracts: { employeeId: string; input: Record<string, unknown> }[];
  banks: { employeeId: string; input: Record<string, unknown> }[];
  audits: { resource: string; action: string; changes?: Record<string, unknown> }[];
  seeded: string[];
}

function emptyCalls(): Calls {
  return { created: [], updated: [], profiles: [], contracts: [], banks: [], audits: [], seeded: [] };
}

function build(existing: Doc[] = [], calls: Calls = emptyCalls(), failOnCode?: string) {
  const org: OrganizationGateway = {
    findDepartment: async () => null,
    findPosition: async () => null,
    listDepartmentCodes: async () => DEPARTMENTS,
    listPositionCodes: async () => POSITIONS,
    namesByIds: async () => ({ departments: {}, positions: {} }),
  };

  const employeeRepo = {
    findManyByCodes: async (codes: readonly string[]) =>
      existing.filter((e) => codes.includes(String(e.employeeCode))),
    findManyByWorkEmails: async (emails: readonly string[]) =>
      existing.filter((e) => {
        const email = ((e.profile ?? {}) as Record<string, string>).workEmail;
        return email ? emails.includes(email.toLowerCase()) : false;
      }),
  } as unknown as EmployeeRepository;

  const employees = {
    async create(input: Record<string, unknown>) {
      if (failOnCode && input.employeeCode === failOnCode) throw new Error('bất ngờ');
      calls.created.push(input);
      return { _id: `id-${input.employeeCode}` };
    },
    async update(id: string, patch: Record<string, unknown>) {
      calls.updated.push({ id, patch });
      return {};
    },
    async updateProfile(id: string, patch: Record<string, unknown>) {
      calls.profiles.push({ id, patch });
      return {};
    },
    async seedLeaveBalancesFor(ids: readonly string[]) {
      calls.seeded.push(...ids);
    },
  } as unknown as EmployeeUseCases;

  const contracts = {
    findByNumber: async () => null,
    create: async (employeeId: string, input: Record<string, unknown>) => {
      calls.contracts.push({ employeeId, input });
      return { _id: 'contract-1' };
    },
  } as unknown as ContractRepository;

  const banks = {
    create: async (employeeId: string, input: Record<string, unknown>) => {
      calls.banks.push({ employeeId, input });
      return { _id: 'bank-1' };
    },
  } as unknown as BankAccountRepository;

  const audit: AuditPort = {
    record: async (entry) => {
      calls.audits.push({ resource: entry.resource, action: entry.action, changes: entry.changes });
    },
  };

  // Giao dịch giả: cho phép khẳng định "lỗi giữa chừng thì không nửa vời".
  const uow: UnitOfWork = { withTransaction: async (work) => work('tx') };

  return { useCases: new EmployeeImportUseCases(employees, employeeRepo, contracts, banks, org, audit, uow), calls };
}

const HEADERS = [...IMPORT_COLUMNS];

function row(overrides: Record<string, string> = {}) {
  return {
    employee_code: 'EMP001',
    last_name: 'Nguyễn',
    first_name: 'An',
    department_code: 'ENG',
    position_code: 'BE01',
    employment_type: 'full_time',
    join_date: '2026-01-15',
    ...overrides,
  };
}

function existingEmployee(overrides: Record<string, unknown> = {}): Doc {
  return {
    _id: id24('emp-1'),
    employeeCode: 'EMP001',
    status: 'active',
    profile: { lastName: 'Nguyễn', firstName: 'An' },
    ...overrides,
  };
}

async function preview(useCases: EmployeeImportUseCases, rows: Record<string, unknown>[], mode: 'CREATE_ONLY' | 'UPSERT' = 'CREATE_ONLY') {
  return useCases.preview({ mode, rows, headers: HEADERS, fileName: 'test.csv' }, 'user-hr');
}

describe('preview — tổng hợp và tham chiếu', () => {
  it('dòng hợp lệ: không lỗi, trả cả id lẫn tên để biểu mẫu tự điền', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [row()]);

    expect(result.summary).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0, createRows: 1, updateRows: 0 });
    expect(result.rows[0]).toMatchObject({ rowNumber: 2, action: 'create', valid: true });
    expect(result.rows[0]!.resolved).toMatchObject({
      departmentId: id24('dept-1'), departmentCode: 'ENG', departmentName: 'Engineering',
      positionId: id24('pos-1'), positionCode: 'BE01', positionName: 'Backend Engineer',
    });
    expect(result.importId).toHaveLength(36);
    expect(result.checksum).toHaveLength(64);
  });

  it('giữ nguyên bản thô và trả bản đã chuẩn hoá để đổ vào lưới sửa', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [row({ join_date: '15/01/2026', department_code: 'eng' })]);

    expect(result.rows[0]!.raw.join_date).toBe('15/01/2026');
    expect(result.rows[0]!.normalized.join_date).toBe('2026-01-15');
    expect(result.rows[0]!.normalized.department_code).toBe('ENG');
  });

  it('KHÔNG ghi gì vào cơ sở dữ liệu', async () => {
    const { useCases, calls } = build();

    await preview(useCases, [row()]);

    expect(calls.created).toEqual([]);
    expect(calls.updated).toEqual([]);
    expect(calls.contracts).toEqual([]);
  });

  it('ghi audit chỉ với metadata, không kèm nội dung CSV', async () => {
    const { useCases, calls } = build();

    await preview(useCases, [row({ personal_email: 'rieng@tu.com' })]);

    const entry = calls.audits.find((a) => a.action === 'preview')!;
    expect(entry.resource).toBe('employeeImport');
    expect(entry.changes).toMatchObject({ fileName: 'test.csv', totalRows: 1, validRows: 1 });
    expect(JSON.stringify(entry.changes)).not.toContain('rieng@tu.com');
  });
});

describe('preview — lỗi theo dòng/theo cột', () => {
  it('thiếu cột bắt buộc trong header thì chặn cả tệp', async () => {
    const { useCases } = build();

    const result = await useCases.preview(
      { mode: 'CREATE_ONLY', rows: [row()], headers: ['employee_code', 'first_name'] },
      'user-hr',
    );

    expect(result.headers.missing).toContain('last_name');
    expect(result.summary.invalidRows).toBe(1);
    expect(result.rows[0]!.errors[0]!.message).toContain('thiếu cột bắt buộc');
  });

  it('cột lặp bị chặn, cột lạ chỉ cảnh báo', async () => {
    const { useCases } = build();

    const duplicated = await useCases.preview(
      { mode: 'CREATE_ONLY', rows: [row()], headers: [...HEADERS, 'employee_code'] },
      'user-hr',
    );
    expect(duplicated.summary.invalidRows).toBe(1);

    const unknown = await useCases.preview(
      { mode: 'CREATE_ONLY', rows: [row()], headers: [...HEADERS, 'cot_la'] },
      'user-hr',
    );
    expect(unknown.summary.invalidRows).toBe(0);
    expect(unknown.rows[0]!.warnings[0]!.message).toContain('cot_la');
  });

  it('ô bắt buộc trống báo đúng cột', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [{ employee_code: 'EMP002', department_code: 'ENG' }]);

    expect(result.rows[0]!.errors.map((e) => e.field).sort()).toEqual(
      ['employment_type', 'first_name', 'join_date', 'last_name', 'position_code'].sort(),
    );
  });

  it('mã phòng ban / chức vụ không tồn tại hoặc đã lưu trữ', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [
      row({ department_code: 'XYZ' }),
      row({ employee_code: 'EMP002', department_code: 'OLD' }),
      row({ employee_code: 'EMP003', position_code: 'ZZZ' }),
    ]);

    expect(result.rows[0]!.errors[0]).toMatchObject({ field: 'department_code' });
    expect(result.rows[1]!.errors[0]!.message).toContain('lưu trữ');
    expect(result.rows[2]!.errors[0]).toMatchObject({ field: 'position_code' });
  });

  it('giải theo TÊN khi thiếu mã, nhưng trùng tên là lỗi chứ không đoán', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [
      { ...row(), department_code: '', department_name: 'Engineering' },
      { ...row(), employee_code: 'EMP002', department_code: '', department_name: 'Trùng tên' },
    ]);

    expect(result.rows[0]!.resolved.departmentId).toBe(id24('dept-1'));
    expect(result.rows[1]!.errors[0]).toMatchObject({ field: 'department_name' });
    expect(result.rows[1]!.errors[0]!.message).toContain('department_code');
  });

  it('phát hiện trùng mã và trùng email công ty trong cùng tệp', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [
      row({ work_email: 'a@company.com' }),
      row({ work_email: 'a@company.com' }),
    ]);

    expect(result.rows[1]!.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['employee_code', 'work_email']),
    );
    expect(result.rows[1]!.errors[0]!.message).toContain('dòng 2');
  });

  it('phát hiện email công ty đã thuộc nhân viên khác trong hệ thống', async () => {
    const { useCases } = build([
      existingEmployee({ _id: id24('emp-9'), employeeCode: 'EMP009', profile: { workEmail: 'a@company.com' } }),
    ]);

    const result = await preview(useCases, [row({ employee_code: 'EMP100', work_email: 'a@company.com' })]);

    expect(result.rows[0]!.errors[0]!.message).toContain('EMP009');
  });

  it('CREATE_ONLY từ chối mã đã tồn tại', async () => {
    const { useCases } = build([existingEmployee()]);

    const result = await preview(useCases, [row()]);

    expect(result.rows[0]!.errors[0]).toMatchObject({ field: 'employee_code' });
    expect(result.rows[0]!.action).toBe('skip');
  });

  it('UPSERT nhận mã đã tồn tại và đánh dấu là cập nhật', async () => {
    const { useCases } = build([existingEmployee()]);

    const result = await preview(useCases, [row()], 'UPSERT');

    expect(result.summary).toMatchObject({ validRows: 1, createRows: 0, updateRows: 1 });
    expect(result.rows[0]!.resolved.employeeId).toBe(id24('emp-1'));
  });

  it('ngày sai định dạng và enum sai đều báo theo cột', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [row({ join_date: '2026-13-45', employment_type: 'astronaut' })]);

    const fields = result.rows[0]!.errors.map((e) => e.field);
    expect(fields).toContain('join_date');
    expect(fields).toContain('employment_type');
  });

  it('ngày kiểu 15/01/2026 được chuẩn hoá chứ không bị coi là lỗi', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [row({ join_date: '15/01/2026' })]);

    expect(result.rows[0]!.valid).toBe(true);
    expect(result.rows[0]!.normalized.join_date).toBe('2026-01-15');
  });
});

describe('preview — quản lý', () => {
  it('giải mã quản lý có sẵn trong hệ thống', async () => {
    const { useCases } = build([
      existingEmployee({ _id: id24('emp-9'), employeeCode: 'EMP009', profile: { lastName: 'Trần', firstName: 'B' } }),
    ]);

    const result = await preview(useCases, [row({ manager_employee_code: 'EMP009' })]);

    expect(result.rows[0]!.resolved).toMatchObject({ managerId: id24('emp-9'), managerName: 'Trần B', managerFromFile: false });
  });

  it('giải quản lý theo email khi thiếu mã', async () => {
    const { useCases } = build([
      existingEmployee({ _id: id24('emp-9'), employeeCode: 'EMP009', profile: { workEmail: 'sep@company.com', lastName: 'Trần', firstName: 'B' } }),
    ]);

    const result = await preview(useCases, [row({ manager_email: 'sep@company.com' })]);

    expect(result.rows[0]!.resolved.managerId).toBe(id24('emp-9'));
  });

  it('quản lý là người CŨNG đang được tạo trong cùng tệp, bất kể thứ tự dòng', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [
      row({ employee_code: 'EMP002', manager_employee_code: 'EMP001' }),
      row({ employee_code: 'EMP001' }),
    ]);

    expect(result.summary.invalidRows).toBe(0);
    expect(result.rows[0]!.resolved).toMatchObject({ managerCode: 'EMP001', managerFromFile: true, managerId: null });
  });

  it('mã quản lý không tồn tại ở đâu cả → lỗi', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [row({ manager_employee_code: 'EMP404' })]);

    expect(result.rows[0]!.errors[0]).toMatchObject({ field: 'manager_employee_code' });
  });

  it('quản lý đã nghỉ việc → lỗi', async () => {
    const { useCases } = build([existingEmployee({ _id: id24('emp-9'), employeeCode: 'EMP009', status: 'terminated' })]);

    const result = await preview(useCases, [row({ manager_employee_code: 'EMP009' })]);

    expect(result.rows[0]!.errors[0]!.message).toContain('đã nghỉ việc');
  });

  it('tự quản lý chính mình → lỗi', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [row({ manager_employee_code: 'EMP001' })]);

    expect(result.rows[0]!.errors[0]!.message).toContain('tự quản lý chính mình');
  });

  it('vòng lặp quản lý tạo ra bởi chính tệp → lỗi', async () => {
    const { useCases } = build();

    const result = await preview(useCases, [
      row({ employee_code: 'EMP001', manager_employee_code: 'EMP002' }),
      row({ employee_code: 'EMP002', manager_employee_code: 'EMP001' }),
    ]);

    expect(result.summary.invalidRows).toBeGreaterThan(0);
    expect(JSON.stringify(result.rows)).toContain('vòng lặp quản lý');
  });

  it('vòng lặp trộn dữ liệu cũ và tệp mới cũng bị bắt', async () => {
    // Trong hệ thống: EMP009 báo cáo EMP008.
    const { useCases } = build([
      existingEmployee({ _id: id24('emp-8'), employeeCode: 'EMP008' }),
      existingEmployee({ _id: id24('emp-9'), employeeCode: 'EMP009', managerId: id24('emp-8') }),
    ]);

    // Tệp cho EMP008 báo cáo EMP009 → vòng lặp.
    const result = await preview(
      useCases,
      [row({ employee_code: 'EMP008', manager_employee_code: 'EMP009' })],
      'UPSERT',
    );

    expect(result.rows[0]!.valid).toBe(false);
    expect(result.rows[0]!.errors.some((e) => e.message.includes('vòng lặp'))).toBe(true);
  });
});

describe('preview — cảnh báo hợp đồng / ngân hàng', () => {
  it('nhân viên đã tồn tại: cột hợp đồng và ngân hàng bị bỏ qua, có cảnh báo', async () => {
    const { useCases } = build([existingEmployee()]);

    const result = await preview(
      useCases,
      [row({ contract_number: 'HD-1', contract_start_date: '2026-01-15', contract_base_salary: '15000000', bank_name: 'VCB', bank_account_number: '123' })],
      'UPSERT',
    );

    const messages = result.rows[0]!.warnings.map((w) => w.message).join(' ');
    expect(messages).toContain('hợp đồng');
    expect(messages).toContain('ngân hàng');
    expect(result.rows[0]!.valid).toBe(true);
  });
});

describe('commit', () => {
  async function previewThenCommit(
    useCases: EmployeeImportUseCases,
    rows: Record<string, unknown>[],
    mode: 'CREATE_ONLY' | 'UPSERT' = 'CREATE_ONLY',
  ) {
    const p = await useCases.preview({ mode, rows, headers: HEADERS }, 'user-hr');
    return useCases.commit(
      { importId: p.importId, checksum: p.checksum, mode, rows, headers: HEADERS },
      'user-hr',
    );
  }

  it('tạo nhân viên và gieo số dư phép sau khi giao dịch xong', async () => {
    const { useCases, calls } = build();

    const outcome = await previewThenCommit(useCases, [row()]);

    expect(outcome).toMatchObject({ total: 1, created: 1, updated: 0, failed: 0 });
    expect(calls.created[0]).toMatchObject({ employeeCode: 'EMP001', departmentId: id24('dept-1'), positionId: id24('pos-1') });
    expect(calls.seeded).toEqual(['id-EMP001']);
  });

  it('lập hợp đồng đầu tiên và tài khoản ngân hàng chính khi CSV có cung cấp', async () => {
    const { useCases, calls } = build();

    await previewThenCommit(useCases, [
      row({
        contract_number: 'HD-1', contract_start_date: '2026-01-15', contract_base_salary: '15000000',
        contract_employment_status: 'probation', contract_end_date: '2026-03-15',
        bank_name: 'VCB', bank_account_number: '0123', bank_is_primary: 'yes',
      }),
    ]);

    expect(calls.contracts[0]!.input).toMatchObject({
      contractNumber: 'HD-1', employmentStatus: 'probation', baseSalary: 15_000_000, status: 'active',
    });
    expect(calls.banks[0]!.input).toMatchObject({ bankName: 'VCB', accountNumber: '0123', isPrimary: true });
  });

  it('UPSERT đi qua use-case update/updateProfile nên vẫn ghi lịch sử + audit', async () => {
    const { useCases, calls } = build([existingEmployee()]);

    const outcome = await previewThenCommit(useCases, [row({ employment_type: 'part_time' })], 'UPSERT');

    expect(outcome).toMatchObject({ created: 0, updated: 1 });
    expect(calls.updated[0]).toMatchObject({ id: id24('emp-1'), patch: { employeeType: 'part_time' } });
    expect(calls.profiles[0]!.id).toBe(id24('emp-1'));
    expect(calls.created).toEqual([]);
  });

  it('UPSERT: ô trống KHÔNG xoá dữ liệu đang có', async () => {
    const { useCases, calls } = build([existingEmployee()]);

    await previewThenCommit(useCases, [row()], 'UPSERT');

    const profile = calls.profiles[0]!.patch;
    expect(profile).toHaveProperty('lastName', 'Nguyễn');
    expect(profile).not.toHaveProperty('phone');
    expect(profile).not.toHaveProperty('address');
    expect(calls.updated[0]!.patch).not.toHaveProperty('salaryZone');
  });

  it('nối quản lý ở lượt 2 cho người được tạo trong cùng tệp', async () => {
    const { useCases, calls } = build();

    await previewThenCommit(useCases, [
      row({ employee_code: 'EMP002', manager_employee_code: 'EMP001' }),
      row({ employee_code: 'EMP001' }),
    ]);

    // Lượt 1 tạo mà chưa gán quản lý…
    expect(calls.created[0]).toMatchObject({ employeeCode: 'EMP002', managerId: undefined });
    // …lượt 2 mới nối, khi người quản lý đã có id.
    expect(calls.updated).toEqual([{ id: 'id-EMP002', patch: { managerId: 'id-EMP001' } }]);
  });

  it('checksum lệch (dữ liệu đổi sau khi duyệt) → 409', async () => {
    const { useCases } = build();
    const p = await preview(useCases, [row()]);

    await expect(
      useCases.commit(
        { importId: p.importId, checksum: p.checksum, mode: 'CREATE_ONLY', rows: [row({ first_name: 'Bình' })], headers: HEADERS },
        'user-hr',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EMP_020' });
  });

  it('còn dòng lỗi → chặn ghi (422), không tạo gì', async () => {
    const { useCases, calls } = build();
    const rows = [row(), row({ employee_code: 'EMP002', department_code: 'XYZ' })];
    const p = await preview(useCases, rows);

    await expect(
      useCases.commit({ importId: p.importId, checksum: p.checksum, mode: 'CREATE_ONLY', rows, headers: HEADERS }, 'user-hr'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'EMP_021' });
    expect(calls.created).toEqual([]);
  });

  it('một dòng hỏng bất ngờ làm hỏng cả mẻ — không để lại nửa vời', async () => {
    const { useCases, calls } = build([], emptyCalls(), 'EMP002');
    const rows = [row(), row({ employee_code: 'EMP002' })];
    const p = await preview(useCases, rows);

    await expect(
      useCases.commit({ importId: p.importId, checksum: p.checksum, mode: 'CREATE_ONLY', rows, headers: HEADERS }, 'user-hr'),
    ).rejects.toThrow('bất ngờ');
    // Giao dịch thật sẽ hoàn tác; ở đây khẳng định không có bước hậu-commit nào chạy.
    expect(calls.seeded).toEqual([]);
    expect(calls.audits.some((a) => a.action === 'commit')).toBe(false);
  });

  it('checksum tính trên dữ liệu ĐÃ chuẩn hoá nên khoảng trắng thừa không phá', async () => {
    const { useCases } = build();
    const p = await preview(useCases, [row()]);

    const outcome = await useCases.commit(
      { importId: p.importId, checksum: p.checksum, mode: 'CREATE_ONLY', rows: [row({ employee_code: '  EMP001  ' })], headers: HEADERS },
      'user-hr',
    );

    expect(outcome.created).toBe(1);
    expect(checksumOf('CREATE_ONLY', [normalizeRow(row())])).toBe(p.checksum);
  });

  it('ghi audit commit với metadata, không kèm nội dung CSV', async () => {
    const { useCases, calls } = build();

    await previewThenCommit(useCases, [row({ personal_email: 'rieng@tu.com' })]);

    const entry = calls.audits.find((a) => a.action === 'commit')!;
    expect(entry.changes).toMatchObject({ created: 1, updated: 0, totalRows: 1 });
    expect(JSON.stringify(entry.changes)).not.toContain('rieng@tu.com');
  });
});

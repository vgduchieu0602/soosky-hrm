import { createHash, randomUUID } from 'node:crypto';
import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { createEmployeeDto } from '@modules/hrm/core/employee/dto/create-employee.dto';
import type { ImportMode } from '@modules/hrm/core/employee/dto/import-employees.dto';
import type { EmployeeUseCases } from '@modules/hrm/core/employee/app/employee.usecases';
import {
  BANK_COLUMNS,
  CONTRACT_COLUMNS,
  csvColumn,
} from '@modules/hrm/core/employee/domain/employee-csv-schema';
import {
  hasAnyColumn,
  inspectHeaders,
  missingRequired,
  normalizeRow,
  validateCells,
  type FieldIssue,
  type HeaderReport,
} from '@modules/hrm/core/employee/domain/employee-csv-row';
import type {
  AuditPort,
  BankAccountRepository,
  ContractRepository,
  Doc,
  EmployeeRepository,
  OrganizationGateway,
  OrgRef,
  Tx,
  UnitOfWork,
} from '@modules/hrm/core/employee/domain/ports';

const log = logger.child({ feature: 'employee', module: 'import' });

/** Độ sâu tối đa khi dò vòng lặp quản lý — sơ đồ tổ chức thật nông hơn nhiều. */
const MAX_MANAGER_DEPTH = 50;

export interface ImportRowPreview {
  /** Vị trí trong mảng gửi lên (0-based). */
  index: number;
  /** Dòng trong bảng tính (header là dòng 1) — con số HR nhìn thấy. */
  rowNumber: number;
  action: 'create' | 'update' | 'skip';
  valid: boolean;
  /** Nguyên văn HR gửi lên. */
  raw: Record<string, unknown>;
  /** Sau khi chuẩn hoá — client đổ ngược vào lưới/biểu mẫu sửa. */
  normalized: Record<string, string>;
  /**
   * Tham chiếu đã tra được. Có cả id lẫn mã/tên để `<Select>` phía client hiển
   * thị đúng "Engineering" mà không phải gọi lại API.
   */
  resolved: {
    employeeId: string | null;
    departmentId: string | null;
    departmentCode: string | null;
    departmentName: string | null;
    positionId: string | null;
    positionCode: string | null;
    positionName: string | null;
    managerId: string | null;
    managerCode: string | null;
    managerName: string | null;
    /** Quản lý là nhân viên cũng đang được tạo trong chính tệp này. */
    managerFromFile: boolean;
  };
  errors: FieldIssue[];
  warnings: FieldIssue[];
}

export interface ImportPreview {
  importId: string;
  checksum: string;
  mode: ImportMode;
  headers: HeaderReport;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    createRows: number;
    updateRows: number;
    warningRows: number;
  };
  rows: ImportRowPreview[];
}

export interface ImportOutcome {
  importId: string;
  mode: ImportMode;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  employeeIds: string[];
}

interface PreparedRow {
  preview: ImportRowPreview;
  /** Payload đã dựng sẵn theo đúng DTO tạo nhân viên. */
  payload: Record<string, unknown> | null;
}

/** Tính checksum trên dữ liệu ĐÃ CHUẨN HOÁ nên khoảng trắng thừa không đổi kết quả. */
export function checksumOf(mode: ImportMode, rows: readonly Record<string, string>[]): string {
  return createHash('sha256').update(JSON.stringify({ mode, rows })).digest('hex');
}

function fullNameOf(doc: Doc): string {
  const p = (doc.profile ?? {}) as Record<string, string>;
  return [p.lastName, p.middleName, p.firstName].filter(Boolean).join(' ') || String(doc.employeeCode ?? '');
}

/** Ánh xạ lỗi của `createEmployeeDto` về đúng tên cột CSV. */
const DTO_PATH_TO_COLUMN: Record<string, string> = {
  employeeCode: 'employee_code',
  departmentId: 'department_code',
  positionId: 'position_code',
  managerId: 'manager_employee_code',
  hireDate: 'join_date',
  employeeType: 'employment_type',
  salaryZone: 'salary_zone',
  fingerprintId: 'fingerprint_id',
  firstName: 'first_name',
  middleName: 'middle_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  gender: 'gender',
  maritalStatus: 'marital_status',
  nationality: 'nationality',
  email: 'personal_email',
  workEmail: 'work_email',
  phone: 'phone',
  address: 'address',
  taxCode: 'tax_code',
  socialInsuranceNo: 'social_insurance_no',
  vehiclePlate: 'vehicle_plate',
};

/**
 * Nhập nhân viên từ CSV.
 *
 * Hai bước dùng CHUNG một hàm chuẩn bị dữ liệu, nên thứ HR duyệt ở bản xem trước
 * đúng bằng thứ được lưu. Bước ghi chỉ chạy khi không còn dòng lỗi và chạy trong
 * MỘT giao dịch: một dòng hỏng bất ngờ thì cả mẻ được hoàn tác.
 *
 * Mọi thao tác ghi đều đi qua use-case của nhân viên (`create`/`update`/
 * `updateProfile`), nên lịch sử và audit vẫn được ghi y như HR sửa trên giao diện.
 */
export class EmployeeImportUseCases {
  constructor(
    private readonly employees: EmployeeUseCases,
    private readonly employeeRepo: EmployeeRepository,
    private readonly contracts: ContractRepository,
    private readonly banks: BankAccountRepository,
    private readonly org: OrganizationGateway,
    private readonly audit: AuditPort,
    private readonly uow: UnitOfWork,
  ) {}

  /** Bước xem trước — không ghi bất cứ thứ gì vào cơ sở dữ liệu. */
  async preview(
    input: { mode: ImportMode; rows: Record<string, unknown>[]; headers?: string[]; fileName?: string },
    auditUserId: string,
  ): Promise<ImportPreview> {
    const headers = inspectHeaders(input.headers ?? Object.keys(input.rows[0] ?? {}));
    const prepared = await this._prepare(input.rows, input.mode, headers);
    const rows = prepared.map((p) => p.preview);
    const normalized = rows.map((r) => r.normalized);

    const preview: ImportPreview = {
      importId: randomUUID(),
      checksum: checksumOf(input.mode, normalized),
      mode: input.mode,
      headers,
      summary: {
        totalRows: rows.length,
        validRows: rows.filter((r) => r.valid).length,
        invalidRows: rows.filter((r) => !r.valid).length,
        createRows: rows.filter((r) => r.action === 'create').length,
        updateRows: rows.filter((r) => r.action === 'update').length,
        warningRows: rows.filter((r) => r.warnings.length > 0).length,
      },
      rows,
    };

    // Audit chỉ giữ metadata — KHÔNG lưu nội dung CSV (chứa PII).
    await this.audit.record({
      userId: auditUserId,
      resource: 'employeeImport',
      action: 'preview',
      changes: {
        importId: preview.importId,
        checksum: preview.checksum,
        mode: input.mode,
        fileName: input.fileName ?? null,
        ...preview.summary,
      },
    });

    return preview;
  }

  /**
   * Bước ghi thật.
   *
   * @throws HttpError 409 nếu checksum lệch — dữ liệu đã đổi sau khi HR duyệt.
   * @throws HttpError 422 nếu còn dòng lỗi, hoặc header thiếu cột bắt buộc.
   */
  async commit(
    input: {
      importId: string;
      checksum: string;
      mode: ImportMode;
      rows: Record<string, unknown>[];
      headers?: string[];
      fileName?: string;
    },
    auditUserId: string,
  ): Promise<ImportOutcome> {
    const headers = inspectHeaders(input.headers ?? Object.keys(input.rows[0] ?? {}));
    const prepared = await this._prepare(input.rows, input.mode, headers);
    const normalized = prepared.map((p) => p.preview.normalized);

    if (checksumOf(input.mode, normalized) !== input.checksum) {
      throw new HttpError(409, 'Dữ liệu đã thay đổi sau khi xem trước — hãy kiểm tra lại trước khi lưu', 'EMP_020');
    }

    const invalid = prepared.filter((p) => !p.preview.valid);
    if (invalid.length > 0) {
      throw new HttpError(
        422,
        `Còn ${invalid.length} dòng lỗi — sửa hết rồi mới lưu được (dòng ${invalid.map((p) => p.preview.rowNumber).slice(0, 10).join(', ')})`,
        'EMP_021',
      );
    }

    const createdIds: string[] = [];
    let created = 0;
    let updated = 0;

    // Toàn bộ mẻ nằm trong MỘT giao dịch: một dòng hỏng bất ngờ (ví dụ đụng mã
    // do người khác vừa tạo) thì không để lại nửa mẻ dữ liệu.
    await this.uow.withTransaction(async (tx) => {
      const idByCode = new Map<string, string>();

      // Lượt 1 — tạo/cập nhật nhân viên. Quản lý nằm trong cùng tệp thì tạm bỏ
      // trống vì người đó có thể chưa tồn tại.
      for (const { preview, payload } of prepared) {
        const code = preview.normalized.employee_code!;
        if (preview.action === 'update' && preview.resolved.employeeId) {
          await this._applyUpdate(preview, payload!, auditUserId, tx);
          idByCode.set(code, preview.resolved.employeeId);
          updated += 1;
          continue;
        }

        const employee = await this.employees.create(
          {
            ...payload,
            managerId: preview.resolved.managerFromFile ? undefined : payload!.managerId,
          } as Parameters<EmployeeUseCases['create']>[0],
          auditUserId,
          tx,
        );
        const id = String(employee._id);
        idByCode.set(code, id);
        createdIds.push(id);
        created += 1;

        await this._createContract(preview, id, auditUserId, tx);
        await this._createBankAccount(preview, id, tx);
      }

      // Lượt 2 — nối quản lý trỏ tới người vừa được tạo trong cùng tệp. Nhờ vậy
      // thứ tự dòng trong CSV không còn quan trọng.
      for (const { preview } of prepared) {
        if (!preview.resolved.managerFromFile || !preview.resolved.managerCode) continue;
        const employeeId = idByCode.get(preview.normalized.employee_code!);
        const managerId = idByCode.get(preview.resolved.managerCode);
        if (!employeeId || !managerId) continue;
        await this.employees.update(employeeId, { managerId }, auditUserId, tx);
      }
    });

    // Ngoài giao dịch: gieo số dư phép cần đọc dữ liệu đã commit.
    await this.employees.seedLeaveBalancesFor(createdIds);

    const outcome: ImportOutcome = {
      importId: input.importId,
      mode: input.mode,
      total: prepared.length,
      created,
      updated,
      skipped: 0,
      failed: 0,
      employeeIds: createdIds,
    };

    await this.audit.record({
      userId: auditUserId,
      resource: 'employeeImport',
      action: 'commit',
      changes: {
        importId: input.importId,
        checksum: input.checksum,
        mode: input.mode,
        fileName: input.fileName ?? null,
        totalRows: outcome.total,
        created,
        updated,
      },
    });

    log.info({ importId: input.importId, created, updated }, 'employee import committed');
    return outcome;
  }

  // ----------------------------------------------------------------- internal

  private async _prepare(
    rawRows: Record<string, unknown>[],
    mode: ImportMode,
    headers: HeaderReport,
  ): Promise<PreparedRow[]> {
    const normalizedRows = rawRows.map(normalizeRow);

    const [departments, positions] = await Promise.all([
      this.org.listDepartmentCodes(),
      this.org.listPositionCodes(),
    ]);
    const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const deptByName = groupByName(departments);
    const posByCode = new Map(positions.map((p) => [p.code.toUpperCase(), p]));
    const posByName = groupByName(positions);

    // Nạp gộp mọi tham chiếu của cả tệp — 3 truy vấn, không phải 3 truy vấn/dòng.
    const codes = new Set<string>();
    const emails = new Set<string>();
    for (const row of normalizedRows) {
      if (row.employee_code) codes.add(row.employee_code);
      if (row.manager_employee_code) codes.add(row.manager_employee_code);
      if (row.work_email) emails.add(row.work_email);
      if (row.manager_email) emails.add(row.manager_email);
    }
    const [byCodeRows, byEmailRows] = await Promise.all([
      codes.size ? this.employeeRepo.findManyByCodes([...codes]) : Promise.resolve([]),
      emails.size ? this.employeeRepo.findManyByWorkEmails([...emails]) : Promise.resolve([]),
    ]);
    const employeeByCode = new Map(byCodeRows.map((e) => [String(e.employeeCode), e]));
    const employeeByEmail = new Map<string, Doc>();
    for (const row of byEmailRows) {
      const email = ((row.profile ?? {}) as Record<string, string>).workEmail;
      if (email) employeeByEmail.set(email.toLowerCase(), row);
    }

    const codeFirstSeen = new Map<string, number>();
    const emailFirstSeen = new Map<string, number>();

    const prepared: PreparedRow[] = normalizedRows.map((normalized, index) => {
      const rowNumber = index + 2;
      const errors: FieldIssue[] = [];
      const warnings: FieldIssue[] = [];

      // Header hỏng thì mọi dòng đều không dùng được — nói rõ một lần trên từng dòng.
      if (headers.missing.length > 0) {
        errors.push({ field: 'row', message: `Tệp thiếu cột bắt buộc: ${headers.missing.join(', ')}` });
      }
      if (headers.duplicated.length > 0) {
        errors.push({ field: 'row', message: `Cột bị lặp trong tệp: ${headers.duplicated.join(', ')}` });
      }
      for (const column of headers.unknown) {
        warnings.push({ field: column, message: `Cột không được hỗ trợ, sẽ bỏ qua: ${column}` });
      }

      errors.push(...missingRequired(normalized), ...validateCells(normalized));

      const existing = normalized.employee_code ? employeeByCode.get(normalized.employee_code) : undefined;
      this._checkDuplicates(errors, normalized, rowNumber, codeFirstSeen, emailFirstSeen, employeeByEmail, existing);
      if (existing && mode === 'CREATE_ONLY') {
        errors.push({
          field: 'employee_code',
          message: `Mã nhân viên đã tồn tại: ${normalized.employee_code}`,
        });
      }

      const department = this._resolveOrg(errors, normalized, 'department', deptByCode, deptByName);
      const position = this._resolveOrg(errors, normalized, 'position', posByCode, posByName);
      const manager = this._resolveManager(errors, normalized, employeeByCode, employeeByEmail, normalizedRows);

      this._checkExtraGroups(warnings, normalized, Boolean(existing));

      const resolved: ImportRowPreview['resolved'] = {
        employeeId: existing ? String(existing._id) : null,
        departmentId: department?._id ?? null,
        departmentCode: department?.code ?? null,
        departmentName: department?.name ?? null,
        positionId: position?._id ?? null,
        positionCode: position?.code ?? null,
        positionName: position?.name ?? null,
        managerId: manager?.id ?? null,
        managerCode: manager?.code ?? null,
        managerName: manager?.name ?? null,
        managerFromFile: manager?.fromFile ?? false,
      };

      const payload =
        errors.length === 0 ? this._buildPayload(normalized, resolved) : null;
      if (payload) {
        // Chốt bằng chính DTO của luồng tạo nhân viên — CSV không có luật riêng.
        const parsed = createEmployeeDto.safeParse(payload);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const key = String(issue.path[issue.path.length - 1] ?? 'row');
            errors.push({ field: DTO_PATH_TO_COLUMN[key] ?? 'row', message: issue.message });
          }
        }
      }

      const valid = errors.length === 0;
      return {
        preview: {
          index,
          rowNumber,
          action: valid ? (existing ? 'update' : 'create') : 'skip',
          valid,
          raw: rawRows[index] ?? {},
          normalized,
          resolved,
          errors,
          warnings,
        },
        payload: valid ? payload : null,
      };
    });

    this._checkManagerCycles(prepared, employeeByCode);
    return prepared;
  }

  /** Trùng mã / trùng email công ty — bắt ngay trong tệp, không đợi lỗi database. */
  private _checkDuplicates(
    errors: FieldIssue[],
    row: Record<string, string>,
    rowNumber: number,
    codeFirstSeen: Map<string, number>,
    emailFirstSeen: Map<string, number>,
    employeeByEmail: Map<string, Doc>,
    existing: Doc | undefined,
  ) {
    if (row.employee_code) {
      const first = codeFirstSeen.get(row.employee_code);
      if (first !== undefined) {
        errors.push({ field: 'employee_code', message: `Mã trùng với dòng ${first} trong cùng tệp` });
      } else {
        codeFirstSeen.set(row.employee_code, rowNumber);
      }
    }

    if (row.work_email) {
      const first = emailFirstSeen.get(row.work_email);
      if (first !== undefined) {
        errors.push({ field: 'work_email', message: `Email công ty trùng với dòng ${first} trong cùng tệp` });
      } else {
        emailFirstSeen.set(row.work_email, rowNumber);
      }

      const owner = employeeByEmail.get(row.work_email);
      if (owner && (!existing || String(owner._id) !== String(existing._id))) {
        errors.push({
          field: 'work_email',
          message: `Email công ty đã thuộc về nhân viên ${owner.employeeCode}`,
        });
      }
    }
  }

  /** Giải tham chiếu phòng ban/chức vụ: ưu tiên mã, mới đến tên; trùng tên là lỗi. */
  private _resolveOrg(
    errors: FieldIssue[],
    row: Record<string, string>,
    kind: 'department' | 'position',
    byCode: Map<string, OrgRef>,
    byName: Map<string, OrgRef[]>,
  ): OrgRef | undefined {
    const codeKey = `${kind}_code`;
    const nameKey = `${kind}_name`;
    const label = csvColumn(codeKey)?.label ?? codeKey;

    const code = row[codeKey];
    if (code) {
      const found = byCode.get(code);
      if (!found) {
        errors.push({ field: codeKey, message: `${label} không tồn tại: ${code}` });
        return undefined;
      }
      if (found.status === 'archived') {
        errors.push({ field: codeKey, message: `${label} đã lưu trữ: ${code}` });
        return undefined;
      }
      return found;
    }

    const name = row[nameKey];
    if (!name) return undefined;

    const matches = (byName.get(name.toLowerCase()) ?? []).filter((r) => r.status !== 'archived');
    if (matches.length === 0) {
      errors.push({ field: nameKey, message: `Không tìm thấy theo tên: ${name}` });
      return undefined;
    }
    if (matches.length > 1) {
      errors.push({
        field: nameKey,
        message: `Có ${matches.length} bản ghi cùng tên "${name}" — hãy dùng ${codeKey}`,
      });
      return undefined;
    }
    return matches[0];
  }

  /** Quản lý: theo mã, rồi email; có thể là người đang được tạo trong cùng tệp. */
  private _resolveManager(
    errors: FieldIssue[],
    row: Record<string, string>,
    employeeByCode: Map<string, Doc>,
    employeeByEmail: Map<string, Doc>,
    allRows: readonly Record<string, string>[],
  ): { id: string | null; code: string | null; name: string | null; fromFile: boolean } | undefined {
    const code = row.manager_employee_code;
    const email = row.manager_email;
    if (!code && !email) return undefined;

    if (code) {
      if (row.employee_code && code === row.employee_code) {
        errors.push({ field: 'manager_employee_code', message: 'Nhân viên không thể tự quản lý chính mình' });
        return undefined;
      }
      const inDb = employeeByCode.get(code);
      if (inDb) {
        if (inDb.status === 'terminated') {
          errors.push({ field: 'manager_employee_code', message: `Quản lý đã nghỉ việc: ${code}` });
          return undefined;
        }
        return { id: String(inDb._id), code, name: fullNameOf(inDb), fromFile: false };
      }

      const inFile = allRows.find((r) => r.employee_code === code);
      if (inFile) {
        const name = [inFile.last_name, inFile.middle_name, inFile.first_name].filter(Boolean).join(' ');
        return { id: null, code, name: name || code, fromFile: true };
      }

      errors.push({ field: 'manager_employee_code', message: `Mã quản lý không tồn tại: ${code}` });
      return undefined;
    }

    const byEmail = employeeByEmail.get(email!);
    if (!byEmail) {
      errors.push({ field: 'manager_email', message: `Không tìm thấy quản lý theo email: ${email}` });
      return undefined;
    }
    if (byEmail.status === 'terminated') {
      errors.push({ field: 'manager_email', message: `Quản lý đã nghỉ việc: ${email}` });
      return undefined;
    }
    return {
      id: String(byEmail._id),
      code: String(byEmail.employeeCode),
      name: fullNameOf(byEmail),
      fromFile: false,
    };
  }

  /**
   * Vòng lặp báo cáo trên đồ thị GỘP: quan hệ trong tệp đè lên quan hệ đang có
   * trong database, nên phát hiện được cả vòng lặp chỉ xuất hiện sau khi nhập.
   */
  private _checkManagerCycles(prepared: PreparedRow[], employeeByCode: Map<string, Doc>) {
    const managerOf = new Map<string, string | null>();

    const codeById = new Map<string, string>();
    for (const doc of employeeByCode.values()) codeById.set(String(doc._id), String(doc.employeeCode));
    for (const doc of employeeByCode.values()) {
      managerOf.set(String(doc.employeeCode), doc.managerId ? codeById.get(String(doc.managerId)) ?? null : null);
    }
    for (const { preview } of prepared) {
      const code = preview.normalized.employee_code;
      if (!code) continue;
      managerOf.set(code, preview.resolved.managerCode);
    }

    for (const { preview } of prepared) {
      const code = preview.normalized.employee_code;
      if (!code || !preview.resolved.managerCode) continue;

      const seen = new Set<string>([code]);
      let cursor: string | null | undefined = preview.resolved.managerCode;
      let depth = 0;

      while (cursor && depth < MAX_MANAGER_DEPTH) {
        if (seen.has(cursor)) {
          preview.errors.push({
            field: 'manager_employee_code',
            message: `Phân công này tạo vòng lặp quản lý (${[...seen, cursor].join(' → ')})`,
          });
          preview.valid = false;
          preview.action = 'skip';
          break;
        }
        seen.add(cursor);
        cursor = managerOf.get(cursor) ?? null;
        depth += 1;
      }
    }
  }

  /** Cột hợp đồng / ngân hàng chỉ áp dụng khi TẠO mới — không đụng dữ liệu lịch sử. */
  private _checkExtraGroups(warnings: FieldIssue[], row: Record<string, string>, isUpdate: boolean) {
    if (!isUpdate) return;
    if (hasAnyColumn(row, CONTRACT_COLUMNS)) {
      warnings.push({
        field: 'contract_number',
        message: 'Nhân viên đã tồn tại — cột hợp đồng bị bỏ qua để không ghi đè hợp đồng cũ',
      });
    }
    if (hasAnyColumn(row, BANK_COLUMNS)) {
      warnings.push({
        field: 'bank_account_number',
        message: 'Nhân viên đã tồn tại — cột ngân hàng bị bỏ qua, hãy sửa trong hồ sơ nhân viên',
      });
    }
  }

  /** Dòng CSV → payload đúng hình dạng `createEmployeeDto`. */
  private _buildPayload(
    row: Record<string, string>,
    resolved: ImportRowPreview['resolved'],
  ): Record<string, unknown> {
    const optional = (key: string) => (row[key] === undefined ? undefined : row[key]);

    const profile: Record<string, unknown> = {
      firstName: row.first_name,
      lastName: row.last_name,
      middleName: optional('middle_name'),
      dateOfBirth: row.date_of_birth ? new Date(`${row.date_of_birth}T00:00:00.000Z`) : undefined,
      gender: optional('gender'),
      maritalStatus: optional('marital_status'),
      nationality: optional('nationality'),
      email: optional('personal_email'),
      workEmail: optional('work_email'),
      phone: optional('phone'),
      address: optional('address'),
      taxCode: optional('tax_code'),
      socialInsuranceNo: optional('social_insurance_no'),
      vehiclePlate: optional('vehicle_plate'),
    };

    return {
      employeeCode: row.employee_code,
      fingerprintId: optional('fingerprint_id'),
      departmentId: resolved.departmentId ?? undefined,
      positionId: resolved.positionId ?? undefined,
      managerId: resolved.managerId ?? undefined,
      hireDate: row.join_date ? new Date(`${row.join_date}T00:00:00.000Z`) : undefined,
      employeeType: row.employment_type,
      salaryZone: optional('salary_zone'),
      profile: dropUndefined(profile),
    };
  }

  /**
   * Cập nhật nhân viên đã có. Ô TRỐNG = KHÔNG ĐỔI: HR tải lên tệp thiếu cột sẽ
   * không vô tình xoá dữ liệu đang có.
   */
  private async _applyUpdate(
    preview: ImportRowPreview,
    payload: Record<string, unknown>,
    auditUserId: string,
    tx: Tx,
  ) {
    const employeeId = preview.resolved.employeeId!;
    const row = preview.normalized;

    const work: Record<string, unknown> = dropUndefined({
      departmentId: preview.resolved.departmentId ?? undefined,
      positionId: preview.resolved.positionId ?? undefined,
      managerId: preview.resolved.managerFromFile ? undefined : preview.resolved.managerId ?? undefined,
      fingerprintId: row.fingerprint_id,
      employeeType: row.employment_type,
      salaryZone: row.salary_zone,
    });

    await this.employees.update(
      employeeId,
      work as Parameters<EmployeeUseCases['update']>[1],
      auditUserId,
      tx,
    );

    const profile = payload.profile as Record<string, unknown>;
    if (Object.keys(profile).length > 0) {
      await this.employees.updateProfile(
        employeeId,
        profile as Parameters<EmployeeUseCases['updateProfile']>[1],
        auditUserId,
        tx,
      );
    }
  }

  /** Hợp đồng đầu tiên, chỉ khi CSV có cung cấp đủ thông tin. */
  private async _createContract(preview: ImportRowPreview, employeeId: string, auditUserId: string, tx: Tx) {
    const row = preview.normalized;
    if (!row.contract_number || !row.contract_start_date || row.contract_base_salary === undefined) return;

    const dup = await this.contracts.findByNumber(row.contract_number);
    if (dup) throw new HttpError(409, `Số hợp đồng đã tồn tại: ${row.contract_number}`, 'EMP_006');

    await this.contracts.create(
      employeeId,
      {
        contractType: row.contract_type ?? 'fixed_term',
        employmentStatus: row.contract_employment_status ?? 'official',
        contractNumber: row.contract_number,
        startDate: new Date(`${row.contract_start_date}T00:00:00.000Z`),
        endDate: row.contract_end_date ? new Date(`${row.contract_end_date}T00:00:00.000Z`) : null,
        baseSalary: Number(row.contract_base_salary),
        currency: 'VND',
        status: 'active',
      },
      tx,
    );

    await this.audit.record({
      userId: auditUserId,
      resource: 'employeeContract',
      action: 'create',
      resourceId: employeeId,
      changes: { contractNumber: row.contract_number, source: 'csv-import' },
    });
  }

  /** Tài khoản ngân hàng chính, chỉ khi CSV có cung cấp đủ thông tin. */
  private async _createBankAccount(preview: ImportRowPreview, employeeId: string, tx: Tx) {
    const row = preview.normalized;
    if (!row.bank_name || !row.bank_account_number) return;

    await this.banks.create(
      employeeId,
      {
        bankName: row.bank_name,
        branch: row.bank_branch,
        accountNumber: row.bank_account_number,
        accountHolder: row.bank_account_holder ?? [row.last_name, row.middle_name, row.first_name].filter(Boolean).join(' '),
        isPrimary: row.bank_is_primary !== 'false',
      },
      tx,
    );
  }
}

function dropUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
}

function groupByName(refs: readonly OrgRef[]): Map<string, OrgRef[]> {
  const map = new Map<string, OrgRef[]>();
  for (const ref of refs) {
    const key = ref.name.toLowerCase();
    const bucket = map.get(key);
    if (bucket) bucket.push(ref);
    else map.set(key, [ref]);
  }
  return map;
}

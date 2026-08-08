import type { CsvExportPort, Doc } from '@features/employee/domain/ports';
import {
  EMPLOYEE_CSV_SCHEMA,
  EXPORT_COLUMNS,
  IMPORT_COLUMNS,
  SENSITIVE_COLUMNS,
} from '@features/employee/domain/employee-csv-schema';

/**
 * Ghi CSV nhân viên. Tập cột lấy TRỰC TIẾP từ `EMPLOYEE_CSV_SCHEMA`, nên tệp mẫu,
 * bản xuất và trình nhập không bao giờ lệch nhau.
 *
 * Quy ước: cột luôn tồn tại, ô không có dữ liệu để TRỐNG (không `N/A`, không
 * `null`). Header là tên cột máy đọc (snake_case) để tệp xuất ra sửa xong nhập
 * lại được ngay.
 */

/** Excel trên Windows chỉ đọc đúng UTF-8 khi có BOM ở đầu tệp. */
const BOM = '﻿';

const sensitive = new Set(SENSITIVE_COLUMNS);

/**
 * Chống CSV injection: Excel/Sheets coi ô mở đầu bằng `= + - @` (hoặc tab/CR) là
 * công thức. Thêm dấu nháy đơn ở đầu để chương trình bảng tính hiểu đó là văn
 * bản. Số âm thật (`-1500`) được giữ nguyên vì không phải công thức.
 *
 * Chỉ tác động lên tệp xuất ra — dữ liệu trong database không đổi.
 */
function neutralizeFormula(text: string): string {
  if (!/^[=+\-@\t\r]/.test(text)) return text;
  if (/^-?\d+(\.\d+)?$/.test(text)) return text;
  return `'${text}`;
}

/** Bọc ô theo RFC 4180 khi chứa dấu phẩy, nháy kép hoặc xuống dòng. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (raw === '') return '';
  const text = neutralizeFormula(raw);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toLine(values: readonly unknown[]): string {
  return values.map(cell).join(',');
}

/** `Date` | ISO string → `YYYY-MM-DD`; giá trị rỗng → chuỗi rỗng. */
function day(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function nameOf(profile: Record<string, unknown> | null | undefined): string {
  if (!profile) return '';
  return [profile.lastName, profile.middleName, profile.firstName].filter(Boolean).join(' ');
}

/**
 * Một bản ghi xuất khẩu → map theo khoá cột. Nguồn dữ liệu là kết quả
 * `listForExport` (nhân viên + hồ sơ + phòng ban + chức vụ + quản lý + tài khoản
 * ngân hàng chính + hợp đồng đang hiệu lực).
 */
function rowValues(row: Doc): Record<string, unknown> {
  const profile = (row.profile ?? null) as Record<string, unknown> | null;
  const department = (row.departmentId ?? null) as Record<string, unknown> | null;
  const position = (row.positionId ?? null) as Record<string, unknown> | null;
  const manager = (row.managerId ?? null) as Record<string, unknown> | null;
  const managerProfile = (manager?.profile ?? null) as Record<string, unknown> | null;
  const bank = (row.bankAccount ?? null) as Record<string, unknown> | null;
  const contract = (row.contract ?? null) as Record<string, unknown> | null;

  return {
    employee_code: row.employeeCode,
    last_name: profile?.lastName,
    middle_name: profile?.middleName,
    first_name: profile?.firstName,
    date_of_birth: day(profile?.dateOfBirth),
    gender: profile?.gender,
    marital_status: profile?.maritalStatus,
    nationality: profile?.nationality,

    employment_type: row.employeeType,
    join_date: day(row.hireDate),
    department_code: department?.code,
    department_name: department?.name,
    position_code: position?.code,
    position_name: position?.title,
    manager_employee_code: manager?.employeeCode,
    manager_email: managerProfile?.workEmail,
    fingerprint_id: row.fingerprintId,
    salary_zone: row.salaryZone,
    status: row.status,
    termination_date: day(row.terminationDate),
    has_login_account: row.userId ? 'true' : 'false',

    work_email: profile?.workEmail,
    personal_email: profile?.email,
    phone: profile?.phone,
    address: profile?.address,
    tax_code: profile?.taxCode,
    social_insurance_no: profile?.socialInsuranceNo,
    vehicle_plate: profile?.vehiclePlate,

    bank_name: bank?.bankName,
    bank_branch: bank?.branch,
    bank_account_number: bank?.accountNumber,
    bank_account_holder: bank?.accountHolder,
    bank_is_primary: bank ? String(bank.isPrimary === true) : '',

    contract_number: contract?.contractNumber,
    contract_type: contract?.contractType,
    contract_employment_status: contract?.employmentStatus,
    contract_start_date: day(contract?.startDate),
    contract_end_date: day(contract?.endDate),
    contract_base_salary: contract?.baseSalary != null ? String(contract.baseSalary) : '',
    contract_status: contract?.status,
  };
}

export class CsvEmployeeExporter implements CsvExportPort {
  /**
   * `includeSensitive = false` vẫn GIỮ NGUYÊN cột (không bỏ cột) nhưng để trống
   * ô — người đọc thấy đúng khung dữ liệu mà không thấy nội dung nhạy cảm.
   */
  export(rows: Doc[], includeSensitive = true): string {
    const lines = [toLine(EXPORT_COLUMNS)];

    for (const row of rows) {
      const values = rowValues(row);
      lines.push(
        toLine(
          EXPORT_COLUMNS.map((key) => (!includeSensitive && sensitive.has(key) ? '' : values[key])),
        ),
      );
    }

    return BOM + lines.join('\r\n') + '\r\n';
  }

  /**
   * Tệp mẫu chỉ có DÒNG HEADER các cột nhập được — không kèm dòng ví dụ, để HR
   * không vô tình nhập chính dòng mẫu. Ví dụ từng cột hiển thị ở bảng hướng dẫn
   * trên giao diện (cũng sinh từ schema này).
   */
  template(): string {
    return BOM + toLine(IMPORT_COLUMNS) + '\r\n';
  }
}

/** Dùng cho tài liệu/kiểm thử: tổng số cột theo từng vai trò. */
export const CSV_COLUMN_COUNTS = {
  total: EMPLOYEE_CSV_SCHEMA.length,
  importable: IMPORT_COLUMNS.length,
  exportable: EXPORT_COLUMNS.length,
};

/**
 * Chuẩn hoá và kiểm tra một dòng CSV — thuần, không DB, không HTTP.
 *
 * Chỉ chuẩn hoá những gì AN TOÀN (cắt khoảng trắng, hạ/nâng hoa thường theo kiểu
 * cột, đổi ngày, đổi boolean). KHÔNG tự sửa mã nhân viên, KHÔNG dò gần đúng tên
 * phòng ban/chức vụ/quản lý: tham chiếu phải khớp tuyệt đối, sai thì báo lỗi.
 */
import {
  EMPLOYEE_CSV_SCHEMA,
  IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
  csvColumn,
  type CsvColumn,
} from '@features/employee/domain/employee-csv-schema';

export interface FieldIssue {
  field: string;
  message: string;
}

export interface HeaderReport {
  /** Cột bắt buộc không có trong tệp — chặn nhập. */
  missing: string[];
  /** Cột hệ thống không biết — chỉ cảnh báo, sẽ bỏ qua. */
  unknown: string[];
  /** Cột lặp lại trong header — chặn nhập vì không biết lấy ô nào. */
  duplicated: string[];
}

const IMPORTABLE = new Set(IMPORT_COLUMNS);
const REQUIRED = new Set(REQUIRED_COLUMNS);

/** Cột nào cần viết hoa (mã tổ chức, quốc tịch, biển số). */
const UPPERCASE_COLUMNS = new Set([
  'department_code',
  'position_code',
  'manager_employee_code',
  'employee_code',
  'nationality',
  'vehicle_plate',
]);

const TRUE_WORDS = new Set(['true', '1', 'yes', 'y', 'x', 'có', 'co']);
const FALSE_WORDS = new Set(['false', '0', 'no', 'n', 'không', 'khong']);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DMY_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `15/01/2026` → `2026-01-15`. Chỉ nhận thêm dạng ngày/tháng/năm rõ ràng; định
 * dạng nhập nhằng theo vùng (`08/09/2026` kiểu Mỹ) không được đoán.
 */
function normalizeDate(value: string): string {
  const dmy = DMY_DATE.exec(value);
  if (!dmy) return value;
  const [, d, m, y] = dmy;
  return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

function normalizeBoolean(value: string): string {
  const lower = value.toLowerCase();
  if (TRUE_WORDS.has(lower)) return 'true';
  if (FALSE_WORDS.has(lower)) return 'false';
  return value;
}

/** Kiểm tra header của tệp so với schema chuẩn. */
export function inspectHeaders(headers: readonly string[]): HeaderReport {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  const unknown: string[] = [];

  for (const raw of headers) {
    const key = raw.trim();
    if (key === '') continue;
    if (seen.has(key)) duplicated.add(key);
    seen.add(key);
    if (!IMPORTABLE.has(key)) unknown.push(key);
  }

  return {
    missing: [...REQUIRED].filter((c) => !seen.has(c)),
    unknown,
    duplicated: [...duplicated],
  };
}

/**
 * Dòng thô → dòng chuẩn. Cột lạ bị bỏ qua (đã cảnh báo ở bước header), ô rỗng bị
 * loại bỏ hẳn để phân biệt "không cung cấp" với "chuỗi rỗng".
 */
export function normalizeRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};

  for (const key of IMPORT_COLUMNS) {
    const value = raw[key];
    if (value === null || value === undefined) continue;

    // Xoá BOM sót lại và khoảng trắng hai đầu.
    let text = String(value).replace(/^﻿/, '').trim();
    if (text === '') continue;

    const column = csvColumn(key)!;
    if (column.type === 'date') text = normalizeDate(text);
    else if (column.type === 'boolean') text = normalizeBoolean(text);
    else if (column.type === 'email') text = text.toLowerCase();
    else if (column.type === 'enum') text = text.toLowerCase();
    else if (UPPERCASE_COLUMNS.has(key)) text = text.toUpperCase();

    out[key] = text;
  }

  return out;
}

/** Kiểm tra kiểu dữ liệu từng ô theo schema. Trả lỗi gắn đúng tên cột. */
export function validateCells(row: Record<string, string>): FieldIssue[] {
  const issues: FieldIssue[] = [];

  for (const column of EMPLOYEE_CSV_SCHEMA) {
    if (!column.importable) continue;
    const value = row[column.key];
    if (value === undefined) continue;
    const issue = validateCell(column, value);
    if (issue) issues.push({ field: column.key, message: issue });
  }

  return issues;
}

function validateCell(column: CsvColumn, value: string): string | null {
  switch (column.type) {
    case 'date':
      if (!ISO_DATE.test(value)) return `${column.label}: ngày phải theo dạng YYYY-MM-DD (ví dụ 2026-08-15)`;
      if (Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
        return `${column.label}: ngày không tồn tại`;
      }
      return null;
    case 'email':
      return EMAIL.test(value) ? null : `${column.label}: email không hợp lệ`;
    case 'number':
      return /^\d+(\.\d+)?$/.test(value) ? null : `${column.label}: phải là số không âm`;
    case 'boolean':
      return value === 'true' || value === 'false'
        ? null
        : `${column.label}: chỉ nhận true/false (hoặc 1/0, yes/no)`;
    case 'enum':
      return column.enumValues?.includes(value)
        ? null
        : `${column.label}: giá trị "${value}" không hợp lệ. Cho phép: ${column.enumValues?.join(', ')}`;
    default:
      return null;
  }
}

/**
 * Cột bắt buộc chấp nhận một cột thay thế: HR có thể ghi tên phòng ban/chức vụ
 * thay cho mã. Mã vẫn là cách khớp chính (xem `_resolveOrg`), tên chỉ dùng khi
 * thiếu mã và phải khớp duy nhất.
 */
const REQUIRED_ALTERNATIVES: Record<string, string> = {
  department_code: 'department_name',
  position_code: 'position_name',
};

/** Cột bắt buộc bị bỏ trống ở một dòng cụ thể. */
export function missingRequired(row: Record<string, string>): FieldIssue[] {
  const issues: FieldIssue[] = [];

  for (const key of REQUIRED) {
    if (row[key]) continue;
    const alternative = REQUIRED_ALTERNATIVES[key];
    if (alternative && row[alternative]) continue;

    const label = csvColumn(key)?.label ?? key;
    const suffix = alternative ? ` (hoặc ${csvColumn(alternative)?.label ?? alternative})` : '';
    issues.push({ field: key, message: `${label}${suffix}: bắt buộc` });
  }

  return issues;
}

/** Dòng có ít nhất một ô thuộc nhóm cột đã cho. */
export function hasAnyColumn(row: Record<string, string>, columns: readonly string[]): boolean {
  return columns.some((key) => row[key] !== undefined);
}

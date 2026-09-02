/**
 * NGUỒN DUY NHẤT cho mọi thứ liên quan CSV nhân viên: tệp mẫu, bản xuất, trình
 * nhập, kiểm tra dữ liệu và bảng hướng dẫn trên giao diện đều đọc từ đây.
 *
 * Mỗi cột được suy ra từ trường THẬT trong model hiện có (`source`), không bịa
 * thêm cột rồi phải thêm field vào database. Cột nào model không có (ví dụ
 * `full_name`, `preferred_name`, `city`, `postal_code`, `bank_code`) thì không
 * xuất hiện ở đây.
 *
 * Khoá cột là snake_case, ổn định, không dấu — dùng làm header máy đọc; phần
 * tiếng Việt nằm ở `label`/`description` cho tài liệu và giao diện.
 */
import { EMPLOYEE_TYPE, EMPLOYEE_STATUS, SALARY_ZONE } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { GENDER, MARITAL_STATUS } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';
import { CONTRACT_TYPE, CONTRACT_STATUS, EMPLOYMENT_STATUS } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';

export type CsvGroup = 'identity' | 'employment' | 'contact' | 'bank' | 'contract';

export type CsvValueType = 'string' | 'email' | 'date' | 'number' | 'boolean' | 'enum';

/** Cột nào là tham chiếu tới thực thể khác, và giải bằng mã hay bằng tên/email. */
export type CsvReference =
  | 'department_code'
  | 'department_name'
  | 'position_code'
  | 'position_name'
  | 'manager_code'
  | 'manager_email';

export interface CsvColumn {
  key: string;
  group: CsvGroup;
  /** Nhãn tiếng Việt cho bảng hướng dẫn. */
  label: string;
  /** Trường gốc trong model — để người đọc truy ngược được. */
  source: string;
  type: CsvValueType;
  enumValues?: readonly string[];
  /** Bắt buộc khi TẠO mới (khớp business rule của create employee). */
  required: boolean;
  importable: boolean;
  exportable: boolean;
  reference?: CsvReference;
  /** Dữ liệu nhạy cảm — chỉ HR/Admin được xuất. */
  sensitive: boolean;
  example?: string;
  description?: string;
}

/** Định dạng ngày duy nhất được quảng bá trong tệp mẫu và tài liệu. */
export const CSV_DATE_FORMAT = 'YYYY-MM-DD';

export const EMPLOYEE_CSV_SCHEMA: readonly CsvColumn[] = [
  // ---------------------------------------------------------------- identity
  {
    key: 'employee_code', group: 'identity', label: 'Mã nhân viên',
    source: 'Employee.employeeCode', type: 'string',
    required: true, importable: true, exportable: true, sensitive: false,
    example: 'EMP001', description: 'Duy nhất toàn hệ thống, tối thiểu 3 ký tự.',
  },
  {
    key: 'last_name', group: 'identity', label: 'Họ',
    source: 'EmployeeProfile.lastName', type: 'string',
    required: true, importable: true, exportable: true, sensitive: false,
    example: 'Nguyễn',
  },
  {
    key: 'middle_name', group: 'identity', label: 'Tên đệm',
    source: 'EmployeeProfile.middleName', type: 'string',
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'Văn',
  },
  {
    key: 'first_name', group: 'identity', label: 'Tên',
    source: 'EmployeeProfile.firstName', type: 'string',
    required: true, importable: true, exportable: true, sensitive: false,
    example: 'An',
  },
  {
    key: 'date_of_birth', group: 'identity', label: 'Ngày sinh',
    source: 'EmployeeProfile.dateOfBirth', type: 'date',
    required: false, importable: true, exportable: true, sensitive: true,
    example: '1998-05-20',
  },
  {
    key: 'gender', group: 'identity', label: 'Giới tính',
    source: 'EmployeeProfile.gender', type: 'enum', enumValues: GENDER,
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'male',
  },
  {
    key: 'marital_status', group: 'identity', label: 'Tình trạng hôn nhân',
    source: 'EmployeeProfile.maritalStatus', type: 'enum', enumValues: MARITAL_STATUS,
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'single',
  },
  {
    key: 'nationality', group: 'identity', label: 'Quốc tịch',
    source: 'EmployeeProfile.nationality', type: 'string',
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'VN', description: 'Mã 2–3 ký tự.',
  },

  // -------------------------------------------------------------- employment
  {
    key: 'employment_type', group: 'employment', label: 'Loại nhân sự',
    source: 'Employee.employeeType', type: 'enum', enumValues: EMPLOYEE_TYPE,
    required: true, importable: true, exportable: true, sensitive: false,
    example: 'full_time',
  },
  {
    key: 'join_date', group: 'employment', label: 'Ngày vào làm',
    source: 'Employee.hireDate', type: 'date',
    required: true, importable: true, exportable: true, sensitive: false,
    example: '2026-01-15',
  },
  {
    key: 'department_code', group: 'employment', label: 'Mã phòng ban',
    source: 'Department.code → Employee.departmentId', type: 'string',
    required: true, importable: true, exportable: true, reference: 'department_code', sensitive: false,
    example: 'ENG', description: 'Mã phòng ban đã tồn tại; hệ thống tự tra ra id.',
  },
  {
    key: 'department_name', group: 'employment', label: 'Tên phòng ban',
    source: 'Department.name', type: 'string',
    required: false, importable: true, exportable: true, reference: 'department_name', sensitive: false,
    description: 'Chỉ dùng khi thiếu mã phòng ban; trùng tên thì báo lỗi chứ không đoán.',
  },
  {
    key: 'position_code', group: 'employment', label: 'Mã chức vụ',
    source: 'Position.code → Employee.positionId', type: 'string',
    required: true, importable: true, exportable: true, reference: 'position_code', sensitive: false,
    example: 'BE01',
  },
  {
    key: 'position_name', group: 'employment', label: 'Tên chức vụ',
    source: 'Position.title', type: 'string',
    required: false, importable: true, exportable: true, reference: 'position_name', sensitive: false,
    description: 'Chỉ dùng khi thiếu mã chức vụ.',
  },
  {
    key: 'manager_employee_code', group: 'employment', label: 'Mã quản lý',
    source: 'Employee.employeeCode → Employee.managerId', type: 'string',
    required: false, importable: true, exportable: true, reference: 'manager_code', sensitive: false,
    example: 'EMP010', description: 'Có thể trỏ tới nhân viên được tạo trong cùng tệp.',
  },
  {
    key: 'manager_email', group: 'employment', label: 'Email quản lý',
    source: 'EmployeeProfile.workEmail của quản lý', type: 'email',
    required: false, importable: true, exportable: true, reference: 'manager_email', sensitive: false,
    description: 'Chỉ dùng khi thiếu mã quản lý.',
  },
  {
    key: 'fingerprint_id', group: 'employment', label: 'Mã vân tay',
    source: 'Employee.fingerprintId', type: 'string',
    required: false, importable: true, exportable: true, sensitive: false,
  },
  {
    key: 'salary_zone', group: 'employment', label: 'Vùng lương',
    source: 'Employee.salaryZone', type: 'enum', enumValues: SALARY_ZONE,
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'zone1',
  },
  {
    key: 'status', group: 'employment', label: 'Trạng thái',
    source: 'Employee.status', type: 'enum', enumValues: EMPLOYEE_STATUS,
    required: false, importable: false, exportable: true, sensitive: false,
    description: 'Chỉ đọc — trạng thái đổi qua luồng vòng đời, không qua CSV.',
  },
  {
    key: 'termination_date', group: 'employment', label: 'Ngày nghỉ việc',
    source: 'Employee.terminationDate', type: 'date',
    required: false, importable: false, exportable: true, sensitive: false,
    description: 'Chỉ đọc — đặt bởi luồng kết thúc hợp tác.',
  },
  {
    key: 'has_login_account', group: 'employment', label: 'Có tài khoản đăng nhập',
    source: 'Employee.userId', type: 'boolean',
    required: false, importable: false, exportable: true, sensitive: false,
    description: 'Chỉ đọc — tài khoản cấp qua luồng grant-login.',
  },

  // ----------------------------------------------------------------- contact
  {
    key: 'work_email', group: 'contact', label: 'Email công ty',
    source: 'EmployeeProfile.workEmail', type: 'email',
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'an.nv@soosky.co',
  },
  {
    key: 'personal_email', group: 'contact', label: 'Email cá nhân',
    source: 'EmployeeProfile.email', type: 'email',
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'an.nv@gmail.com', description: 'Cần có nếu muốn cấp tài khoản đăng nhập sau này.',
  },
  {
    key: 'phone', group: 'contact', label: 'Điện thoại',
    source: 'EmployeeProfile.phone', type: 'string',
    required: false, importable: true, exportable: true, sensitive: false,
    example: '0901234567',
  },
  {
    key: 'address', group: 'contact', label: 'Địa chỉ',
    source: 'EmployeeProfile.address', type: 'string',
    required: false, importable: true, exportable: true, sensitive: true,
  },
  {
    key: 'tax_code', group: 'contact', label: 'Mã số thuế',
    source: 'EmployeeProfile.taxCode', type: 'string',
    required: false, importable: true, exportable: true, sensitive: true,
  },
  {
    key: 'social_insurance_no', group: 'contact', label: 'Số sổ BHXH',
    source: 'EmployeeProfile.socialInsuranceNo', type: 'string',
    required: false, importable: true, exportable: true, sensitive: true,
  },
  {
    key: 'vehicle_plate', group: 'contact', label: 'Biển số xe',
    source: 'EmployeeProfile.vehiclePlate', type: 'string',
    required: false, importable: true, exportable: true, sensitive: false,
  },

  // -------------------------------------------------------------------- bank
  {
    key: 'bank_name', group: 'bank', label: 'Ngân hàng',
    source: 'EmployeeBankAccount.bankName', type: 'string',
    required: false, importable: true, exportable: true, sensitive: true,
    description: 'CSV chỉ mang tài khoản chính; tài khoản phụ quản lý trong hồ sơ nhân viên.',
  },
  {
    key: 'bank_branch', group: 'bank', label: 'Chi nhánh',
    source: 'EmployeeBankAccount.branch', type: 'string',
    required: false, importable: true, exportable: true, sensitive: true,
  },
  {
    key: 'bank_account_number', group: 'bank', label: 'Số tài khoản',
    source: 'EmployeeBankAccount.accountNumber', type: 'string',
    required: false, importable: true, exportable: true, sensitive: true,
  },
  {
    key: 'bank_account_holder', group: 'bank', label: 'Chủ tài khoản',
    source: 'EmployeeBankAccount.accountHolder', type: 'string',
    required: false, importable: true, exportable: true, sensitive: true,
  },
  {
    key: 'bank_is_primary', group: 'bank', label: 'Là tài khoản chính',
    source: 'EmployeeBankAccount.isPrimary', type: 'boolean',
    required: false, importable: true, exportable: true, sensitive: true,
    example: 'true',
  },

  // ---------------------------------------------------------------- contract
  {
    key: 'contract_number', group: 'contract', label: 'Số hợp đồng',
    source: 'EmployeeContract.contractNumber', type: 'string',
    required: false, importable: true, exportable: true, sensitive: false,
    description: 'Chỉ dùng để lập hợp đồng ĐẦU TIÊN; không sửa hợp đồng đã có.',
  },
  {
    key: 'contract_type', group: 'contract', label: 'Loại hợp đồng',
    source: 'EmployeeContract.contractType', type: 'enum', enumValues: CONTRACT_TYPE,
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'fixed_term',
  },
  {
    key: 'contract_employment_status', group: 'contract', label: 'Tình trạng làm việc',
    source: 'EmployeeContract.employmentStatus', type: 'enum', enumValues: EMPLOYMENT_STATUS,
    required: false, importable: true, exportable: true, sensitive: false,
    example: 'probation', description: 'Thử việc được thể hiện ở đây, không có cột riêng.',
  },
  {
    key: 'contract_start_date', group: 'contract', label: 'Hợp đồng từ ngày',
    source: 'EmployeeContract.startDate', type: 'date',
    required: false, importable: true, exportable: true, sensitive: false,
  },
  {
    key: 'contract_end_date', group: 'contract', label: 'Hợp đồng đến ngày',
    source: 'EmployeeContract.endDate', type: 'date',
    required: false, importable: true, exportable: true, sensitive: false,
    description: 'Với hợp đồng thử việc, đây là ngày kết thúc thử việc.',
  },
  {
    key: 'contract_base_salary', group: 'contract', label: 'Lương cơ bản',
    source: 'EmployeeContract.baseSalary', type: 'number',
    required: false, importable: true, exportable: true, sensitive: true,
  },
  {
    key: 'contract_status', group: 'contract', label: 'Trạng thái hợp đồng',
    source: 'EmployeeContract.status', type: 'enum', enumValues: CONTRACT_STATUS,
    required: false, importable: false, exportable: true, sensitive: false,
    description: 'Chỉ đọc — hợp đồng đóng/mở qua luồng vòng đời.',
  },
];

const byKey = new Map(EMPLOYEE_CSV_SCHEMA.map((c) => [c.key, c]));

export function csvColumn(key: string): CsvColumn | undefined {
  return byKey.get(key);
}

/** Cột được phép nhập — cũng là tập cột của tệp mẫu. */
export const IMPORT_COLUMNS: readonly string[] = EMPLOYEE_CSV_SCHEMA.filter((c) => c.importable).map((c) => c.key);

/** Cột của bản xuất — theo đúng thứ tự khai báo, kể cả cột chỉ đọc. */
export const EXPORT_COLUMNS: readonly string[] = EMPLOYEE_CSV_SCHEMA.filter((c) => c.exportable).map((c) => c.key);

/** Bắt buộc khi tạo mới. */
export const REQUIRED_COLUMNS: readonly string[] = EMPLOYEE_CSV_SCHEMA.filter((c) => c.required).map((c) => c.key);

export const SENSITIVE_COLUMNS: readonly string[] = EMPLOYEE_CSV_SCHEMA.filter((c) => c.sensitive).map((c) => c.key);

/** Cột nhóm hợp đồng — chỉ áp dụng khi lập hợp đồng đầu tiên. */
export const CONTRACT_COLUMNS: readonly string[] = EMPLOYEE_CSV_SCHEMA.filter(
  (c) => c.group === 'contract' && c.importable,
).map((c) => c.key);

/** Cột nhóm ngân hàng — chỉ áp dụng cho tài khoản chính. */
export const BANK_COLUMNS: readonly string[] = EMPLOYEE_CSV_SCHEMA.filter(
  (c) => c.group === 'bank' && c.importable,
).map((c) => c.key);

/** Bản rút gọn gửi cho giao diện dựng bảng hướng dẫn — không lộ tên field nội bộ. */
export function csvSchemaForClient() {
  return {
    dateFormat: CSV_DATE_FORMAT,
    columns: EMPLOYEE_CSV_SCHEMA.map((c) => ({
      key: c.key,
      group: c.group,
      label: c.label,
      type: c.type,
      enumValues: c.enumValues ?? null,
      required: c.required,
      importable: c.importable,
      exportable: c.exportable,
      sensitive: c.sensitive,
      example: c.example ?? null,
      description: c.description ?? null,
    })),
  };
}

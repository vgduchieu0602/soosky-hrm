/**
 * The demo dataset, written out by hand.
 *
 * Everything here is a fixed literal so `pnpm seed:demo` produces a
 * byte-identical database on every run. Names, codes, phones and tax codes are
 * unique by construction — every one of those columns carries a unique index.
 *
 * Dates come in two shapes:
 *   { y, m, d }            absolute — tenure that should stay put
 *   { offset, day }        relative to the current month — probation windows,
 *                          new hires and terminations that must stay "recent"
 *                          however long after writing this the seed is run
 */
import type { EmployeeStatus, EmployeeType } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import type { EmploymentStatus } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';
import type { Gender } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';
import type { LeaveStatus, LeaveType } from '@modules/hrm/adapters/persistence/mongoose/models/leave-request.model';

export type DateSpec = { y: number; m: number; d: number } | { offset: number; day: number | 'last' };

export interface DepartmentSeed {
  code: string;
  name: string;
  parent: string | null;
  /** employeeCode of the head — backfilled after employees exist. */
  manager: string;
  location: string;
  costCenter: string;
}

export const DEPARTMENTS: DepartmentSeed[] = [
  { code: 'BOD', name: 'Ban Giám Đốc', parent: null, manager: 'EMP001', location: 'Hà Nội', costCenter: 'CC-100' },
  { code: 'HR', name: 'Nhân Sự', parent: 'BOD', manager: 'EMP002', location: 'Hà Nội', costCenter: 'CC-200' },
  { code: 'ENG', name: 'Kỹ Thuật', parent: 'BOD', manager: 'EMP004', location: 'Hà Nội', costCenter: 'CC-300' },
  { code: 'SALES', name: 'Kinh Doanh', parent: 'BOD', manager: 'EMP012', location: 'Hồ Chí Minh', costCenter: 'CC-400' },
  { code: 'ACC', name: 'Kế Toán', parent: 'BOD', manager: 'EMP016', location: 'Hà Nội', costCenter: 'CC-500' },
];

export interface PositionSeed {
  code: string;
  title: string;
  dept: string;
  level: number;
}

export const POSITIONS: PositionSeed[] = [
  { code: 'BOD-DIR', title: 'Director', dept: 'BOD', level: 7 },
  { code: 'HR-MGR', title: 'HR Manager', dept: 'HR', level: 6 },
  { code: 'HR-EXE', title: 'HR Executive', dept: 'HR', level: 3 },
  { code: 'ENG-LEAD', title: 'Tech Lead', dept: 'ENG', level: 6 },
  { code: 'ENG-BE', title: 'Backend Developer', dept: 'ENG', level: 4 },
  { code: 'ENG-FE', title: 'Frontend Developer', dept: 'ENG', level: 4 },
  { code: 'SALES-MGR', title: 'Sales Manager', dept: 'SALES', level: 6 },
  { code: 'SALES-EXE', title: 'Sales Executive', dept: 'SALES', level: 2 },
  { code: 'ACC-CHIEF', title: 'Chief Accountant', dept: 'ACC', level: 6 },
  { code: 'ACC-STAFF', title: 'Accountant', dept: 'ACC', level: 3 },
];

export interface EmployeeSeed {
  code: string;
  lastName: string; // họ
  middleName: string;
  firstName: string; // tên
  gender: Gender;
  dob: { y: number; m: number; d: number };
  position: string;
  /** employeeCode of the line manager. */
  manager: string | null;
  hire: DateSpec;
  termination?: DateSpec;
  status: EmployeeStatus;
  employeeType: EmployeeType;
  employment: EmploymentStatus;
  /** Contract salary in VND. Interns carry the policy stipend instead. */
  salary: number;
  dependents: number;
  shift: 'Hành chính' | 'Ca sáng';
  /**
   * Probation → official mid-period split. When set, the probation contract runs
   * hire → this date and an official contract starts the next day, which is what
   * exercises the payroll engine's multi-segment path.
   */
  officialFrom?: DateSpec;
}

export const EMPLOYEES: EmployeeSeed[] = [
  { code: 'EMP001', lastName: 'Nguyễn', middleName: 'Văn', firstName: 'An', gender: 'male', dob: { y: 1985, m: 4, d: 12 }, position: 'BOD-DIR', manager: null, hire: { y: 2019, m: 1, d: 7 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 60_000_000, dependents: 2, shift: 'Hành chính' },
  { code: 'EMP002', lastName: 'Trần', middleName: 'Thị', firstName: 'Bình', gender: 'female', dob: { y: 1988, m: 9, d: 3 }, position: 'HR-MGR', manager: 'EMP001', hire: { y: 2020, m: 3, d: 2 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 30_000_000, dependents: 1, shift: 'Hành chính' },
  { code: 'EMP003', lastName: 'Lê', middleName: 'Minh', firstName: 'Cường', gender: 'male', dob: { y: 1994, m: 1, d: 25 }, position: 'HR-EXE', manager: 'EMP002', hire: { y: 2022, m: 6, d: 1 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 15_000_000, dependents: 0, shift: 'Hành chính' },
  { code: 'EMP004', lastName: 'Phạm', middleName: 'Quốc', firstName: 'Dũng', gender: 'male', dob: { y: 1990, m: 7, d: 19 }, position: 'ENG-LEAD', manager: 'EMP001', hire: { y: 2020, m: 8, d: 17 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 42_000_000, dependents: 2, shift: 'Hành chính' },
  { code: 'EMP005', lastName: 'Hoàng', middleName: 'Thị', firstName: 'Duyên', gender: 'female', dob: { y: 1993, m: 11, d: 8 }, position: 'ENG-BE', manager: 'EMP004', hire: { y: 2021, m: 11, d: 15 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 26_000_000, dependents: 1, shift: 'Hành chính' },
  { code: 'EMP006', lastName: 'Vũ', middleName: 'Đức', firstName: 'Giang', gender: 'male', dob: { y: 1995, m: 5, d: 30 }, position: 'ENG-BE', manager: 'EMP004', hire: { y: 2022, m: 2, d: 14 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 24_000_000, dependents: 0, shift: 'Hành chính' },
  { code: 'EMP007', lastName: 'Đặng', middleName: 'Thu', firstName: 'Hà', gender: 'female', dob: { y: 1996, m: 2, d: 17 }, position: 'ENG-FE', manager: 'EMP004', hire: { y: 2022, m: 9, d: 5 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 23_000_000, dependents: 0, shift: 'Hành chính' },
  { code: 'EMP008', lastName: 'Bùi', middleName: 'Văn', firstName: 'Hùng', gender: 'male', dob: { y: 1997, m: 8, d: 22 }, position: 'ENG-FE', manager: 'EMP004', hire: { y: 2023, m: 4, d: 3 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 21_000_000, dependents: 1, shift: 'Hành chính' },
  { code: 'EMP009', lastName: 'Đỗ', middleName: 'Ngọc', firstName: 'Khánh', gender: 'female', dob: { y: 1998, m: 12, d: 11 }, position: 'ENG-BE', manager: 'EMP004', hire: { y: 2024, m: 10, d: 1 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 20_000_000, dependents: 0, shift: 'Hành chính' },
  // Probation → official partway through the M-2 period: two contract segments.
  { code: 'EMP010', lastName: 'Hồ', middleName: 'Thanh', firstName: 'Lâm', gender: 'male', dob: { y: 1999, m: 6, d: 6 }, position: 'ENG-FE', manager: 'EMP004', hire: { offset: -3, day: 1 }, officialFrom: { offset: -2, day: 16 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 18_000_000, dependents: 0, shift: 'Hành chính' },
  { code: 'EMP011', lastName: 'Ngô', middleName: 'Mai', firstName: 'Linh', gender: 'female', dob: { y: 2003, m: 3, d: 21 }, position: 'ENG-BE', manager: 'EMP004', hire: { offset: -2, day: 1 }, status: 'active', employeeType: 'intern', employment: 'internship', salary: 1_500_000, dependents: 0, shift: 'Ca sáng' },
  { code: 'EMP012', lastName: 'Dương', middleName: 'Hữu', firstName: 'Nam', gender: 'male', dob: { y: 1987, m: 10, d: 14 }, position: 'SALES-MGR', manager: 'EMP001', hire: { y: 2021, m: 1, d: 11 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 32_000_000, dependents: 2, shift: 'Hành chính' },
  { code: 'EMP013', lastName: 'Lý', middleName: 'Thị', firstName: 'Oanh', gender: 'female', dob: { y: 1992, m: 4, d: 9 }, position: 'SALES-EXE', manager: 'EMP012', hire: { y: 2022, m: 5, d: 9 }, status: 'active', employeeType: 'part_time', employment: 'official', salary: 14_000_000, dependents: 1, shift: 'Hành chính' },
  { code: 'EMP014', lastName: 'Nguyễn', middleName: 'Gia', firstName: 'Phúc', gender: 'male', dob: { y: 1995, m: 1, d: 28 }, position: 'SALES-EXE', manager: 'EMP012', hire: { y: 2023, m: 8, d: 21 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 13_000_000, dependents: 0, shift: 'Hành chính' },
  { code: 'EMP015', lastName: 'Trần', middleName: 'Minh', firstName: 'Quân', gender: 'male', dob: { y: 1994, m: 7, d: 3 }, position: 'SALES-EXE', manager: 'EMP012', hire: { y: 2024, m: 2, d: 19 }, status: 'on_leave', employeeType: 'full_time', employment: 'official', salary: 13_500_000, dependents: 0, shift: 'Hành chính' },
  { code: 'EMP016', lastName: 'Lê', middleName: 'Hải', firstName: 'Sơn', gender: 'male', dob: { y: 1986, m: 11, d: 27 }, position: 'ACC-CHIEF', manager: 'EMP001', hire: { y: 2020, m: 5, d: 4 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 30_000_000, dependents: 2, shift: 'Hành chính' },
  { code: 'EMP017', lastName: 'Phạm', middleName: 'Thị', firstName: 'Tâm', gender: 'female', dob: { y: 1991, m: 3, d: 15 }, position: 'ACC-STAFF', manager: 'EMP016', hire: { y: 2022, m: 7, d: 18 }, status: 'active', employeeType: 'full_time', employment: 'official', salary: 16_000_000, dependents: 1, shift: 'Hành chính' },
  { code: 'EMP018', lastName: 'Hoàng', middleName: 'Văn', firstName: 'Uy', gender: 'male', dob: { y: 1993, m: 9, d: 9 }, position: 'ACC-STAFF', manager: 'EMP016', hire: { y: 2023, m: 11, d: 6 }, status: 'on_leave', employeeType: 'full_time', employment: 'official', salary: 15_000_000, dependents: 0, shift: 'Hành chính' },
  // Hired this month → still onboarding, on probation, no payroll history yet.
  { code: 'EMP019', lastName: 'Vũ', middleName: 'Khánh', firstName: 'Vy', gender: 'female', dob: { y: 2001, m: 5, d: 19 }, position: 'HR-EXE', manager: 'EMP002', hire: { offset: 0, day: 1 }, status: 'onboarding', employeeType: 'contract', employment: 'probation', salary: 14_000_000, dependents: 0, shift: 'Hành chính' },
  // Left at the end of M-2 → in the M-3/M-2 payroll runs, out of M-1 onwards.
  { code: 'EMP020', lastName: 'Đặng', middleName: 'Quang', firstName: 'Việt', gender: 'male', dob: { y: 1990, m: 2, d: 8 }, position: 'SALES-EXE', manager: 'EMP012', hire: { y: 2021, m: 9, d: 13 }, termination: { offset: -2, day: 'last' }, status: 'terminated', employeeType: 'full_time', employment: 'official', salary: 13_000_000, dependents: 0, shift: 'Hành chính' },
];

/** Login accounts wired to an employee record, so self-service works for all three roles. */
export const USER_LINKS: { email: string; employeeCode: string }[] = [
  { email: 'admin@soosky.local', employeeCode: 'EMP001' },
  { email: 'hr@soosky.local', employeeCode: 'EMP002' },
  { email: 'employee@soosky.local', employeeCode: 'EMP005' },
];

export interface LeaveSeed {
  employee: string;
  leaveType: LeaveType;
  /** Month offset the leave sits in: -3 … 0. */
  offset: number;
  startDay: number;
  endDay: number;
  halfDaySession?: 'morning' | 'afternoon';
  status: LeaveStatus;
  reason: string;
}

/**
 * Leave requests, one per realistic state. Approved ones are pushed through
 * `leaveUseCases.approve` so the matching `leave_paid` / `leave_unpaid`
 * attendance rows and the balance deduction are produced by the real rule,
 * not hand-written.
 */
export const LEAVE_REQUESTS: LeaveSeed[] = [
  { employee: 'EMP005', leaveType: 'annual', offset: -3, startDay: 10, endDay: 11, status: 'approved', reason: 'Nghỉ phép cá nhân' },
  { employee: 'EMP006', leaveType: 'sick', offset: -3, startDay: 22, endDay: 22, status: 'approved', reason: 'Khám sức khoẻ' },
  { employee: 'EMP007', leaveType: 'annual', offset: -2, startDay: 6, endDay: 8, status: 'approved', reason: 'Về quê' },
  { employee: 'EMP013', leaveType: 'annual', offset: -2, startDay: 20, endDay: 20, halfDaySession: 'morning', status: 'approved', reason: 'Việc gia đình buổi sáng' },
  { employee: 'EMP008', leaveType: 'personal', offset: -2, startDay: 27, endDay: 27, status: 'approved', reason: 'Việc riêng' },
  { employee: 'EMP017', leaveType: 'annual', offset: -1, startDay: 11, endDay: 12, status: 'approved', reason: 'Nghỉ phép năm' },
  { employee: 'EMP003', leaveType: 'unpaid', offset: -1, startDay: 19, endDay: 20, status: 'approved', reason: 'Nghỉ không lương' },
  { employee: 'EMP009', leaveType: 'sick', offset: -1, startDay: 25, endDay: 26, status: 'approved', reason: 'Nghỉ ốm' },
  { employee: 'EMP005', leaveType: 'annual', offset: 0, startDay: 15, endDay: 16, status: 'pending', reason: 'Du lịch' },
  { employee: 'EMP006', leaveType: 'annual', offset: 0, startDay: 21, endDay: 23, status: 'pending', reason: 'Nghỉ phép năm' },
  { employee: 'EMP013', leaveType: 'sick', offset: 0, startDay: 10, endDay: 10, status: 'pending', reason: 'Nghỉ ốm' },
  { employee: 'EMP017', leaveType: 'personal', offset: 0, startDay: 28, endDay: 28, status: 'pending', reason: 'Việc riêng' },
  { employee: 'EMP014', leaveType: 'annual', offset: -1, startDay: 5, endDay: 6, status: 'rejected', reason: 'Trùng lịch chốt số cuối tháng' },
  { employee: 'EMP008', leaveType: 'annual', offset: 0, startDay: 18, endDay: 18, status: 'cancelled', reason: 'Đổi kế hoạch' },
];

export interface BonusSeed {
  employee: string;
  offset: number;
  name: string;
  amount: number;
  isTaxable: boolean;
  reason: string;
}

export const BONUSES: BonusSeed[] = [
  { employee: 'EMP004', offset: -2, name: 'Thưởng dự án', amount: 8_000_000, isTaxable: true, reason: 'Giao hàng đúng hạn' },
  { employee: 'EMP005', offset: -2, name: 'Thưởng dự án', amount: 5_000_000, isTaxable: true, reason: 'Giao hàng đúng hạn' },
  { employee: 'EMP012', offset: -2, name: 'Thưởng vượt doanh số', amount: 10_000_000, isTaxable: true, reason: 'Vượt 120% target' },
  { employee: 'EMP013', offset: -1, name: 'Thưởng vượt doanh số', amount: 4_000_000, isTaxable: true, reason: 'Vượt 110% target' },
  { employee: 'EMP007', offset: -1, name: 'Thưởng sáng kiến', amount: 3_000_000, isTaxable: true, reason: 'Cải tiến quy trình build' },
  { employee: 'EMP017', offset: -1, name: 'Thưởng chuyên cần', amount: 1_000_000, isTaxable: false, reason: 'Đi làm đủ ngày' },
];

export interface DeductionSeed {
  employee: string;
  /** null = recurring every period while active. */
  offset: number | null;
  name: string;
  amount: number;
  reason: string;
}

export const DEDUCTIONS: DeductionSeed[] = [
  { employee: 'EMP013', offset: null, name: 'Hoàn tạm ứng', amount: 1_000_000, reason: 'Trả góp khoản tạm ứng tháng trước' },
  { employee: 'EMP014', offset: -2, name: 'Khấu trừ vi phạm', amount: 200_000, reason: 'Không hoàn thành báo cáo' },
  { employee: 'EMP008', offset: -1, name: 'Hoàn tạm ứng', amount: 500_000, reason: 'Tạm ứng công tác' },
];

/** In-app notifications, so the bell has something to show without a live event. */
export interface NotificationSeed {
  email: string;
  type: 'account' | 'security' | 'leave' | 'payroll' | 'performance' | 'employee' | 'system';
  severity: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message: string;
  link: string | null;
  read: boolean;
}

export const NOTIFICATIONS: NotificationSeed[] = [
  { email: 'admin@soosky.local', type: 'payroll', severity: 'success', title: 'Bảng lương đã thanh toán', message: 'Kỳ lương đã được thanh toán cho toàn bộ nhân viên.', link: '/payroll', read: false },
  { email: 'admin@soosky.local', type: 'employee', severity: 'info', title: 'Nhân viên mới onboarding', message: 'Vũ Khánh Vy (EMP019) vừa được tạo hồ sơ.', link: '/employees', read: false },
  { email: 'admin@soosky.local', type: 'system', severity: 'warning', title: 'Còn kỳ lương chưa chốt', message: 'Kỳ lương tháng trước vẫn ở trạng thái draft.', link: '/payroll/periods', read: true },
  { email: 'hr@soosky.local', type: 'leave', severity: 'info', title: 'Đơn nghỉ phép chờ duyệt', message: 'Có 4 đơn nghỉ phép đang chờ bạn duyệt.', link: '/leave', read: false },
  { email: 'hr@soosky.local', type: 'performance', severity: 'info', title: 'Đánh giá đã chốt', message: 'Đánh giá hiệu suất kỳ trước đã được duyệt.', link: '/performance', read: true },
  { email: 'employee@soosky.local', type: 'payroll', severity: 'success', title: 'Phiếu lương đã sẵn sàng', message: 'Phiếu lương kỳ gần nhất đã có, bạn có thể xem chi tiết.', link: '/my/payslips', read: false },
  { email: 'employee@soosky.local', type: 'leave', severity: 'success', title: 'Đơn nghỉ phép được duyệt', message: 'Đơn nghỉ phép của bạn đã được duyệt.', link: '/my/leave', read: true },
  { email: 'employee@soosky.local', type: 'performance', severity: 'info', title: 'Kết quả đánh giá', message: 'Kết quả đánh giá kỳ trước đã có, vui lòng xác nhận.', link: '/my/performance', read: false },
];

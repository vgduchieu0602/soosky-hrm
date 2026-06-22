// Employee feature — API + view-model types.
// Mirrors backend share-docs/API-SPEC.md §6.3 and DATABASE.md §2.2.

export type EmployeeStatus = "onboarding" | "active" | "on_leave" | "terminated";
export type EmployeeType = "full_time" | "part_time" | "contract" | "intern";
export type SalaryZone = "zone1" | "zone2" | "zone3" | "zone4";
export type Gender = "male" | "female" | "other" | "undisclosed";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";
export type DocumentType =
  | "id_card" | "passport" | "degree" | "certificate" | "visa" | "other";
export type ContractType = "fixed_term" | "indefinite";
export type EmploymentStatus = "probation" | "official" | "internship";
export type ContractStatus = "active" | "expired" | "terminated";
export type Relationship = "spouse" | "parent" | "sibling" | "other";
export type AssetCondition = "new" | "good" | "fair" | "damaged";
export type HistoryEvent =
  | "hired" | "promotion" | "transfer" | "salary_change" | "contract_renew" | "info_update" | "terminated";

// ---- Populated reference shapes returned by the list endpoint ----
export interface DepartmentRef {
  _id: string;
  name: string;
  code: string;
}
export interface PositionRef {
  _id: string;
  title: string;
  code: string;
  level?: number;
}
export interface ManagerRef {
  _id: string;
  employeeCode: string;
  profile?: { firstName?: string; middleName?: string; lastName?: string } | null;
}

export interface EmployeeProfile {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  maritalStatus?: MaritalStatus;
  avatarUrl?: string;
  email?: string; // personal email
  workEmail?: string; // company email
  phone?: string;
  address?: string;
}

// Raw record as returned by GET /employees (list) and GET /employees/:id (detail).
// departmentId/positionId/managerId may be populated objects or bare id strings.
export interface EmployeeRecord {
  _id: string;
  employeeCode: string;
  fingerprintId?: string | null;
  userId?: string | null;
  departmentId: DepartmentRef | string;
  positionId: PositionRef | string;
  managerId?: ManagerRef | string | null;
  hireDate: string;
  terminationDate?: string | null;
  employeeType: EmployeeType;
  status: EmployeeStatus;
  salaryZone?: SalaryZone;
  profile?: EmployeeProfile | null;
  created_at?: string;
  updated_at?: string;
}

// Flattened, display-ready employee used across the page + detail header.
export interface EmployeeView {
  id: string;
  code: string;
  fingerprintId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  initials: string;
  departmentId: string;
  departmentName: string;
  positionId: string;
  positionName: string;
  managerId: string | null;
  managerName: string;
  employeeType: EmployeeType;
  status: EmployeeStatus;
  hireDate: string; // ISO
  salaryZone: SalaryZone | "";
  userId: string | null;
  // profile (PII)
  email: string; // company email (from linked user) — falls back to personal
  personalEmail: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | "";
  maritalStatus: MaritalStatus | "";
  nationality: string;
  address: string;
  avatarUrl: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  onboarding: number;
  onLeave: number;
  terminated: number;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListEmployeesParams {
  page?: number;
  limit?: number;
  departmentId?: string;
  status?: string;
  employeeType?: string;
  q?: string;
  sort?: string;
}

export interface CreateEmployeeInput {
  employeeCode: string;
  fingerprintId?: string;
  departmentId: string;
  positionId: string;
  managerId?: string;
  hireDate: string;
  employeeType: EmployeeType;
  salaryZone?: SalaryZone;
  profile: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: Gender;
    nationality?: string;
    maritalStatus?: MaritalStatus;
    email?: string;
    workEmail?: string;
    phone?: string;
    address?: string;
  };
}

// ---- edit inputs ----
export interface UpdateProfileInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  maritalStatus?: MaritalStatus;
  email?: string;
  workEmail?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
}

export interface UpdateWorkInput {
  departmentId?: string;
  positionId?: string;
  managerId?: string | null;
  employeeType?: EmployeeType;
  status?: EmployeeStatus;
  salaryZone?: SalaryZone;
}

export interface ReturnAssetInput {
  returnedDate?: string;
  condition?: AssetCondition;
  note?: string;
}

export interface TerminateInput {
  terminationDate?: string;
  reason?: string;
}

// ---- sub-resource create inputs ----
export interface NewContactInput {
  name: string;
  relationship: Relationship;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}
export interface NewBankAccountInput {
  bankName: string;
  branch?: string;
  accountNumber: string;
  accountHolder: string;
  isPrimary?: boolean;
}
export interface EmployeeBankAccountRecord {
  _id: string;
  bankName: string;
  branch?: string;
  accountNumber: string;
  accountHolder: string;
  isPrimary?: boolean;
}
export interface NewDocumentInput {
  documentType: DocumentType;
  documentNumber: string;
  issuedDate?: string;
  expiryDate?: string;
  issuedBy?: string;
  fileUrl?: string;
}
export interface NewContractInput {
  contractType: ContractType;
  employmentStatus: EmploymentStatus;
  contractNumber: string;
  startDate: string;
  endDate?: string;
  baseSalary: number;
  currency?: string;
  status?: ContractStatus;
  fileUrl?: string;
}
export interface NewAssetInput {
  assetName: string;
  assetCode: string;
  assignedDate: string;
  condition?: AssetCondition;
  note?: string;
}
// Edit an asset; `returnedDate: null` re-assigns a previously returned asset.
export interface UpdateAssetInput {
  assetName?: string;
  assetCode?: string;
  assignedDate?: string;
  condition?: AssetCondition;
  note?: string;
  returnedDate?: string | null;
}

// ---- Sub-resources (one row each) ----
export interface EmployeeContactRecord {
  _id: string;
  name: string;
  relationship: Relationship;
  phone?: string;
  email?: string;
  address?: string;
  isPrimary?: boolean;
}

export interface EmployeeDocumentRecord {
  _id: string;
  documentType: DocumentType;
  documentNumber: string;
  fileUrl?: string;
  issuedDate?: string;
  expiryDate?: string;
  issuedBy?: string;
}

export interface EmployeeContractRecord {
  _id: string;
  contractType: ContractType;
  employmentStatus?: EmploymentStatus;
  contractNumber: string;
  startDate: string;
  endDate?: string | null;
  baseSalary: number | string;
  currency: string;
  status: ContractStatus;
  fileUrl?: string;
}

export interface EmployeeAssetRecord {
  _id: string;
  assetName: string;
  assetCode: string;
  assignedDate: string;
  returnedDate?: string | null;
  condition: AssetCondition;
  note?: string;
}

export interface EmployeeHistoryRecord {
  _id: string;
  eventType: HistoryEvent;
  fromValue?: Record<string, unknown>;
  toValue?: Record<string, unknown>;
  effectiveDate: string;
  note?: string;
}

// ---- Account (linked user) ----
export type AccountView =
  | { hasAccount: false }
  | {
      hasAccount: true;
      userId: string;
      username: string;
      email: string;
      role: string;
      status: "active" | "disabled" | "locked";
      lastLoginAt: string | null;
      mustChangePassword: boolean;
      mfaEnabled: boolean;
    };

export interface UpdateAccountInput {
  status?: "active" | "disabled";
  role?: string;
}

export interface GrantLoginInput {
  username?: string;
  email?: string;
  sendEmail: boolean;
}
export interface GrantLoginResult {
  userId: string;
  username: string;
  linkSentTo: string | null;
}

export interface ReminderItem {
  contractId: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  contractType: string;
  employmentStatus: string;
  contractNumber: string;
  endDate: string;
  daysLeft: number;
}
export interface ExpiryReminders {
  probation: ReminderItem[];
  contract: ReminderItem[];
}

export interface ImportEmployeeRow {
  employeeCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  departmentCode: string;
  positionCode: string;
  employeeType: string;
  hireDate: string;
  email?: string;
  phone?: string;
  gender?: string;
  salaryZone?: string;
}
export interface ImportRowResult {
  index: number;
  employeeCode: string;
  status: "created" | "error";
  employeeId?: string;
  error?: string;
}
export interface ImportResult {
  total: number;
  created: number;
  failed: number;
  results: ImportRowResult[];
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}
export interface ProfileCompleteness {
  percent: number;
  items: ChecklistItem[];
}

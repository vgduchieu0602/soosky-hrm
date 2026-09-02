/**
 * Pure employee business rules — no Express, no Mongoose. Framework-free helpers
 * used by the application use-cases.
 */
import { randomBytes } from 'node:crypto';

/**
 * ObjectId-shape validation replicating Mongoose's `Types.ObjectId.isValid`
 * semantics for the string inputs this feature receives (24-hex, or any
 * 12-length string). Kept pure so the application layer stays Mongoose-free.
 */
export function isValidObjectId(id: string): boolean {
  if (typeof id !== 'string') return false;
  if (id.length === 24) return /^[0-9a-fA-F]{24}$/.test(id);
  return id.length === 12;
}

/** Derive a login username from the personal email (preferred) or employee code. */
export function deriveUsername(email?: string, employeeCode?: string): string {
  if (email) return email.split('@')[0]!.toLowerCase();
  if (employeeCode) return employeeCode.toLowerCase().replace(/[^a-z0-9.]+/g, '.');
  return `user.${randomBytes(3).toString('hex')}`;
}

// ---- onboarding completeness ----

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}

export interface CompletenessInput {
  hasUser: boolean;
  profile: { dateOfBirth?: unknown; phone?: unknown; email?: unknown; address?: unknown } | null;
  contacts: number;
  banks: number;
  contracts: number;
  docs: number;
}

/**
 * Onboarding completeness: derive a checklist from the existing sub-resources so
 * HR can see at a glance what a new hire's record is still missing.
 */
export function buildCompleteness(input: CompletenessInput): { percent: number; items: ChecklistItem[] } {
  const { profile, contacts, banks, contracts, docs, hasUser } = input;
  const items: ChecklistItem[] = [
    { key: 'personalInfo', label: 'Thông tin cá nhân (ngày sinh, SĐT)', done: !!(profile?.dateOfBirth && profile?.phone), required: true },
    { key: 'personalEmail', label: 'Email cá nhân', done: !!profile?.email, required: true },
    { key: 'address', label: 'Địa chỉ thường trú', done: !!profile?.address, required: false },
    { key: 'emergencyContact', label: 'Người liên hệ khẩn cấp', done: contacts > 0, required: true },
    { key: 'bankAccount', label: 'Tài khoản ngân hàng', done: banks > 0, required: true },
    { key: 'contract', label: 'Hợp đồng lao động', done: contracts > 0, required: true },
    { key: 'loginAccount', label: 'Tài khoản đăng nhập', done: hasUser, required: false },
    { key: 'documents', label: 'Tài liệu đính kèm', done: docs > 0, required: false },
  ];
  const done = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  return { percent, items };
}

// ---- contract reminders ----

export const REMINDER_THRESHOLDS = new Set([30, 15, 7, 3, 1]);
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderRow {
  contractId: unknown;
  employeeId: unknown;
  employeeCode: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  departmentName?: string;
  contractType: string;
  employmentStatus: string;
  contractNumber: string;
  endDate: Date;
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

/** Split active-contract rows into probation/internship vs contract buckets. */
export function classifyReminders(
  rows: ReminderRow[],
  now: Date,
): { probation: ReminderItem[]; contract: ReminderItem[] } {
  const probation: ReminderItem[] = [];
  const contract: ReminderItem[] = [];
  for (const r of rows) {
    const fullName = [r.lastName, r.middleName, r.firstName].filter(Boolean).join(' ') || r.employeeCode;
    const daysLeft = Math.ceil((new Date(r.endDate).getTime() - now.getTime()) / DAY_MS);
    const item: ReminderItem = {
      contractId: String(r.contractId),
      employeeId: String(r.employeeId),
      employeeCode: r.employeeCode,
      fullName,
      departmentName: r.departmentName ?? null,
      contractType: r.contractType,
      employmentStatus: r.employmentStatus,
      contractNumber: r.contractNumber,
      endDate: new Date(r.endDate).toISOString(),
      daysLeft,
    };
    (r.employmentStatus === 'probation' || r.employmentStatus === 'internship' ? probation : contract).push(item);
  }
  return { probation, contract };
}

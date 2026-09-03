/**
 * Employees and everything hanging off them: profile, contracts, tax profile,
 * bank account, emergency contact, documents, assets, lifecycle history — plus
 * the two-way link to the three demo login accounts.
 *
 * Idempotent on the natural unique keys: `employeeCode`, `contractNumber`,
 * `assetCode`, `employeeId` (profile), and the per-employee tax code.
 */
import mongoose from 'mongoose';
import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { EmployeeProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';
import { EmployeeContractModel } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';
import { EmployeeTaxProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-tax-profile.model';
import { EmployeeBankAccount } from '@modules/hrm/adapters/persistence/mongoose/models/employee-bank-account.model';
import { EmployeeContact } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contact.model';
import { EmployeeDocumentModel } from '@modules/hrm/adapters/persistence/mongoose/models/employee-document.model';
import { EmployeeAsset } from '@modules/hrm/adapters/persistence/mongoose/models/employee-asset.model';
import { EmployeeHistory, type HistoryEvent } from '@modules/hrm/adapters/persistence/mongoose/models/employee-history.model';
import { Shift } from '@modules/hrm/adapters/persistence/mongoose/models/shift.model';
import { SalaryPolicyConfig } from '@modules/hrm/adapters/persistence/mongoose/models/salary-policy-config.model';
import { iamDirectory, userRepository } from '@modules/iam';
import { EMPLOYEES, USER_LINKS, type DateSpec, type EmployeeSeed } from './dataset';
import { dec, utcDay, daysInMonth, monthAnchor, line } from './common';
import type { OrgIds } from './organization.seed';

type Id = mongoose.Types.ObjectId;

export interface SeededEmployee {
  id: Id;
  code: string;
  seed: EmployeeSeed;
  hireDate: Date;
  terminationDate: Date | null;
  shiftId: Id;
  /** Employment status of the contract in force at the end of the seeded window. */
  isOfficial: boolean;
}

const BANKS = ['Vietcombank', 'Techcombank', 'BIDV', 'VietinBank', 'MB Bank', 'ACB', 'VPBank', 'TPBank', 'Agribank', 'Sacombank'];
const RELATIONSHIPS = ['spouse', 'parent', 'sibling', 'other'] as const;
const MARITAL = ['single', 'married', 'married', 'single'] as const;

/** Absolute dates stay put; relative ones follow the calendar so the demo never goes stale. */
export function resolveDate(spec: DateSpec): Date {
  if ('y' in spec) return utcDay(spec.y, spec.m, spec.d);
  const anchor = monthAnchor(spec.offset);
  const day = spec.day === 'last' ? daysInMonth(anchor.year, anchor.month) : spec.day;
  return utcDay(anchor.year, anchor.month, day);
}

const dayBefore = (d: Date) => new Date(d.getTime() - 86_400_000);
const fullName = (e: EmployeeSeed) => `${e.lastName} ${e.middleName} ${e.firstName}`;
/** 10-digit-ish synthetic identifiers, unique by index — every one has a unique index behind it. */
const taxCodeFor = (i: number) => `90000000${String(i + 1).padStart(2, '0')}`;
const phoneFor = (i: number) => `090100${String(i + 1).padStart(4, '0')}`;

/**
 * The monthly compulsory-insurance amount HR would enter on a tax profile.
 *
 * The payroll engine treats `EmployeeTaxProfile.insuranceAmount` as the fixed
 * BHXH deduction and takes it literally — including a `0`, which means "deduct
 * nothing". Leaving it at the schema default would therefore produce payslips
 * with no insurance line at all, so the seed fills in what the company policy
 * implies: the employee share (social + health + unemployment) of the fixed
 * contribution salary.
 */
async function resolveFixedInsuranceAmount(): Promise<number> {
  const policy = await SalaryPolicyConfig.findOne({ country: 'VN' }).sort({ effectiveFrom: -1 }).lean();
  const contributionSalary = Number(policy?.socialInsuranceSalary ?? 0);
  const employeeRates = (policy?.insuranceRates as { employee?: Record<string, number> } | undefined)?.employee;
  const percent =
    (employeeRates?.social ?? 8) + (employeeRates?.health ?? 1.5) + (employeeRates?.unemployment ?? 1);
  return Math.round((contributionSalary * percent) / 100);
}

export async function seedEmployees(org: OrgIds): Promise<SeededEmployee[]> {
  const shifts = await Shift.find({ status: 'active' }).select('_id name').lean();
  const shiftIdByName = new Map(shifts.map((s) => [s.name, s._id as Id]));
  if (shiftIdByName.size === 0) {
    throw new Error('No active shift found — run `pnpm seed` before `pnpm seed:demo`.');
  }

  const fixedInsurance = await resolveFixedInsuranceAmount();
  const seeded: SeededEmployee[] = [];

  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i]!;
    const position = org.posId.get(e.position);
    const departmentCode = e.position.split('-')[0]!;
    const departmentId = org.deptId.get(departmentCode);
    if (!position || !departmentId) throw new Error(`Unknown position/department for ${e.code}`);

    const shiftId = shiftIdByName.get(e.shift) ?? [...shiftIdByName.values()][0]!;
    const hireDate = resolveDate(e.hire);
    const terminationDate = e.termination ? resolveDate(e.termination) : null;

    const emp = await Employee.findOneAndUpdate(
      { employeeCode: e.code },
      {
        $set: {
          fingerprintId: `FP${String(i + 1).padStart(3, '0')}`,
          departmentId,
          positionId: position,
          shiftId,
          hireDate,
          terminationDate,
          employeeType: e.employeeType,
          status: e.status,
          salaryZone: 'zone1',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    const id = emp!._id as Id;

    await EmployeeProfile.findOneAndUpdate(
      { employeeId: id },
      {
        $set: {
          firstName: e.firstName,
          middleName: e.middleName,
          lastName: e.lastName,
          dateOfBirth: utcDay(e.dob.y, e.dob.m, e.dob.d),
          gender: e.gender,
          nationality: 'VN',
          maritalStatus: MARITAL[i % MARITAL.length],
          email: `${e.code.toLowerCase()}@example.com`,
          workEmail: `${e.code.toLowerCase()}@soosky.local`,
          phone: phoneFor(i),
          address: `Số ${i + 1}, Phường Dịch Vọng, Cầu Giấy, Hà Nội`,
          socialInsuranceNo: `0119${String(i + 1).padStart(6, '0')}`,
          taxCode: taxCodeFor(i),
          vehiclePlate: i % 3 === 0 ? `29A-${String(10000 + i * 137).slice(0, 5)}` : undefined,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await seedContracts(id, e, hireDate);

    // `taxCode` carries a unique index that (unlike a partial one) also indexes
    // explicit nulls, so every tax profile MUST get a distinct value — sharing
    // `null` would fail with E11000 on the second employee.
    await EmployeeTaxProfile.findOneAndUpdate(
      { employeeId: id },
      {
        $set: {
          taxCode: taxCodeFor(i),
          isResident: true,
          dependentsCount: e.dependents,
          // Probation/internship carry no compulsory insurance — the engine
          // treats them as exempt regardless, so 0 states the same thing.
          insuranceAmount: e.employment === 'official' ? fixedInsurance : 0,
          effectiveDate: hireDate,
          endDate: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await EmployeeBankAccount.findOneAndUpdate(
      { employeeId: id, isPrimary: true },
      {
        $set: {
          bankName: BANKS[i % BANKS.length]!,
          branch: 'Chi nhánh Hà Nội',
          accountNumber: `19${String(30000000 + i * 7919).padStart(10, '0')}`,
          accountHolder: fullName(e).toUpperCase(),
          isPrimary: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await EmployeeContact.findOneAndUpdate(
      { employeeId: id, isPrimary: true },
      {
        $set: {
          name: `${e.lastName} Thị Người Thân ${i + 1}`,
          relationship: RELATIONSHIPS[i % RELATIONSHIPS.length]!,
          phone: `098100${String(i + 1).padStart(4, '0')}`,
          address: `Số ${i + 1}, Phường Dịch Vọng, Cầu Giấy, Hà Nội`,
          isPrimary: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await EmployeeDocumentModel.findOneAndUpdate(
      { employeeId: id, documentType: 'id_card' },
      {
        $set: {
          documentNumber: `0010${String(90000000 + i * 5741).padStart(9, '0')}`,
          issuedDate: utcDay(e.dob.y + 18, e.dob.m, e.dob.d),
          issuedBy: 'Cục Cảnh sát QLHC về TTXH',
          expiryDate: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    if (i % 2 === 0) {
      await EmployeeDocumentModel.findOneAndUpdate(
        { employeeId: id, documentType: 'degree' },
        {
          $set: {
            documentNumber: `BC-${String(i + 1).padStart(4, '0')}`,
            issuedDate: utcDay(e.dob.y + 22, 6, 15),
            issuedBy: 'Đại học Bách khoa Hà Nội',
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }

    // Laptops go to the engineering + management roles only.
    if (['BOD-DIR', 'ENG-LEAD', 'ENG-BE', 'ENG-FE', 'HR-MGR'].includes(e.position)) {
      await EmployeeAsset.findOneAndUpdate(
        { assetCode: `LAP-${String(i + 1).padStart(3, '0')}` },
        {
          $set: {
            employeeId: id,
            assetName: 'Laptop Dell Latitude 5440',
            assignedDate: hireDate,
            returnedDate: e.status === 'terminated' ? terminationDate : null,
            condition: i % 4 === 0 ? 'new' : 'good',
            note: 'Cấp khi nhận việc',
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }

    await seedHistory(id, e, hireDate, terminationDate);

    seeded.push({
      id,
      code: e.code,
      seed: e,
      hireDate,
      terminationDate,
      shiftId,
      isOfficial: e.employment === 'official',
    });
  }

  line('Employees', seeded.length);
  line('  active / on_leave / onboarding / terminated', [
    seeded.filter((s) => s.seed.status === 'active').length,
    seeded.filter((s) => s.seed.status === 'on_leave').length,
    seeded.filter((s) => s.seed.status === 'onboarding').length,
    seeded.filter((s) => s.seed.status === 'terminated').length,
  ].join(' / '));

  await backfillManagers(seeded);
  await linkUsers(seeded);
  return seeded;
}

/**
 * One contract per employment stretch. Payroll resolves the contract by DATE
 * RANGE, not by `status`, and refuses a period where two contracts overlap
 * (`PAY_CONTRACT_OVERLAP`) or a gap falls on real working days
 * (`PAY_CONTRACT_GAP`) — so the probation segment must end exactly one day
 * before the official one starts.
 */
async function seedContracts(employeeId: Id, e: EmployeeSeed, hireDate: Date): Promise<void> {
  if (e.officialFrom) {
    const officialStart = resolveDate(e.officialFrom);
    await EmployeeContractModel.findOneAndUpdate(
      { contractNumber: `HD-${e.code}-TV` },
      {
        $set: {
          employeeId,
          contractType: 'fixed_term',
          employmentStatus: 'probation',
          startDate: hireDate,
          endDate: dayBefore(officialStart),
          baseSalary: dec(e.salary),
          currency: 'VND',
          status: 'expired',
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    await EmployeeContractModel.findOneAndUpdate(
      { contractNumber: `HD-${e.code}` },
      {
        $set: {
          employeeId,
          contractType: 'indefinite',
          employmentStatus: 'official',
          startDate: officialStart,
          endDate: null,
          baseSalary: dec(e.salary),
          currency: 'VND',
          status: 'active',
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return;
  }

  await EmployeeContractModel.findOneAndUpdate(
    { contractNumber: `HD-${e.code}` },
    {
      $set: {
        employeeId,
        contractType: e.employment === 'official' ? 'indefinite' : 'fixed_term',
        employmentStatus: e.employment,
        startDate: hireDate,
        // Left open even for probation/internship: a contract that expires
        // mid-window with no successor is exactly the gap payroll refuses.
        endDate: null,
        baseSalary: dec(e.salary),
        currency: 'VND',
        status: e.status === 'terminated' ? 'terminated' : 'active',
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

async function seedHistory(employeeId: Id, e: EmployeeSeed, hireDate: Date, terminationDate: Date | null) {
  const events: { eventType: HistoryEvent; effectiveDate: Date; note: string }[] = [
    { eventType: 'hired', effectiveDate: hireDate, note: 'Nhận việc' },
  ];
  if (e.officialFrom) {
    events.push({ eventType: 'probation_completed', effectiveDate: resolveDate(e.officialFrom), note: 'Hoàn thành thử việc, chuyển chính thức' });
  }
  if (e.position === 'ENG-LEAD') {
    events.push({ eventType: 'promotion', effectiveDate: utcDay(hireDate.getUTCFullYear() + 1, 7, 1), note: 'Thăng chức Tech Lead' });
  }
  if (terminationDate) {
    events.push({ eventType: 'resigned', effectiveDate: terminationDate, note: 'Nghỉ việc theo nguyện vọng cá nhân' });
  }
  for (const ev of events) {
    await EmployeeHistory.findOneAndUpdate(
      { employeeId, eventType: ev.eventType, effectiveDate: ev.effectiveDate },
      { $set: { note: ev.note } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
}

async function backfillManagers(seeded: SeededEmployee[]): Promise<void> {
  const idByCode = new Map(seeded.map((s) => [s.code, s.id]));
  let count = 0;
  for (const s of seeded) {
    const managerId = s.seed.manager ? (idByCode.get(s.seed.manager) ?? null) : null;
    await Employee.updateOne({ _id: s.id }, { $set: { managerId } });
    if (managerId) count += 1;
  }
  line('Employee managers linked', count);
}

/**
 * Wire each demo account to an employee, both directions.
 *
 * `users.employeeId` and `employees.userId` each carry a unique index, so a
 * stale link left over from an earlier run has to be cleared before the new one
 * is written — otherwise the second seed run collides with itself.
 *
 * The account side is reached through IAM's public surface (`userRepository`,
 * `iamDirectory`) rather than its models, which is the same boundary HRM itself
 * has to respect.
 */
async function linkUsers(seeded: SeededEmployee[]): Promise<void> {
  const byCode = new Map(seeded.map((s) => [s.code, s.id]));
  let linked = 0;

  for (const link of USER_LINKS) {
    const user = await userRepository.findByIdentifier(link.email);
    const employeeId = byCode.get(link.employeeCode);
    if (!user || !employeeId) {
      console.warn(`  WARN: cannot link ${link.email} → ${link.employeeCode} (missing user or employee)`);
      continue;
    }

    // Release whichever side is already claimed by someone else.
    await Employee.updateMany({ userId: user.id, _id: { $ne: employeeId } }, { $set: { userId: null } });
    const claimant = await iamDirectory.getUserByEmployeeId(String(employeeId));
    if (claimant && claimant.id !== user.id) {
      await userRepository.updateById(claimant.id, { employeeId: null });
    }

    await Employee.updateOne({ _id: employeeId }, { $set: { userId: user.id } });
    await userRepository.updateById(user.id, { employeeId: String(employeeId) });
    linked += 1;
  }
  line('User ↔ Employee links', linked);
}

/** Departments + positions. Idempotent on the unique `code` of each. */
import type mongoose from 'mongoose';
import { Department } from '@modules/hrm/adapters/persistence/mongoose/models/department.model';
import { Position } from '@modules/hrm/adapters/persistence/mongoose/models/position.model';
import { DEPARTMENTS, POSITIONS } from './dataset';
import { line } from './common';

type Id = mongoose.Types.ObjectId;

export interface OrgIds {
  deptId: Map<string, Id>;
  posId: Map<string, Id>;
}

export async function seedOrganization(): Promise<OrgIds> {
  const deptId = new Map<string, Id>();
  const posId = new Map<string, Id>();

  // Pass 1: the departments themselves. `parentDepartmentId` needs the ids of
  // rows created in this same pass, so it is filled in afterwards.
  for (const d of DEPARTMENTS) {
    const doc = await Department.findOneAndUpdate(
      { code: d.code },
      {
        $set: {
          name: d.name,
          location: d.location,
          costCenter: d.costCenter,
          email: `${d.code.toLowerCase()}@soosky.local`,
          description: `Phòng ${d.name}`,
          status: 'active',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    deptId.set(d.code, doc!._id as Id);
  }

  // Pass 2: the reporting tree.
  for (const d of DEPARTMENTS) {
    await Department.updateOne(
      { _id: deptId.get(d.code) },
      { $set: { parentDepartmentId: d.parent ? (deptId.get(d.parent) ?? null) : null } },
    );
  }
  line('Departments', DEPARTMENTS.length);

  for (const p of POSITIONS) {
    const doc = await Position.findOneAndUpdate(
      { code: p.code },
      {
        $set: {
          title: p.title,
          departmentId: deptId.get(p.dept),
          level: p.level,
          description: `${p.title} — ${p.dept}`,
          status: 'active',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    posId.set(p.code, doc!._id as Id);
  }
  line('Positions', POSITIONS.length);

  return { deptId, posId };
}

/**
 * Point each department at its head. Runs after the employee seed because
 * `Department.managerId` references an employee that does not exist yet when the
 * departments are created.
 */
export async function backfillDepartmentManagers(
  deptId: Map<string, Id>,
  employeeIdByCode: Map<string, Id>,
): Promise<number> {
  let count = 0;
  for (const d of DEPARTMENTS) {
    const managerId = employeeIdByCode.get(d.manager);
    if (!managerId) continue;
    await Department.updateOne({ _id: deptId.get(d.code) }, { $set: { managerId } });
    count += 1;
  }
  line('Department managers linked', count);
  return count;
}

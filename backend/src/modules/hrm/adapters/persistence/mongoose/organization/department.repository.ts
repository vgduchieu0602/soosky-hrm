import { Types, type ClientSession } from 'mongoose';
import { Department } from '@modules/hrm/adapters/persistence/mongoose/models/department.model';
import type { DepartmentRow } from '@modules/hrm/core/organization/domain/department-tree';
import type { DepartmentDoc, DepartmentRepository, Id, Tx } from '@modules/hrm/core/organization/domain/ports';

const valid = (id: Id) => Types.ObjectId.isValid(id);
const oid = (id: Id) => new Types.ObjectId(id);
const json = (d: { toJSON(): Record<string, unknown> } | null) => (d ? d.toJSON() : null);

/** ObjectId reference fields that arrive from the application as string | null. */
const REF_KEYS = ['parentDepartmentId', 'managerId'] as const;

function toDoc(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const k of REF_KEYS) {
    if (k in out) out[k] = out[k] == null ? null : new Types.ObjectId(out[k] as string);
  }
  return out;
}

export class MongooseDepartmentRepository implements DepartmentRepository {
  async findAll(): Promise<DepartmentRow[]> {
    const docs = await Department.find({}).sort({ code: 1 }).lean();
    return docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      code: d.code,
      parentDepartmentId: d.parentDepartmentId ? String(d.parentDepartmentId) : null,
      managerId: d.managerId ? String(d.managerId) : null,
      description: d.description,
      status: d.status,
    }));
  }

  async findById(id: Id): Promise<DepartmentDoc | null> {
    if (!valid(id)) return null;
    const doc = await Department.findById(id).populate({
      path: 'managerId',
      select: 'employeeCode status',
    });
    return json(doc);
  }

  async findByCode(code: string): Promise<DepartmentDoc | null> {
    return json(await Department.findOne({ code: code.trim().toUpperCase() }));
  }

  async findChildren(parentId: Id): Promise<{ status: string }[]> {
    if (!valid(parentId)) return [];
    return Department.find({ parentDepartmentId: oid(parentId) }).lean() as unknown as Promise<
      { status: string }[]
    >;
  }

  async create(input: Record<string, unknown>): Promise<DepartmentDoc> {
    return (await Department.create(toDoc(input))).toJSON() as unknown as DepartmentDoc;
  }

  async updateById(id: Id, patch: Record<string, unknown>, tx?: Tx): Promise<DepartmentDoc | null> {
    if (!valid(id)) return null;
    return json(
      await Department.findByIdAndUpdate(id, toDoc(patch), {
        new: true,
        session: tx as ClientSession | undefined,
      }),
    );
  }

  async deleteById(id: Id): Promise<DepartmentDoc | null> {
    if (!valid(id)) return null;
    return json(await Department.findByIdAndDelete(id));
  }

  async countChildren(deptId: Id): Promise<number> {
    if (!valid(deptId)) return 0;
    return Department.countDocuments({ parentDepartmentId: oid(deptId) });
  }
}

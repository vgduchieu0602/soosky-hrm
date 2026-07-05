import { Types } from 'mongoose';
import { Position } from '@shared/models/position.model';
import type { PositionDoc, PositionRepository, Id } from '@features/organization/domain/ports';

const valid = (id: Id) => Types.ObjectId.isValid(id);
const json = (d: { toJSON(): Record<string, unknown> } | null) => (d ? d.toJSON() : null);

function toDoc(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if ('departmentId' in out && out.departmentId != null) {
    out.departmentId = new Types.ObjectId(out.departmentId as string);
  }
  return out;
}

export class MongoosePositionRepository implements PositionRepository {
  list(filter: { departmentId?: string; status?: string }): Promise<PositionDoc[]> {
    const match: Record<string, unknown> = {};
    if (filter.departmentId && Types.ObjectId.isValid(filter.departmentId)) {
      match.departmentId = new Types.ObjectId(filter.departmentId);
    }
    if (filter.status) match.status = filter.status;
    return Position.find(match as unknown as Parameters<typeof Position.find>[0])
      .sort({ level: -1, title: 1 })
      .lean() as unknown as Promise<PositionDoc[]>;
  }

  async findById(id: Id): Promise<PositionDoc | null> {
    if (!valid(id)) return null;
    return json(await Position.findById(id));
  }

  async findByCode(code: string): Promise<PositionDoc | null> {
    return json(await Position.findOne({ code: code.trim().toUpperCase() }));
  }

  async create(input: Record<string, unknown>): Promise<PositionDoc> {
    return (await Position.create(toDoc(input))).toJSON() as unknown as PositionDoc;
  }

  async updateById(id: Id, patch: Record<string, unknown>): Promise<PositionDoc | null> {
    if (!valid(id)) return null;
    return json(await Position.findByIdAndUpdate(id, toDoc(patch), { new: true }));
  }

  async deleteById(id: Id): Promise<PositionDoc | null> {
    if (!valid(id)) return null;
    return json(await Position.findByIdAndDelete(id));
  }
}

import { Types } from 'mongoose';
import { Position, type IPosition } from '@shared/models/position.model';

export const positionRepository = {
  list(filter: { departmentId?: string; status?: string }) {
    const match: Record<string, unknown> = {};
    if (filter.departmentId && Types.ObjectId.isValid(filter.departmentId)) {
      match.departmentId = new Types.ObjectId(filter.departmentId);
    }
    if (filter.status) match.status = filter.status;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Position.find(match as any)
      .sort({ level: -1, title: 1 })
      .lean();
  },

  findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Position.findById(id);
  },

  findByCode(code: string) {
    return Position.findOne({ code: code.trim().toUpperCase() });
  },

  create(input: Partial<IPosition>) {
    return Position.create(input);
  },

  updateById(id: string, patch: Partial<IPosition>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Position.findByIdAndUpdate(id, patch, { new: true });
  },

  deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Position.findByIdAndDelete(id);
  },
};

import { Types } from 'mongoose';
import {
  PerformanceCriterion,
  type IPerformanceCriterion,
} from '@modules/hrm/adapters/persistence/mongoose/models/performance-criterion.model';
import type { CriterionRepository, CriterionRecord, Id } from '@modules/hrm/core/performance/domain/ports';

/** A criterion as it comes back from Mongoose (`.lean()` or `.toJSON()`). */
type CriterionDoc = IPerformanceCriterion & { _id: unknown };

const map = (criterion: CriterionDoc): CriterionRecord => ({
  _id: criterion._id,
  criterionId: String(criterion._id),
  key: criterion.key,
  name: criterion.label,
  description: criterion.description,
  group: criterion.type,
  weight: criterion.weight ?? 0,
  order: criterion.order ?? 0,
  active: criterion.status === 'active',
});

export class MongooseCriterionRepository implements CriterionRepository {
  async list(group?: 'performance' | 'goal'): Promise<CriterionRecord[]> {
    const criteria = await PerformanceCriterion.find(group ? { type: group } : {}).sort({ type: 1, order: 1, label: 1 }).lean();
    return criteria.map((criterion) => map(criterion as unknown as CriterionDoc));
  }

  async create(input: Omit<CriterionRecord, '_id' | 'criterionId' | 'active'>): Promise<CriterionRecord> {
    const criterion = await PerformanceCriterion.create({
      key: input.key,
      label: input.name,
      description: input.description ?? '',
      type: input.group,
      weight: input.weight,
      order: input.order,
      status: 'active',
    });
    return map(criterion.toJSON() as unknown as CriterionDoc);
  }

  async update(id: Id, patch: Partial<Omit<CriterionRecord, '_id' | 'key' | 'active'>>): Promise<CriterionRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const updated = await PerformanceCriterion.findByIdAndUpdate(id, {
      ...(patch.name != null ? { label: patch.name } : {}),
      ...(patch.description != null ? { description: patch.description } : {}),
      ...(patch.group != null ? { type: patch.group } : {}),
      ...(patch.weight != null ? { weight: patch.weight } : {}),
      ...(patch.order != null ? { order: patch.order } : {}),
    }, { new: true });
    return updated ? map(updated.toJSON() as unknown as CriterionDoc) : null;
  }

  async deactivate(id: Id): Promise<CriterionRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const updated = await PerformanceCriterion.findByIdAndUpdate(id, { status: 'archived' }, { new: true });
    return updated ? map(updated.toJSON() as unknown as CriterionDoc) : null;
  }
}

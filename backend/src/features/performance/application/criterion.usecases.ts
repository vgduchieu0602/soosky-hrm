import { NotFoundError } from '@shared/errors/not-found.error';
import type { CriterionRepository } from '@features/performance/domain/ports';
import type { CreateCriterionDto, UpdateCriterionDto } from '@features/performance/dto/criterion.dto';

export class CriterionUseCases {
  constructor(private readonly criteria: CriterionRepository) {}

  list(group?: 'performance' | 'goal') {
    return this.criteria.list(group);
  }

  create(input: CreateCriterionDto) {
    return this.criteria.create({
      key: input.key,
      name: input.label,
      description: input.description,
      group: input.type,
      weight: input.weight,
      order: input.order ?? 0,
    });
  }

  async update(id: string, input: UpdateCriterionDto) {
    const updated = await this.criteria.update(id, {
      ...(input.label != null ? { name: input.label } : {}),
      ...(input.description != null ? { description: input.description } : {}),
      ...(input.type != null ? { group: input.type } : {}),
      ...(input.weight != null ? { weight: input.weight } : {}),
      ...(input.order != null ? { order: input.order } : {}),
    });
    if (!updated) throw new NotFoundError('Performance criterion');
    return updated;
  }

  async deactivate(id: string) {
    const updated = await this.criteria.deactivate(id);
    if (!updated) throw new NotFoundError('Performance criterion');
    return updated;
  }
}

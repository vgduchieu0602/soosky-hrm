import { HttpError } from '@shared/errors/http-error';
import { isValidObjectId } from '@modules/hrm/core/employee/domain/employee-rules';
import type { HistoryRepository, Clock, Tx } from '@modules/hrm/core/employee/domain/ports';

export interface RecordEventInput {
  employeeId: string;
  eventType: string;
  fromValue?: Record<string, unknown>;
  toValue?: Record<string, unknown>;
  note?: string;
  createdBy?: string;
  effectiveDate?: Date;
}

export class HistoryUseCases {
  constructor(private readonly repo: HistoryRepository, private readonly clock: Clock) {}

  list(employeeId: string) {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    return this.repo.listByEmployee(employeeId);
  }

  record(input: RecordEventInput, tx?: Tx) {
    return this.repo.create(
      {
        employeeId: input.employeeId,
        eventType: input.eventType,
        fromValue: input.fromValue,
        toValue: input.toValue,
        effectiveDate: input.effectiveDate ?? this.clock.now(),
        note: input.note,
        createdBy: input.createdBy ?? null,
      },
      tx,
    );
  }
}

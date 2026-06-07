import { Types } from 'mongoose';
import { employeeHistoryRepository } from '@features/employee/repositories/employee-history.repository';
import { HttpError } from '@shared/errors/http-error';
import type { HistoryEvent } from '@shared/models/employee-history.model';

interface RecordEventInput {
  employeeId: string;
  eventType: HistoryEvent;
  fromValue?: Record<string, unknown>;
  toValue?: Record<string, unknown>;
  note?: string;
  createdBy?: string;
  effectiveDate?: Date;
}

export const employeeHistoryService = {
  list(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    return employeeHistoryRepository.listByEmployee(employeeId);
  },

  record(input: RecordEventInput) {
    return employeeHistoryRepository.create({
      employeeId: new Types.ObjectId(input.employeeId),
      eventType: input.eventType,
      fromValue: input.fromValue,
      toValue: input.toValue,
      effectiveDate: input.effectiveDate ?? new Date(),
      note: input.note,
      createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : null,
    });
  },
};

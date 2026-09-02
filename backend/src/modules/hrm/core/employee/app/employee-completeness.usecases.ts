import { HttpError } from '@shared/errors/http-error';
import { isValidObjectId, buildCompleteness, type ChecklistItem } from '@modules/hrm/core/employee/domain/employee-rules';
import type { CompletenessGateway } from '@modules/hrm/core/employee/domain/ports';

export type { ChecklistItem };

export class EmployeeCompletenessUseCases {
  constructor(private readonly gateway: CompletenessGateway) {}

  async forEmployee(employeeId: string): Promise<{ percent: number; items: ChecklistItem[] }> {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    const data = await this.gateway.gather(employeeId);
    if (!data) throw new HttpError(404, 'Employee not found', 'EMP_001');
    return buildCompleteness({
      hasUser: !!data.userId,
      profile: data.profile,
      contacts: data.contacts,
      banks: data.banks,
      contracts: data.contracts,
      docs: data.docs,
    });
  }
}

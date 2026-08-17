/// <reference types="jest" />
import { PayrollApprovalUseCases } from '@features/payroll/application/payroll-approval.usecases';

describe('PayrollApprovalUseCases snapshot lifecycle', () => {
  it('approves the existing draft payroll without recalculating or replacing its snapshot', async () => {
    const row = {
      status: 'draft',
      calculationSnapshot: { version: 1, policy: { weights: { attendance: 20, performance: 60, goal: 20 } } },
    };
    const approveMany = jest.fn(async () => {
      row.status = 'approved';
    });
    const markProcessing = jest.fn(async () => undefined);

    const useCases = new PayrollApprovalUseCases(
      {
        findById: async () => ({ _id: 'period-1', name: '2026-08', status: 'open' }),
        markProcessing,
      } as never,
      { countDrafts: async () => 1, approveMany } as never,
      { record: async () => undefined } as never,
      { payrollApproved: () => undefined } as never,
      { withTransaction: async (work: (tx: unknown) => Promise<unknown>) => work('transaction') } as never,
    );

    await expect(useCases.approve('period-1', 'hr-1')).resolves.toEqual({ periodId: 'period-1', affected: 1 });

    expect(approveMany).toHaveBeenCalledWith('period-1', undefined, 'hr-1', 'transaction');
    expect(markProcessing).toHaveBeenCalledWith('period-1', 'transaction');
    expect(row).toEqual({
      status: 'approved',
      calculationSnapshot: {
        version: 1,
        policy: { weights: { attendance: 20, performance: 60, goal: 20 } },
      },
    });
  });
});

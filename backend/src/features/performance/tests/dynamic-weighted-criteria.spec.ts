/// <reference types="jest" />
import { EvaluationUseCases } from '@features/performance/application/evaluation.usecases';

const CRITERIA = [
  { criterionId: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Quality', group: 'performance', weight: 30 },
  { criterionId: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Productivity', group: 'performance', weight: 70 },
  { criterionId: 'cccccccccccccccccccccccc', name: 'Revenue goal', group: 'goal', weight: 100 },
];

function build(criteria = CRITERIA, existing: Record<string, unknown> | null = null) {
  let saved: Record<string, unknown> | undefined;
  const useCases = new EvaluationUseCases(
    {
      findByEmployeePeriod: async () => existing,
      upsert: async (_employeeId: string, _periodId: string, fields: Record<string, unknown>) => {
        saved = fields;
        return { _id: 'dddddddddddddddddddddddd', employeeId: _employeeId, payrollPeriodId: _periodId, ...fields };
      },
    } as never,
    { findManager: async () => ({ managerId: null }) } as never,
    {
      activeTypeSets: async () => ({
        performance: new Set(criteria.filter((c) => c.group === 'performance').map((c) => c.criterionId)),
        goal: new Set(criteria.filter((c) => c.group === 'goal').map((c) => c.criterionId)),
      }),
      activeDefinitions: async () => criteria,
    } as never,
    {} as never,
    { record: async () => undefined } as never,
    { evaluationFinalized: () => undefined } as never,
    { now: () => new Date('2026-08-31T00:00:00.000Z') } as never,
  );
  return { useCases, saved: () => saved! };
}

describe('dynamic weighted evaluation criteria', () => {
  it('finalizes with weighted performance and goal ratios and snapshots the applied definitions', async () => {
    const { useCases, saved } = build();

    await useCases.directEvaluate(
      {
        employeeId: '111111111111111111111111',
        payrollPeriodId: '222222222222222222222222',
        criteriaScores: [
          { criterionId: CRITERIA[0]!.criterionId, score: 80 },
          { criterionId: CRITERIA[1]!.criterionId, score: 90 },
          { criterionId: CRITERIA[2]!.criterionId, score: 95 },
        ],
        finalize: true,
      },
      '333333333333333333333333',
    );

    expect(saved()).toMatchObject({
      performanceRatio: 87,
      goalRatio: 95,
      criteriaDefinitionSnapshot: CRITERIA,
    });
  });

  it('rejects finalization when active group weights are not exactly 100', async () => {
    const { useCases } = build([
      { criterionId: CRITERIA[0]!.criterionId, name: 'Quality', group: 'performance', weight: 30 },
      { criterionId: CRITERIA[1]!.criterionId, name: 'Productivity', group: 'performance', weight: 60 },
      CRITERIA[2]!,
    ]);

    await expect(
      useCases.directEvaluate(
        {
          employeeId: '111111111111111111111111',
          payrollPeriodId: '222222222222222222222222',
          criteriaScores: CRITERIA.map((criterion) => ({ criterionId: criterion.criterionId, score: 90 })),
          finalize: true,
        },
        '333333333333333333333333',
      ),
    ).rejects.toMatchObject({ code: 'EVAL_INVALID_CRITERIA_WEIGHTS' });
  });

  it('allows a draft with incomplete scores while still capturing its criteria set', async () => {
    const { useCases, saved } = build();

    await useCases.directEvaluate(
      {
        employeeId: '111111111111111111111111',
        payrollPeriodId: '222222222222222222222222',
        criteriaScores: [{ criterionId: CRITERIA[0]!.criterionId, score: 80 }],
        finalize: false,
      },
      '333333333333333333333333',
    );

    expect(saved()).toMatchObject({ status: 'draft', criteriaDefinitionSnapshot: CRITERIA });
  });

  it('rejects finalization with a missing performance criterion', async () => {
    const { useCases } = build();

    await expect(useCases.directEvaluate({
      employeeId: '111111111111111111111111',
      payrollPeriodId: '222222222222222222222222',
      criteriaScores: [
        { criterionId: CRITERIA[0]!.criterionId, score: 80 },
        { criterionId: CRITERIA[2]!.criterionId, score: 95 },
      ],
      finalize: true,
    }, '333333333333333333333333')).rejects.toMatchObject({ code: 'EVAL_INCOMPLETE_PERFORMANCE' });
  });

  it('rejects finalization with a missing goal criterion', async () => {
    const { useCases } = build();

    await expect(useCases.directEvaluate({
      employeeId: '111111111111111111111111',
      payrollPeriodId: '222222222222222222222222',
      criteriaScores: [
        { criterionId: CRITERIA[0]!.criterionId, score: 80 },
        { criterionId: CRITERIA[1]!.criterionId, score: 90 },
      ],
      finalize: true,
    }, '333333333333333333333333')).rejects.toMatchObject({ code: 'EVAL_INCOMPLETE_GOAL' });
  });

  it('uses the saved definition snapshot instead of later current criterion weights', async () => {
    const existing = {
      _id: 'dddddddddddddddddddddddd',
      employeeId: '111111111111111111111111',
      payrollPeriodId: '222222222222222222222222',
      status: 'draft',
      criteriaDefinitionSnapshot: CRITERIA,
    };
    const changedCurrentCriteria = [
      { ...CRITERIA[0]!, weight: 50 },
      { ...CRITERIA[1]!, weight: 50 },
      CRITERIA[2]!,
    ];
    const { useCases, saved } = build(changedCurrentCriteria, existing);

    await useCases.directEvaluate(
      {
        employeeId: '111111111111111111111111',
        payrollPeriodId: '222222222222222222222222',
        criteriaScores: [
          { criterionId: CRITERIA[0]!.criterionId, score: 80 },
          { criterionId: CRITERIA[1]!.criterionId, score: 90 },
          { criterionId: CRITERIA[2]!.criterionId, score: 95 },
        ],
        finalize: true,
      },
      '333333333333333333333333',
    );

    expect(saved()).toMatchObject({ performanceRatio: 87, criteriaDefinitionSnapshot: CRITERIA });
  });
});

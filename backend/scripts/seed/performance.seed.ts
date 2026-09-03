/**
 * Monthly evaluations, scored through `evaluationService.directEvaluate`.
 *
 * Going through the use-case rather than writing `monthlyEvaluations` directly
 * is what produces `performanceRatio` / `goalRatio` from the criterion weights
 * and captures `criteriaDefinitionSnapshot` — the two things payroll reads and a
 * payslip needs to explain itself later.
 *
 * Every employee in a closed period's run scope gets a finalized evaluation,
 * because `lockPerformance` refuses to lock while even one is missing.
 */
import { evaluationService } from '@modules/hrm';
import { PerformanceCriterion } from '@modules/hrm/adapters/persistence/mongoose/models/performance-criterion.model';
import { userRepository } from '@modules/iam';
import { USER_LINKS } from './dataset';
import { makeRng, line } from './common';
import type { SeededEmployee } from './employee.seed';
import type { SeededPeriod } from './period.seed';

/** Spread so the dashboards and payroll show a distribution, not one flat number. */
const SCORE_POOL = [60, 70, 75, 80, 85, 90, 95];

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export interface PerformanceSeedResult {
  finalized: number;
  drafts: number;
  acknowledged: number;
  errors: string[];
}

export async function seedPerformance(
  employees: SeededEmployee[],
  periods: SeededPeriod[],
): Promise<PerformanceSeedResult> {
  const result: PerformanceSeedResult = { finalized: 0, drafts: 0, acknowledged: 0, errors: [] };

  const criteria = await PerformanceCriterion.find({ status: 'active' }).select('_id key').lean();
  if (criteria.length === 0) {
    throw new Error('No active performance criteria — run `pnpm seed` before `pnpm seed:demo`.');
  }

  const hr = await userRepository.findByIdentifier('hr@soosky.local');
  if (!hr) throw new Error('hr@soosky.local not found — run `pnpm seed` before `pnpm seed:demo`.');
  const hrUserId = hr.id;

  const closedPeriods = periods.filter((p) => p.offset < 0);
  const currentPeriod = periods.find((p) => p.offset === 0);
  /** Evaluations to acknowledge afterwards: only the employees that have a login. */
  const acknowledgeable = new Map<string, string>(); // employeeCode → evaluationId

  for (const period of closedPeriods) {
    for (const employee of employees) {
      const inScope =
        employee.hireDate.getTime() <= period.end.getTime() &&
        (employee.terminationDate === null || employee.terminationDate.getTime() >= period.start.getTime());
      if (!inScope) continue;

      const index = Number(employee.code.slice(3));
      const rng = makeRng(period.year * 1_000 + period.month * 37 + index);
      const base = SCORE_POOL[(index + Math.abs(period.offset)) % SCORE_POOL.length]!;
      const scores = criteria.map((c) => ({
        criterionId: String(c._id),
        score: clamp(base + rng.int(-5, 5)),
      }));

      try {
        const doc = await evaluationService.directEvaluate(
          {
            employeeId: String(employee.id),
            payrollPeriodId: String(period.id),
            criteriaScores: scores,
            strengths: base >= 85 ? 'Chủ động, chất lượng công việc tốt.' : 'Hoàn thành công việc được giao.',
            improvements: base < 75 ? 'Cần cải thiện tiến độ và chủ động báo cáo.' : 'Có thể tham gia sâu hơn vào việc hướng dẫn thành viên mới.',
            developmentPlan: 'Tham gia khoá đào tạo nội bộ trong quý tới.',
            finalize: true,
          },
          hrUserId,
        );
        result.finalized += 1;
        if (period.offset === -2) acknowledgeable.set(employee.code, String(doc._id));
      } catch (err) {
        result.errors.push(`${employee.code} ${period.name}: ${(err as Error).message}`);
      }
    }
  }

  // A handful of drafts in the open month so the "chưa chốt" state is testable.
  if (currentPeriod) {
    const draftFor = employees.filter((e) => ['EMP005', 'EMP006', 'EMP007', 'EMP013'].includes(e.code));
    for (const employee of draftFor) {
      const index = Number(employee.code.slice(3));
      const rng = makeRng(currentPeriod.year * 1_000 + currentPeriod.month * 37 + index);
      const base = SCORE_POOL[index % SCORE_POOL.length]!;
      try {
        await evaluationService.directEvaluate(
          {
            employeeId: String(employee.id),
            payrollPeriodId: String(currentPeriod.id),
            criteriaScores: criteria.map((c) => ({ criterionId: String(c._id), score: clamp(base + rng.int(-5, 5)) })),
            finalize: false,
          },
          hrUserId,
        );
        result.drafts += 1;
      } catch (err) {
        result.errors.push(`${employee.code} ${currentPeriod.name} (draft): ${(err as Error).message}`);
      }
    }
  }

  // Acknowledgement can only be performed by the employee themselves, so it is
  // limited to the three demo logins.
  for (const link of USER_LINKS) {
    const evaluationId = acknowledgeable.get(link.employeeCode);
    if (!evaluationId) continue;
    const user = await userRepository.findByIdentifier(link.email);
    if (!user) continue;
    try {
      await evaluationService.acknowledge(evaluationId, undefined, user.id);
      result.acknowledged += 1;
    } catch (err) {
      result.errors.push(`acknowledge ${link.employeeCode}: ${(err as Error).message}`);
    }
  }

  line('Evaluations', `${result.finalized} approved, ${result.drafts} draft, ${result.acknowledged} acknowledged`);
  for (const e of result.errors) console.warn(`  WARN evaluation — ${e}`);
  return result;
}

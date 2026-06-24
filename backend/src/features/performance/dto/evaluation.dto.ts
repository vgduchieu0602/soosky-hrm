import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id không hợp lệ');

const scoreItem = z
  .object({
    criterionId: objectId,
    score: z.coerce.number().min(0).max(100),
  })
  .strict();

/** Direct evaluate (HR/manager): upsert + draft or finalize in one call. */
export const directEvaluateDto = z
  .object({
    employeeId: objectId,
    payrollPeriodId: objectId,
    criteriaScores: z.array(scoreItem),
    strengths: z.string().max(2000).nullable().optional(),
    improvements: z.string().max(2000).nullable().optional(),
    developmentPlan: z.string().max(2000).nullable().optional(),
    finalize: z.coerce.boolean().optional(),
  })
  .strict();
export type DirectEvaluateDto = z.infer<typeof directEvaluateDto>;

/** Employee acknowledgement (optional dispute note). */
export const acknowledgeDto = z
  .object({
    disputeNote: z.string().max(1000).nullable().optional(),
  })
  .strict();
export type AcknowledgeDto = z.infer<typeof acknowledgeDto>;

/** HR reopens an approved evaluation — reason recorded for transparency. */
export const reopenDto = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();
export type ReopenDto = z.infer<typeof reopenDto>;

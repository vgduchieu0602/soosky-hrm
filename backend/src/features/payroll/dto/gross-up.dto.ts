import { z } from 'zod';

/** NET → GROSS calculator input. The effective salary policy supplies tax
 *  brackets, deductions, insurance rates and the regional ceilings. */
export const grossUpDto = z
  .object({
    net: z.coerce.number().min(0),
    /** Policy is resolved as the one effective at this date (defaults to today). */
    payDate: z.coerce.date().optional(),
    dependentsCount: z.coerce.number().int().min(0).optional(),
    isResident: z.coerce.boolean().optional(),
    salaryZone: z.enum(['zone1', 'zone2', 'zone3', 'zone4']).optional(),
  })
  .strict();
export type GrossUpDto = z.infer<typeof grossUpDto>;

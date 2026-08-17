/// <reference types="jest" />

import { createSalaryPolicyDto, updateSalaryPolicyDto } from '@features/settings/dto/settings.dto';

const basePolicy = {
  country: 'VN',
  year: 2026,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  baseSalary: 2_340_000,
};

describe('salary policy intern stipend validation', () => {
  it('accepts zero as an explicit configured intern pay amount', () => {
    const result = createSalaryPolicyDto.safeParse({ ...basePolicy, internStipend: 0 });

    expect(result.success).toBe(true);
  });

  it('rejects a negative intern pay amount', () => {
    const result = updateSalaryPolicyDto.safeParse({ internStipend: -1 });

    expect(result.success).toBe(false);
  });
});

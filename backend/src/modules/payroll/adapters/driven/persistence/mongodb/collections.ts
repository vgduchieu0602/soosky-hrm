/** Tên collection MongoDB của module Payroll (đặt tiền tố `pay_`). */
export const PAYROLL_COLLECTIONS = {
    periods:      "pay_periods",
    payslips:     "pay_payslips",
    allowances:   "pay_allowances",
    bonuses:      "pay_bonuses",
    deductions:   "pay_deductions",
    taxProfiles:  "pay_tax_profiles",
    policies:     "pay_policies",
    retroAdjustments: "pay_retro_adjustments",
    variances:        "pay_variances",
} as const;

/** Tên collection MongoDB của module Employee (đặt tiền tố `emp_`). */
export const EMPLOYEE_COLLECTIONS = {
    employees:    "emp_employees",
    profiles:     "emp_profiles",
    contacts:     "emp_contacts",
    bankAccounts: "emp_bank_accounts",
    documents:    "emp_documents",
    contracts:    "emp_contracts",
    assets:       "emp_assets",
    history:      "emp_history",
} as const;

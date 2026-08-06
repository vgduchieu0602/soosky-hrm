import api from "@core/http/axios";

/** Nguồn dữ liệu cho một cột file chuyển lương — khớp danh sách backend. */
export const BANK_COLUMN_SOURCES = [
  "sequence",
  "employee_code",
  "employee_name",
  "bank_account_number",
  "bank_account_holder",
  "bank_name",
  "bank_branch",
  "net_salary",
  "period_name",
  "pay_date",
  "static",
] as const;
export type BankColumnSource = (typeof BANK_COLUMN_SOURCES)[number];

export const BANK_COLUMN_LABELS: Record<BankColumnSource, string> = {
  sequence: "Số thứ tự",
  employee_code: "Mã nhân viên",
  employee_name: "Tên nhân viên",
  bank_account_number: "Số tài khoản",
  bank_account_holder: "Tên chủ tài khoản",
  bank_name: "Tên ngân hàng",
  bank_branch: "Chi nhánh",
  net_salary: "Số tiền (thực nhận)",
  period_name: "Kỳ lương",
  pay_date: "Ngày chi",
  static: "Giá trị cố định",
};

export interface BankTransferColumn {
  header: string;
  source: BankColumnSource;
  staticValue?: string | null;
}

export interface BankTransferProfile {
  id: string;
  code: string;
  bankName: string;
  description: string | null;
  delimiter: string;
  includeHeader: boolean;
  utf8Bom: boolean;
  amountFormat: "plain" | "grouped";
  dateFormat: string;
  columns: BankTransferColumn[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankTransferProfileInput {
  code: string;
  bankName: string;
  description?: string;
  delimiter?: string;
  includeHeader?: boolean;
  utf8Bom?: boolean;
  amountFormat?: "plain" | "grouped";
  dateFormat?: string;
  columns: BankTransferColumn[];
}

export const bankTransferService = {
  async list(): Promise<BankTransferProfile[]> {
    const { data } = await api.get<{ bankProfiles: BankTransferProfile[] }>("/setting/bank-profiles");
    return data.bankProfiles;
  },
  async create(input: CreateBankTransferProfileInput): Promise<BankTransferProfile> {
    const { data } = await api.post<BankTransferProfile>("/setting/bank-profiles", input);
    return data;
  },
  async update(id: string, input: Partial<CreateBankTransferProfileInput>): Promise<BankTransferProfile> {
    const { data } = await api.patch<BankTransferProfile>(`/setting/bank-profiles/${id}`, input);
    return data;
  },
  async activate(id: string): Promise<BankTransferProfile> {
    const { data } = await api.post<BankTransferProfile>(`/setting/bank-profiles/${id}/activate`);
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/setting/bank-profiles/${id}`);
  },
};

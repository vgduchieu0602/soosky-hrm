// Soosky HRM — Employees mock data
// Maps to: employees + employeeProfiles + employeeContacts + employeeDocuments
//          + employeeContracts + employeeAssets + employeeHistory.
// Replace with real API responses (see share-docs/API-SPEC.md).

export const DEPARTMENTS = [
  "UA Team", "PO Team", "App Team", "Design Team", "QA Team", "BE Team", "HR",
] as const;

export type EmpStatusKey = "active" | "onboarding" | "on_leave" | "terminated";

export const EMP_STATUS: Record<EmpStatusKey, { label: string; variant: string }> = {
  active: { label: "Đang làm việc", variant: "emerald" },
  onboarding: { label: "Onboarding", variant: "blue" },
  on_leave: { label: "Đang nghỉ", variant: "amber" },
  terminated: { label: "Đã nghỉ việc", variant: "slate" },
};

export type EmpTypeKey = "full_time" | "part_time" | "contract" | "intern";

export const EMP_TYPE: Record<EmpTypeKey, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Hợp đồng",
  intern: "Thực tập",
};

export const DOC_TYPE: Record<string, string> = {
  id_card: "CCCD/CMND",
  passport: "Hộ chiếu",
  degree: "Bằng cấp",
  certificate: "Chứng chỉ",
  visa: "Visa",
  other: "Khác",
};

export const CONTRACT_TYPE: Record<string, string> = {
  probation: "Thử việc",
  fixed_term: "Có thời hạn",
  indefinite: "Không thời hạn",
  internship: "Thực tập",
};

export const REL: Record<string, string> = {
  spouse: "Vợ/Chồng",
  parent: "Cha/Mẹ",
  sibling: "Anh/Chị/Em",
  other: "Khác",
};

export const COND: Record<string, string> = {
  new: "Mới",
  good: "Tốt",
  fair: "Khá",
  damaged: "Hư hỏng",
};

export const HIST_EVENT: Record<string, string> = {
  hired: "Tuyển dụng",
  promotion: "Thăng chức",
  transfer: "Điều chuyển",
  salary_change: "Thay đổi lương",
  contract_renew: "Gia hạn HĐ",
  terminated: "Nghỉ việc",
};

export const GENDER: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
  undisclosed: "Không tiết lộ",
};

export const MARITAL: Record<string, string> = {
  single: "Độc thân",
  married: "Đã kết hôn",
  divorced: "Ly hôn",
  widowed: "Goá",
};

export interface EmployeeContact {
  name: string;
  rel: string;
  phone: string;
  primary?: boolean;
}

export interface EmployeeDocument {
  type: string;
  num: string;
  issued: string;
  expiry?: string;
  by: string;
}

export interface EmployeeContract {
  no: string;
  type: string;
  start: string;
  end: string | null;
  base: string;
  status: string;
}

export interface EmployeeAsset {
  name: string;
  code: string;
  assigned: string;
  condition: string;
}

export interface EmployeeHistory {
  event: string;
  date: string;
  note: string;
}

export interface Employee {
  code: string;
  first: string;
  last: string;
  initials: string;
  dept: string;
  position: string;
  manager: string;
  type: EmpTypeKey;
  status: EmpStatusKey;
  hireDate: string;
  zone: string;
  email: string;
  personalEmail: string;
  phone: string;
  dob: string;
  gender: string;
  marital: string;
  nationality: string;
  address: string;
  contacts: EmployeeContact[];
  documents: EmployeeDocument[];
  contracts: EmployeeContract[];
  assets: EmployeeAsset[];
  history: EmployeeHistory[];
}

export const fullName = (e: Pick<Employee, "first" | "last">) => `${e.last} ${e.first}`;

export const EMPLOYEES: Employee[] = [
  { code: "EMP-0011", first: "Quỳnh Trang", last: "Phan", initials: "QT", dept: "UA Team", position: "UA Team Leader", manager: "Phạm Thu Hương (CGO)", type: "full_time", status: "active", hireDate: "02/03/2022", zone: "zone1",
    email: "trang.phan@soosky.co", personalEmail: "quynhtrang@gmail.com", phone: "+84 901 234 567", dob: "14/08/1993", gender: "female", marital: "married", nationality: "VN", address: "24 Lê Lợi, Q.1, TP.HCM",
    contacts: [{ name: "Phan Văn Hùng", rel: "spouse", phone: "+84 902 111 222", primary: true }],
    documents: [{ type: "id_card", num: "079123456789", issued: "12/05/2018", expiry: "12/05/2033", by: "Cục CS QLHC" }, { type: "degree", num: "DH-2015-4421", issued: "20/06/2015", by: "ĐH Kinh tế" }],
    contracts: [{ no: "HD-2022-0011", type: "indefinite", start: "02/03/2022", end: null, base: "32,000,000", status: "active" }],
    assets: [{ name: 'MacBook Pro 14"', code: "MBP-0011", assigned: "05/03/2022", condition: "good" }, { name: "iPhone 14", code: "IP-0032", assigned: "05/03/2022", condition: "good" }],
    history: [{ event: "promotion", date: "01/01/2024", note: "UA Specialist → UA Team Leader" }, { event: "salary_change", date: "01/01/2024", note: "28,000,000 → 32,000,000" }, { event: "hired", date: "02/03/2022", note: "Gia nhập Soosky" }] },
  { code: "EMP-0034", first: "Trọng Hải", last: "Bùi", initials: "TH", dept: "App Team", position: "App Team Leader", manager: "Lê Minh Quân (CEO)", type: "full_time", status: "active", hireDate: "15/07/2021", zone: "zone1",
    email: "hai.bui@soosky.co", personalEmail: "buitronghai@gmail.com", phone: "+84 903 555 888", dob: "02/11/1991", gender: "male", marital: "married", nationality: "VN", address: "88 Cầu Giấy, Hà Nội",
    contacts: [{ name: "Bùi Thị Mai", rel: "spouse", phone: "+84 904 333 111", primary: true }],
    documents: [{ type: "id_card", num: "001091000123", issued: "03/02/2017", expiry: "03/02/2032", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2021-0034", type: "indefinite", start: "15/07/2021", end: null, base: "38,000,000", status: "active" }],
    assets: [{ name: 'MacBook Pro 16"', code: "MBP-0034", assigned: "16/07/2021", condition: "good" }],
    history: [{ event: "salary_change", date: "01/07/2023", note: "34,000,000 → 38,000,000" }, { event: "hired", date: "15/07/2021", note: "Gia nhập Soosky" }] },
  { code: "EMP-0067", first: "Ngọc Linh", last: "Vũ", initials: "NL", dept: "Design Team", position: "Design Team Leader", manager: "Lê Minh Quân (CEO)", type: "full_time", status: "active", hireDate: "01/04/2020", zone: "zone1",
    email: "linh.vu@soosky.co", personalEmail: "vungoclinh@gmail.com", phone: "+84 905 222 444", dob: "19/05/1988", gender: "female", marital: "married", nationality: "VN", address: "12 Trần Duy Hưng, Hà Nội",
    contacts: [{ name: "Vũ Anh Tú", rel: "sibling", phone: "+84 906 777 999", primary: true }],
    documents: [{ type: "passport", num: "C1234567", issued: "10/01/2020", expiry: "10/01/2030", by: "Cục QLXNC" }],
    contracts: [{ no: "HD-2020-0067", type: "indefinite", start: "01/04/2020", end: null, base: "52,000,000", status: "active" }],
    assets: [{ name: 'MacBook Pro 16"', code: "MBP-0067", assigned: "02/04/2020", condition: "fair" }],
    history: [{ event: "promotion", date: "01/06/2022", note: "Senior Designer → Design Team Leader" }, { event: "hired", date: "01/04/2020", note: "Gia nhập Soosky" }] },
  { code: "EMP-0102", first: "Văn Sơn", last: "Hoàng", initials: "VS", dept: "QA Team", position: "QA Engineer", manager: "Hoàng Văn Sơn", type: "full_time", status: "on_leave", hireDate: "20/09/2022", zone: "zone2",
    email: "son.hoang@soosky.co", personalEmail: "hoangvson@gmail.com", phone: "+84 907 666 333", dob: "27/12/1995", gender: "male", marital: "single", nationality: "VN", address: "45 Nguyễn Huệ, Đà Nẵng",
    contacts: [{ name: "Hoàng Thị Lan", rel: "parent", phone: "+84 908 444 555", primary: true }],
    documents: [{ type: "id_card", num: "048095001234", issued: "15/08/2019", expiry: "15/08/2034", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2022-0102", type: "fixed_term", start: "20/09/2022", end: "20/09/2025", base: "18,000,000", status: "active" }],
    assets: [{ name: "Dell Latitude 5430", code: "DL-0102", assigned: "21/09/2022", condition: "good" }],
    history: [{ event: "contract_renew", date: "20/09/2024", note: "Gia hạn hợp đồng 1 năm" }, { event: "hired", date: "20/09/2022", note: "Gia nhập Soosky" }] },
  { code: "EMP-0145", first: "Minh Châu", last: "Đào", initials: "MC", dept: "HR", position: "HR Team Leader", manager: "Lê Minh Quân (CEO)", type: "full_time", status: "active", hireDate: "11/11/2021", zone: "zone1",
    email: "chau.dao@soosky.co", personalEmail: "daominhchau@gmail.com", phone: "+84 909 121 343", dob: "08/02/1990", gender: "female", marital: "married", nationality: "VN", address: "7 Hai Bà Trưng, TP.HCM",
    contacts: [{ name: "Đào Văn Phúc", rel: "spouse", phone: "+84 910 565 787", primary: true }],
    documents: [{ type: "id_card", num: "079090007654", issued: "01/03/2016", expiry: "01/03/2031", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2021-0145", type: "indefinite", start: "11/11/2021", end: null, base: "44,000,000", status: "active" }],
    assets: [{ name: "MacBook Air M2", code: "MBA-0145", assigned: "12/11/2021", condition: "good" }],
    history: [{ event: "promotion", date: "01/03/2023", note: "HR Executive → HR Team Leader" }, { event: "hired", date: "11/11/2021", note: "Gia nhập Soosky" }] },
  { code: "EMP-0207", first: "Thu Hà", last: "Phạm", initials: "TH", dept: "PO Team", position: "Product Owner", manager: "Nguyễn Lan Anh", type: "part_time", status: "active", hireDate: "03/01/2024", zone: "zone2",
    email: "ha.pham@soosky.co", personalEmail: "phamthuha@gmail.com", phone: "+84 911 989 676", dob: "30/06/1998", gender: "female", marital: "single", nationality: "VN", address: "19 Lý Thường Kiệt, Hải Phòng",
    contacts: [{ name: "Phạm Văn Đức", rel: "parent", phone: "+84 912 343 121", primary: true }],
    documents: [{ type: "id_card", num: "031098004567", issued: "22/07/2020", expiry: "22/07/2035", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2024-0207", type: "fixed_term", start: "03/01/2024", end: "03/01/2026", base: "12,000,000", status: "active" }],
    assets: [{ name: "Dell Latitude 3420", code: "DL-0207", assigned: "04/01/2024", condition: "new" }],
    history: [{ event: "hired", date: "03/01/2024", note: "Gia nhập Soosky" }] },
  { code: "EMP-0249", first: "Đức Thiện", last: "Trần", initials: "DT", dept: "App Team", position: "Application Developer", manager: "Bùi Trọng Hải", type: "full_time", status: "onboarding", hireDate: "01/06/2026", zone: "zone1",
    email: "thien.tran@soosky.co", personalEmail: "tranducthien@gmail.com", phone: "+84 913 454 676", dob: "12/09/1999", gender: "male", marital: "single", nationality: "VN", address: "3 Phạm Văn Đồng, Hà Nội",
    contacts: [{ name: "Trần Thị Hoa", rel: "parent", phone: "+84 914 787 909", primary: true }],
    documents: [{ type: "id_card", num: "001099009876", issued: "05/09/2021", expiry: "05/09/2036", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2026-0249", type: "probation", start: "01/06/2026", end: "01/08/2026", base: "22,000,000", status: "active" }],
    assets: [],
    history: [{ event: "hired", date: "01/06/2026", note: "Bắt đầu onboarding" }] },
  { code: "EMP-0073", first: "Đức Bình", last: "Trần", initials: "DB", dept: "BE Team", position: "BE Team Leader", manager: "Lê Minh Quân (CEO)", type: "full_time", status: "active", hireDate: "05/05/2019", zone: "zone1",
    email: "binh.tran@soosky.co", personalEmail: "tranducbinh@gmail.com", phone: "+84 915 111 222", dob: "21/03/1985", gender: "male", marital: "married", nationality: "VN", address: "56 Điện Biên Phủ, TP.HCM",
    contacts: [{ name: "Trần Thị Hằng", rel: "spouse", phone: "+84 916 333 444", primary: true }],
    documents: [{ type: "id_card", num: "079085001122", issued: "08/04/2015", expiry: "08/04/2030", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2019-0073", type: "indefinite", start: "05/05/2019", end: null, base: "68,000,000", status: "active" }],
    assets: [{ name: 'MacBook Pro 14"', code: "MBP-0073", assigned: "06/05/2019", condition: "fair" }],
    history: [{ event: "promotion", date: "01/01/2022", note: "Senior Backend → BE Team Leader" }, { event: "hired", date: "05/05/2019", note: "Gia nhập Soosky" }] },
  { code: "EMP-0024", first: "Lan Anh", last: "Nguyễn", initials: "LA", dept: "PO Team", position: "PO Team Leader", manager: "Lê Minh Quân (CEO)", type: "full_time", status: "active", hireDate: "18/02/2020", zone: "zone1",
    email: "anh.nguyen@soosky.co", personalEmail: "nguyenlananh@gmail.com", phone: "+84 917 555 666", dob: "05/07/1989", gender: "female", marital: "married", nationality: "VN", address: "9 Bà Triệu, Hà Nội",
    contacts: [{ name: "Nguyễn Văn Khoa", rel: "spouse", phone: "+84 918 777 888", primary: true }],
    documents: [{ type: "id_card", num: "001089003344", issued: "19/01/2016", expiry: "19/01/2031", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2020-0024", type: "indefinite", start: "18/02/2020", end: null, base: "46,000,000", status: "active" }],
    assets: [{ name: "MacBook Air M2", code: "MBA-0024", assigned: "19/02/2020", condition: "good" }],
    history: [{ event: "promotion", date: "01/05/2021", note: "Product Owner → PO Team Leader" }, { event: "hired", date: "18/02/2020", note: "Gia nhập Soosky" }] },
  { code: "EMP-0156", first: "Khánh Duy", last: "Lê", initials: "KD", dept: "BE Team", position: "Backend Engineer", manager: "Trần Đức Bình", type: "contract", status: "terminated", hireDate: "10/10/2021", zone: "zone2",
    email: "duy.le@soosky.co", personalEmail: "lekhanhduy@gmail.com", phone: "+84 919 222 333", dob: "15/04/1994", gender: "male", marital: "single", nationality: "VN", address: "21 Lê Duẩn, TP.HCM",
    contacts: [{ name: "Lê Thị Thu", rel: "parent", phone: "+84 920 444 555", primary: true }],
    documents: [{ type: "id_card", num: "079094006677", issued: "11/09/2018", expiry: "11/09/2033", by: "Cục CS QLHC" }],
    contracts: [{ no: "HD-2021-0156", type: "fixed_term", start: "10/10/2021", end: "10/10/2024", base: "20,000,000", status: "terminated" }],
    assets: [],
    history: [{ event: "terminated", date: "10/10/2024", note: "Kết thúc hợp đồng" }, { event: "hired", date: "10/10/2021", note: "Gia nhập Soosky" }] },
];

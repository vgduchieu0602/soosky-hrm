import { Fragment, useEffect, useRef, useState } from "react";
import { X, Check, ChevronLeft, ChevronRight, UserPlus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import { toEmployeeView } from "@features/employee/constants";
import { organizationService } from "@features/organization/services/organization.service";
import type {
  CreateEmployeeInput, EmployeeType, Gender, MaritalStatus, SalaryZone,
} from "@features/employee/types/employee.types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface DeptOption { id: string; name: string }
interface PosOption { id: string; title: string; departmentId: string }
interface MgrOption { id: string; name: string }

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email: string; // personal
  workEmail: string; // company
  nationality: string;
  maritalStatus: MaritalStatus;
  address: string;
  socialInsuranceNo: string;
  taxCode: string;
  vehiclePlate: string;
  employeeCode: string;
  fingerprintId: string;
  departmentId: string;
  positionId: string;
  managerId: string;
  employeeType: EmployeeType;
  hireDate: string;
  salaryZone: SalaryZone;
  grantAccount: boolean;
  sendInvite: boolean;
}

const INITIAL: FormState = {
  firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "male", phone: "", email: "", workEmail: "",
  nationality: "VN", maritalStatus: "single", address: "",
  socialInsuranceNo: "", taxCode: "", vehiclePlate: "",
  employeeCode: "", fingerprintId: "", departmentId: "", positionId: "", managerId: "",
  employeeType: "full_time", hireDate: "", salaryZone: "zone1",
  grantAccount: false, sendInvite: true,
};

const STEPS = ["Thông tin cá nhân", "Công việc & hợp đồng", "Tài khoản hệ thống"];

export function CreateEmployeeModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [depts, setDepts] = useState<DeptOption[]>([]);
  const [positions, setPositions] = useState<PosOption[]>([]);
  const [managers, setManagers] = useState<MgrOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Holds the id once the employee record exists, so a retry (e.g. after a
  // failed grant-login) only re-runs the account step instead of creating a
  // duplicate employee.
  const createdIdRef = useRef<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Load lookups once when the modal opens.
  useEffect(() => {
    let cancelled = false;
    organizationService
      .departmentsFlat()
      .then((nodes) => {
        if (!cancelled) setDepts(nodes.map((n) => ({ id: n.id, name: n.name })));
      })
      .catch(() => { if (!cancelled) setDepts([]); });
    organizationService
      .positions()
      .then((rows) => {
        if (!cancelled)
          setPositions(rows.map((p) => ({ id: p._id, title: p.title, departmentId: p.departmentId })));
      })
      .catch(() => { if (!cancelled) setPositions([]); });
    employeeService
      .list({ limit: 100, status: "active" })
      .then(({ items }) => {
        if (!cancelled)
          setManagers(items.map((r) => { const v = toEmployeeView(r); return { id: v.id, name: v.fullName }; }));
      })
      .catch(() => { if (!cancelled) setManagers([]); });
    return () => { cancelled = true; };
  }, []);

  const posForDept = form.departmentId
    ? positions.filter((p) => p.departmentId === form.departmentId)
    : positions;

  const step1Valid = form.firstName.trim() && form.lastName.trim();
  const step2Valid =
    form.employeeCode.trim().length >= 3 && form.departmentId && form.positionId && form.hireDate;

  function submit() {
    setSubmitting(true);
    setError(null);
    const payload: CreateEmployeeInput = {
      employeeCode: form.employeeCode.trim(),
      fingerprintId: form.fingerprintId.trim() || undefined,
      departmentId: form.departmentId,
      positionId: form.positionId,
      managerId: form.managerId || undefined,
      hireDate: form.hireDate,
      employeeType: form.employeeType,
      salaryZone: form.salaryZone,
      profile: {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender,
        nationality: form.nationality.trim() || undefined,
        maritalStatus: form.maritalStatus,
        email: form.email.trim() || undefined,
        workEmail: form.workEmail.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        socialInsuranceNo: form.socialInsuranceNo.trim() || undefined,
        taxCode: form.taxCode.trim() || undefined,
        vehiclePlate: form.vehiclePlate.trim() || undefined,
      },
    };

    const wantsAccount = form.grantAccount && !!form.email.trim();

    // Reuse the already-created employee on retry so we never duplicate it.
    const ensureEmployee = createdIdRef.current
      ? Promise.resolve(createdIdRef.current)
      : employeeService.create(payload).then((created) => {
          createdIdRef.current = created._id;
          return created._id;
        });

    ensureEmployee
      .then((id) => {
        if (!wantsAccount) return undefined;
        // The account step is separate from creation: this is what provisions
        // the login and sends the credentials email. Its failure must surface
        // (e.g. duplicate email, SMTP/Gmail rejected) — not be swallowed.
        return employeeService.grantLogin(id, { sendEmail: form.sendInvite }).then(() => undefined);
      })
      .then(() => { onCreated(); })
      .catch((e) => {
        const msg = e?.response?.data?.error?.message;
        if (createdIdRef.current) {
          // Employee saved, but provisioning/email failed.
          setError(
            msg
              ? `Đã tạo hồ sơ nhân viên, nhưng cấp tài khoản/gửi thư thất bại: ${msg}. Bấm “Tạo nhân viên” để thử lại bước cấp tài khoản, hoặc cấp lại sau ở tab “Tài khoản”.`
              : "Đã tạo hồ sơ nhân viên, nhưng cấp tài khoản/gửi thư thất bại. Thử lại hoặc cấp tài khoản sau ở tab “Tài khoản”.",
          );
        } else {
          setError(msg ?? "Không thể tạo nhân viên. Kiểm tra lại thông tin.");
        }
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]" style={{ animation: "fadeIn .2s ease" }} />
      <div className="relative flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-background shadow-2xl" style={{ animation: "fadeIn .2s ease" }}>
        {/* header */}
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <button type="button" onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
          <h2 className="text-[20px] font-bold tracking-tight">Tạo nhân viên mới</h2>
          <p className="mt-1 text-[13px] text-white/70">Điền thông tin để khởi tạo hồ sơ nhân sự mới.</p>
          <div className="mt-4 flex items-center gap-2">
            {STEPS.map((label, i) => {
              const n = i + 1, active = step === n, done = step > n;
              return (
                <Fragment key={n}>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold transition",
                      done ? "bg-emerald-400 text-white" : active ? "bg-white text-secondary-800" : "bg-white/10 text-white/60")}>
                      {done ? <Check className="size-3.5" strokeWidth={2.8} /> : n}
                    </span>
                    <span className={cn("text-[12px] font-medium", active ? "text-white" : "text-white/55")}>{label}</span>
                  </div>
                  {n < STEPS.length && <span className="h-px flex-1 bg-white/15" />}
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && <Step1 form={form} set={set} />}
          {step === 2 && (
            <Step2 form={form} set={set} depts={depts} positions={posForDept} managers={managers} />
          )}
          {step === 3 && <Step3 form={form} set={set} />}
          {error && <p className="mt-4 text-[12.5px] text-destructive">{error}</p>}
        </div>

        {/* footer */}
        <div className="flex shrink-0 items-center justify-between border-t bg-card px-6 py-4">
          <span className="text-[12px] text-muted-foreground">Bước {step}/{STEPS.length}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl">Huỷ</Button>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-1.5 rounded-xl">
                <ChevronLeft className="size-4" strokeWidth={2} /> Quay lại
              </Button>
            )}
            {step < STEPS.length && (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                className="gap-1.5 rounded-xl"
              >
                Tiếp tục <ChevronRight className="size-4" strokeWidth={2} />
              </Button>
            )}
            {step === STEPS.length && (
              <Button onClick={submit} disabled={submitting || !step2Valid} className="gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600">
                <Check className="size-4" strokeWidth={2.4} /> {submitting ? "Đang tạo…" : "Tạo nhân viên"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label, children, required, span,
}: { label: string; children: React.ReactNode; required?: boolean; span?: "full" }) {
  return (
    <div className={cn(span === "full" && "col-span-2")}>
      <label className="text-[12px] font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

type SetFn = <K extends keyof FormState>(k: K, v: FormState[K]) => void;

function Step1({ form, set }: { form: FormState; set: SetFn }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Họ" required>
          <input className={inputCls} placeholder="Nguyễn" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </FormField>
        <FormField label="Tên đệm">
          <input className={inputCls} placeholder="Văn" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
        </FormField>
        <FormField label="Tên" required>
          <input className={inputCls} placeholder="An" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Ngày sinh">
          <DateField className={inputCls} value={form.dateOfBirth} onChange={(iso) => set("dateOfBirth", iso)} />
        </FormField>
        <FormField label="Giới tính">
          <select className={inputCls} value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
            <option value="male">Nam</option><option value="female">Nữ</option>
            <option value="other">Khác</option><option value="undisclosed">Không tiết lộ</option>
          </select>
        </FormField>
        <FormField label="Số điện thoại">
          <input className={inputCls} placeholder="+84 9xx xxx xxx" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </FormField>
        <FormField label="Email cá nhân">
          <input className={inputCls} placeholder="name@gmail.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </FormField>
        <FormField label="Email công ty">
          <input className={inputCls} placeholder="name@soosky.co" value={form.workEmail} onChange={(e) => set("workEmail", e.target.value)} />
        </FormField>
        <FormField label="Quốc tịch">
          <input className={inputCls} value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
        </FormField>
        <FormField label="Tình trạng hôn nhân">
          <select className={inputCls} value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value as MaritalStatus)}>
            <option value="single">Độc thân</option><option value="married">Đã kết hôn</option>
            <option value="divorced">Ly hôn</option><option value="widowed">Goá</option>
          </select>
        </FormField>
        <FormField label="Địa chỉ thường trú" span="full">
          <input className={inputCls} placeholder="Số nhà, đường, phường, quận, tỉnh/thành" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </FormField>
        <FormField label="Số sổ BHXH">
          <input className={inputCls} placeholder="VD: 0123456789" value={form.socialInsuranceNo} onChange={(e) => set("socialInsuranceNo", e.target.value)} />
        </FormField>
        <FormField label="Mã số thuế">
          <input className={inputCls} placeholder="VD: 8012345678" value={form.taxCode} onChange={(e) => set("taxCode", e.target.value)} />
        </FormField>
        <FormField label="Biển số xe">
          <input className={inputCls} placeholder="VD: 30K-123.45" value={form.vehiclePlate} onChange={(e) => set("vehiclePlate", e.target.value)} />
        </FormField>
      </div>
    </div>
  );
}

function Step2({
  form, set, depts, positions, managers,
}: {
  form: FormState; set: SetFn;
  depts: DeptOption[]; positions: PosOption[]; managers: MgrOption[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField label="Mã nhân viên" required>
        <input className={cn(inputCls, "font-mono")} placeholder="EMP-0250" value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} />
      </FormField>
      <FormField label="Mã vân tay">
        <input className={cn(inputCls, "font-mono")} placeholder="VT-0250" value={form.fingerprintId} onChange={(e) => set("fingerprintId", e.target.value)} />
      </FormField>
      <FormField label="Phòng ban" required>
        <select className={inputCls} value={form.departmentId} onChange={(e) => { set("departmentId", e.target.value); set("positionId", ""); }}>
          <option value="">— Chọn phòng ban —</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </FormField>
      <FormField label="Chức vụ" required>
        <select className={inputCls} value={form.positionId} onChange={(e) => set("positionId", e.target.value)} disabled={!form.departmentId}>
          <option value="">— Chọn chức vụ —</option>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </FormField>
      <FormField label="Quản lý trực tiếp">
        <select className={inputCls} value={form.managerId} onChange={(e) => set("managerId", e.target.value)}>
          <option value="">— Không —</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </FormField>
      <FormField label="Loại hợp đồng" required>
        <select className={inputCls} value={form.employeeType} onChange={(e) => set("employeeType", e.target.value as EmployeeType)}>
          <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
          <option value="contract">Hợp đồng</option><option value="intern">Thực tập</option>
        </select>
      </FormField>
      <FormField label="Ngày vào làm" required>
        <DateField className={inputCls} value={form.hireDate} onChange={(iso) => set("hireDate", iso)} />
      </FormField>
      <FormField label="Vùng lương">
        <select className={inputCls} value={form.salaryZone} onChange={(e) => set("salaryZone", e.target.value as SalaryZone)}>
          <option value="zone1">Vùng 1</option><option value="zone2">Vùng 2</option>
          <option value="zone3">Vùng 3</option><option value="zone4">Vùng 4</option>
        </select>
      </FormField>
    </div>
  );
}

function Step3({ form, set }: { form: FormState; set: SetFn }) {
  return (
    <div className="flex flex-col gap-5">
      <label className={cn("flex items-start gap-3 rounded-xl border p-4 transition", form.grantAccount && "border-primary-500 bg-primary-50/40")}>
        <input type="checkbox" checked={form.grantAccount} onChange={(e) => set("grantAccount", e.target.checked)} className="mt-1 size-4 accent-primary-500" />
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-foreground">Cấp tài khoản đăng nhập ngay</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Sau khi tạo hồ sơ, hệ thống sẽ cấp tài khoản dùng email cá nhân và gửi liên kết để nhân viên tự thiết lập mật khẩu.
            {!form.email && " (Cần nhập email cá nhân ở bước 1)"}
          </p>
        </div>
      </label>
      {form.grantAccount && (
        <label className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3 text-[13px]">
          <input type="checkbox" checked={form.sendInvite} onChange={(e) => set("sendInvite", e.target.checked)} className="size-4 accent-primary-500" />
          <span className="flex-1 text-foreground">Gửi email lời mời kích hoạt tới nhân viên</span>
          <Mail className="size-4 text-muted-foreground" />
        </label>
      )}
      {!form.grantAccount && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-[12.5px] text-muted-foreground">
          <UserPlus className="size-5 shrink-0" strokeWidth={1.7} />
          Bạn có thể cấp tài khoản sau ở tab “Tài khoản” trong hồ sơ nhân viên.
        </div>
      )}
    </div>
  );
}

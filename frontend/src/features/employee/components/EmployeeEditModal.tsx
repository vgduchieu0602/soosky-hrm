import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import { organizationService } from "@features/organization/services/organization.service";
import { attendanceService } from "@features/attendance/services/attendance.service";
import { toEmployeeView } from "@features/employee/constants";
import {
  editEmployeeSchema,
  type EditEmployeeForm,
} from "@features/employee/schemas/employee.schema";
import type { EmployeeProfile, EmployeeView } from "@features/employee/types/employee.types";

interface Props {
  view: EmployeeView;
  profile: EmployeeProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

interface DeptOption { id: string; name: string }
interface PosOption { id: string; title: string; departmentId: string }
interface MgrOption { id: string; name: string }

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

export function EmployeeEditModal({ view, profile, onClose, onSaved }: Props) {
  const [depts, setDepts] = useState<DeptOption[]>([]);
  const [positions, setPositions] = useState<PosOption[]>([]);
  const [managers, setManagers] = useState<MgrOption[]>([]);
  const [shifts, setShifts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, watch, setValue, formState: { errors, isSubmitting },
  } = useForm<EditEmployeeForm>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      firstName: profile?.firstName ?? view.firstName ?? "",
      middleName: profile?.middleName ?? view.middleName ?? "",
      lastName: profile?.lastName ?? view.lastName ?? "",
      dateOfBirth: (profile?.dateOfBirth ?? view.dateOfBirth ?? "").slice(0, 10),
      gender: (profile?.gender ?? view.gender ?? "undisclosed") as EditEmployeeForm["gender"],
      maritalStatus: (profile?.maritalStatus ?? view.maritalStatus ?? "single") as EditEmployeeForm["maritalStatus"],
      nationality: profile?.nationality ?? view.nationality ?? "VN",
      phone: profile?.phone ?? view.phone ?? "",
      email: profile?.email ?? view.personalEmail ?? "",
      workEmail: profile?.workEmail ?? view.email ?? "",
      address: profile?.address ?? view.address ?? "",
      socialInsuranceNo: profile?.socialInsuranceNo ?? "",
      taxCode: profile?.taxCode ?? "",
      vehiclePlate: profile?.vehiclePlate ?? "",
      employeeCode: view.code ?? "",
      fingerprintId: view.fingerprintId ?? "",
      departmentId: view.departmentId ?? "",
      positionId: view.positionId ?? "",
      managerId: view.managerId ?? "",
      shiftId: view.shiftId ?? "",
      employeeType: view.employeeType,
      salaryZone: (view.salaryZone || "zone1") as EditEmployeeForm["salaryZone"],
    },
  });

  const departmentId = watch("departmentId");

  useEffect(() => {
    let cancelled = false;
    organizationService.departmentsFlat()
      .then((nodes) => { if (!cancelled) setDepts(nodes.map((n) => ({ id: n.id, name: n.name }))); })
      .catch(() => { if (!cancelled) setDepts([]); });
    organizationService.positions()
      .then((rows) => { if (!cancelled) setPositions(rows.map((p) => ({ id: p._id, title: p.title, departmentId: p.departmentId }))); })
      .catch(() => { if (!cancelled) setPositions([]); });
    employeeService.list({ limit: 100, status: "active" })
      .then(({ items }) => { if (!cancelled) setManagers(items.map((r) => { const v = toEmployeeView(r); return { id: v.id, name: v.fullName }; })); })
      .catch(() => { if (!cancelled) setManagers([]); });
    attendanceService.shifts()
      .then((rows) => { if (!cancelled) setShifts(rows.filter((s) => s.status !== "archived").map((s) => ({ id: s._id, name: s.name }))); })
      .catch(() => { if (!cancelled) setShifts([]); });
    return () => { cancelled = true; };
  }, []);

  const posForDept = departmentId
    ? positions.filter((p) => p.departmentId === departmentId)
    : positions;

  async function onSubmit(form: EditEmployeeForm) {
    setError(null);
    try {
      await employeeService.updateProfile(view.id, {
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender,
        maritalStatus: form.maritalStatus,
        nationality: form.nationality,
        phone: form.phone || undefined,
        email: form.email || undefined,
        workEmail: form.workEmail || undefined,
        address: form.address || undefined,
        socialInsuranceNo: form.socialInsuranceNo || undefined,
        taxCode: form.taxCode || undefined,
        vehiclePlate: form.vehiclePlate || undefined,
      });
      await employeeService.update(view.id, {
        employeeCode: form.employeeCode.trim(),
        fingerprintId: form.fingerprintId.trim() || null,
        departmentId: form.departmentId,
        positionId: form.positionId,
        managerId: form.managerId || null,
        shiftId: form.shiftId || null,
        employeeType: form.employeeType,
        salaryZone: form.salaryZone,
      });
      onSaved();
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setError(err?.response?.data?.error?.message ?? "Không thể lưu thay đổi. Kiểm tra lại thông tin.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]" style={{ animation: "fadeIn .2s ease" }} onClick={onClose} />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
        style={{ animation: "fadeIn .2s ease" }}
      >
        <div className="relative shrink-0 px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <button type="button" onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
          <h2 className="text-[20px] font-bold tracking-tight">Chỉnh sửa nhân viên</h2>
          <p className="mt-1 text-[13px] text-white/70">{view.fullName} · <span className="font-mono">{view.code}</span></p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Thông tin cá nhân</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Họ" error={errors.lastName?.message}>
              <input className={inputCls} {...register("lastName")} />
            </Field>
            <Field label="Tên đệm" error={errors.middleName?.message}>
              <input className={inputCls} {...register("middleName")} />
            </Field>
            <Field label="Tên" error={errors.firstName?.message}>
              <input className={inputCls} {...register("firstName")} />
            </Field>
            <Field label="Ngày sinh">
              <DateField
                className={inputCls}
                value={watch("dateOfBirth")}
                onChange={(iso) => setValue("dateOfBirth", iso, { shouldValidate: true })}
              />
            </Field>
            <Field label="Giới tính">
              <select className={inputCls} {...register("gender")}>
                <option value="male">Nam</option><option value="female">Nữ</option>
                <option value="other">Khác</option><option value="undisclosed">Không tiết lộ</option>
              </select>
            </Field>
            <Field label="Số điện thoại" error={errors.phone?.message}>
              <input className={inputCls} {...register("phone")} />
            </Field>
            <Field label="Quốc tịch" error={errors.nationality?.message}>
              <input className={inputCls} {...register("nationality")} />
            </Field>
            <Field label="Email cá nhân" error={errors.email?.message}>
              <input className={inputCls} {...register("email")} />
            </Field>
            <Field label="Email công ty" error={errors.workEmail?.message}>
              <input className={inputCls} {...register("workEmail")} />
            </Field>
            <Field label="Tình trạng hôn nhân">
              <select className={inputCls} {...register("maritalStatus")}>
                <option value="single">Độc thân</option><option value="married">Đã kết hôn</option>
                <option value="divorced">Ly hôn</option><option value="widowed">Goá</option>
              </select>
            </Field>
            <Field label="Địa chỉ" span>
              <input className={inputCls} {...register("address")} />
            </Field>
            <Field label="Số sổ BHXH" error={errors.socialInsuranceNo?.message}>
              <input className={inputCls} {...register("socialInsuranceNo")} />
            </Field>
            <Field label="Mã số thuế" error={errors.taxCode?.message}>
              <input className={inputCls} {...register("taxCode")} />
            </Field>
            <Field label="Biển số xe" error={errors.vehiclePlate?.message}>
              <input className={inputCls} {...register("vehiclePlate")} />
            </Field>
          </div>

          <div className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Thông tin công việc</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mã nhân viên" error={errors.employeeCode?.message}>
              <input className={cn(inputCls, "font-mono")} {...register("employeeCode")} />
            </Field>
            <Field label="Mã vân tay" error={errors.fingerprintId?.message}>
              <input className={cn(inputCls, "font-mono")} {...register("fingerprintId")} placeholder="Không bắt buộc" />
            </Field>
            <Field label="Phòng ban" error={errors.departmentId?.message}>
              <select
                className={inputCls}
                value={departmentId}
                onChange={(e) => { setValue("departmentId", e.target.value, { shouldValidate: true }); setValue("positionId", ""); }}
              >
                <option value="">— Chọn phòng ban —</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Chức vụ" error={errors.positionId?.message}>
              <select className={inputCls} {...register("positionId")} disabled={!departmentId}>
                <option value="">— Chọn chức vụ —</option>
                {posForDept.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Quản lý trực tiếp">
              <select className={inputCls} {...register("managerId")}>
                <option value="">— Không —</option>
                {managers.filter((m) => m.id !== view.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Loại hợp đồng">
              <select className={inputCls} {...register("employeeType")}>
                <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
                <option value="contract">Hợp đồng</option><option value="intern">Thực tập</option>
              </select>
            </Field>
            <Field label="Vùng lương">
              <select className={inputCls} {...register("salaryZone")}>
                <option value="zone1">Vùng 1</option><option value="zone2">Vùng 2</option>
                <option value="zone3">Vùng 3</option><option value="zone4">Vùng 4</option>
              </select>
            </Field>
            <Field label="Ca làm việc">
              <select className={inputCls} {...register("shiftId")}>
                <option value="">— Theo lịch chung (T2–T6) —</option>
                {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          {error && <p className="mt-4 text-[12.5px] text-destructive">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-card px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Huỷ</Button>
          <Button type="submit" disabled={isSubmitting} className="gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600">
            <Check className="size-4" strokeWidth={2.4} /> {isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label, children, error, span,
}: { label: string; children: React.ReactNode; error?: string; span?: boolean }) {
  return (
    <div className={cn(span && "col-span-2")}>
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-[11.5px] text-destructive">{error}</p>}
    </div>
  );
}

import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import type { EmployeeFormValues } from "@features/employee/schemas/employee.schema";

export interface DeptOption { id: string; name: string; code: string }
export interface PosOption { id: string; title: string; departmentId: string; code: string }
export interface MgrOption { id: string; name: string; code: string }

export interface EmployeeLookups {
  departments: DeptOption[];
  positions: PosOption[];
  managers: MgrOption[];
  shifts: { id: string; name: string }[];
}

interface Props {
  register: UseFormRegister<EmployeeFormValues>;
  errors: FieldErrors<EmployeeFormValues>;
  watch: UseFormWatch<EmployeeFormValues>;
  setValue: UseFormSetValue<EmployeeFormValues>;
  lookups: EmployeeLookups;
  /**
   * `edit` = sửa nhân viên đã có (ngày vào làm đổi qua luồng vòng đời).
   * `import-preview` = sửa một dòng CSV trước khi lưu, nên cần cả ngày vào làm.
   */
  mode: "edit" | "import-preview";
  /** Loại chính nhân viên khỏi danh sách quản lý (tránh tự quản lý mình). */
  excludeManagerId?: string;
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

/**
 * Toàn bộ ô nhập của một nhân viên, dùng CHUNG cho màn hình chỉnh sửa và màn hình
 * sửa dòng import — nhờ vậy hai nơi không trôi lệch nhau về nhãn, thứ tự và luật
 * kiểm tra (`employeeFormSchema`).
 */
export function EmployeeFormFields({
  register, errors, watch, setValue, lookups, mode, excludeManagerId,
}: Props) {
  const departmentId = watch("departmentId");
  const positionsForDepartment = departmentId
    ? lookups.positions.filter((p) => p.departmentId === departmentId)
    : lookups.positions;

  return (
    <>
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        Thông tin cá nhân
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Họ *" error={errors.lastName?.message}>
          <input className={inputCls} {...register("lastName")} />
        </Field>
        <Field label="Tên đệm" error={errors.middleName?.message}>
          <input className={inputCls} {...register("middleName")} />
        </Field>
        <Field label="Tên *" error={errors.firstName?.message}>
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

      <div className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        Thông tin công việc
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Mã nhân viên *" error={errors.employeeCode?.message}>
          <input className={cn(inputCls, "font-mono")} {...register("employeeCode")} />
        </Field>
        <Field label="Mã vân tay" error={errors.fingerprintId?.message}>
          <input className={cn(inputCls, "font-mono")} {...register("fingerprintId")} placeholder="Không bắt buộc" />
        </Field>
        <Field label="Phòng ban *" error={errors.departmentId?.message}>
          <select
            className={inputCls}
            value={departmentId}
            onChange={(e) => {
              setValue("departmentId", e.target.value, { shouldValidate: true });
              setValue("positionId", "");
            }}
          >
            <option value="">— Chọn phòng ban —</option>
            {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        {/*
          Chức vụ và Quản lý phải là ô ĐIỀU KHIỂN (value từ trạng thái biểu mẫu).
          Danh mục nạp xong sau khi biểu mẫu mở, nếu để `<select>` tự do thì lựa
          chọn đã điền sẵn sẽ bị trình duyệt đặt lại về mục rỗng khi options tới.
        */}
        <Field label="Chức vụ *" error={errors.positionId?.message}>
          <select
            className={inputCls}
            value={watch("positionId")}
            onChange={(e) => setValue("positionId", e.target.value, { shouldValidate: true })}
            disabled={!departmentId}
          >
            <option value="">— Chọn chức vụ —</option>
            {positionsForDepartment.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="Quản lý trực tiếp">
          <select
            className={inputCls}
            value={watch("managerId")}
            onChange={(e) => setValue("managerId", e.target.value, { shouldValidate: true })}
          >
            <option value="">— Không —</option>
            {lookups.managers
              .filter((m) => m.id !== excludeManagerId)
              .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        {mode === "import-preview" && (
          <Field label="Ngày vào làm *" error={errors.hireDate?.message}>
            <DateField
              className={inputCls}
              value={watch("hireDate")}
              onChange={(iso) => setValue("hireDate", iso, { shouldValidate: true })}
            />
          </Field>
        )}
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
        {mode === "edit" && (
          <Field label="Ca làm việc">
            <select className={inputCls} {...register("shiftId")}>
              <option value="">— Theo lịch chung (T2–T6) —</option>
              {lookups.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
      </div>
    </>
  );
}

export function Field({
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

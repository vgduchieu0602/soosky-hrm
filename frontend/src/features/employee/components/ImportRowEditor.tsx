import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@shared/components/FormModal";
import { EmployeeFormFields } from "@features/employee/components/EmployeeFormFields";
import { useEmployeeLookups } from "@features/employee/hooks/useEmployeeLookups";
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from "@features/employee/schemas/employee.schema";
import type { ImportEmployeeRow, ImportRowPreview } from "@features/employee/types/employee.types";

interface Props {
  row: ImportRowPreview;
  onCancel: () => void;
  /** Trả về dòng CSV đã sửa (vẫn là dữ liệu CSV, không phải payload API). */
  onApply: (updated: ImportEmployeeRow) => void;
}

/**
 * Sửa một dòng import bằng CHÍNH biểu mẫu nhân viên (`EmployeeFormFields` +
 * `employeeFormSchema`), không dựng biểu mẫu thứ hai.
 *
 * Dữ liệu CSV đã được backend chuẩn hoá và tra tham chiếu, nên ô Phòng ban /
 * Chức vụ / Quản lý hiển thị sẵn đúng bản ghi (`resolved.*Id`) thay vì bắt HR
 * chọn lại từ đầu. Khi lưu, các lựa chọn được đổi ngược về MÃ để dòng CSV vẫn là
 * dữ liệu CSV.
 */
export function ImportRowEditor({ row, onCancel, onApply }: Props) {
  const lookups = useEmployeeLookups();
  const data = row.normalized;

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      lastName: data.last_name ?? "",
      middleName: data.middle_name ?? "",
      firstName: data.first_name ?? "",
      dateOfBirth: data.date_of_birth ?? "",
      gender: (data.gender ?? "undisclosed") as EmployeeFormValues["gender"],
      maritalStatus: (data.marital_status ?? "single") as EmployeeFormValues["maritalStatus"],
      nationality: data.nationality ?? "VN",
      phone: data.phone ?? "",
      email: data.personal_email ?? "",
      workEmail: data.work_email ?? "",
      address: data.address ?? "",
      socialInsuranceNo: data.social_insurance_no ?? "",
      taxCode: data.tax_code ?? "",
      vehiclePlate: data.vehicle_plate ?? "",
      employeeCode: data.employee_code ?? "",
      fingerprintId: data.fingerprint_id ?? "",
      // Tham chiếu đã tra được → ô chọn hiện đúng "Engineering" ngay khi mở.
      departmentId: row.resolved.departmentId ?? "",
      positionId: row.resolved.positionId ?? "",
      managerId: row.resolved.managerId ?? "",
      shiftId: "",
      employeeType: (data.employment_type ?? "full_time") as EmployeeFormValues["employeeType"],
      salaryZone: (data.salary_zone ?? "zone1") as EmployeeFormValues["salaryZone"],
      hireDate: data.join_date ?? "",
    },
  });

  function apply(form: EmployeeFormValues) {
    const department = lookups.departments.find((d) => d.id === form.departmentId);
    const position = lookups.positions.find((p) => p.id === form.positionId);
    const manager = lookups.managers.find((m) => m.id === form.managerId);

    // Giữ nguyên các cột không thuộc biểu mẫu (hợp đồng, ngân hàng…).
    const updated: ImportEmployeeRow = { ...data };
    const put = (key: string, value: string | undefined) => {
      if (value && value.trim() !== "") updated[key] = value.trim();
      else delete updated[key];
    };

    put("employee_code", form.employeeCode);
    put("last_name", form.lastName);
    put("middle_name", form.middleName);
    put("first_name", form.firstName);
    put("date_of_birth", form.dateOfBirth);
    put("gender", form.gender);
    put("marital_status", form.maritalStatus);
    put("nationality", form.nationality);
    put("phone", form.phone);
    put("personal_email", form.email);
    put("work_email", form.workEmail);
    put("address", form.address);
    put("social_insurance_no", form.socialInsuranceNo);
    put("tax_code", form.taxCode);
    put("vehicle_plate", form.vehiclePlate);
    put("fingerprint_id", form.fingerprintId);
    put("employment_type", form.employeeType);
    put("salary_zone", form.salaryZone);
    put("join_date", form.hireDate);

    // Chọn theo id trên giao diện, nhưng CSV chỉ nói chuyện bằng MÃ.
    put("department_code", department?.code);
    put("position_code", position?.code);
    put("manager_employee_code", manager?.code);
    // Tên chỉ là đường lùi khi thiếu mã — đã chọn tường minh thì bỏ đi cho gọn.
    delete updated.department_name;
    delete updated.position_name;
    delete updated.manager_email;

    onApply(updated);
  }

  return (
    <FormModal
      open
      onClose={onCancel}
      title={`Sửa dòng ${row.rowNumber}`}
      subtitle="Dữ liệu lấy từ tệp CSV, đã tự điền sẵn. Sửa xong bấm Áp dụng rồi kiểm tra lại."
      maxWidth={680}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={handleSubmit(apply)}
            className="gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600"
          >
            <Check className="size-4" strokeWidth={2.4} /> Áp dụng vào bản xem trước
          </Button>
        </>
      }
    >
      {row.errors.length > 0 && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
          {row.errors.map((e) => (
            <div key={`${e.field}-${e.message}`}>• {e.message}</div>
          ))}
        </div>
      )}
      <EmployeeFormFields
        register={register}
        errors={errors}
        watch={watch}
        setValue={setValue}
        lookups={lookups}
        mode="import-preview"
      />
    </FormModal>
  );
}

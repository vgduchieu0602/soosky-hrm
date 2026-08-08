import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { employeeService } from "@features/employee/services/employee.service";
import { EmployeeFormFields } from "@features/employee/components/EmployeeFormFields";
import { useEmployeeLookups } from "@features/employee/hooks/useEmployeeLookups";
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from "@features/employee/schemas/employee.schema";
import type { EmployeeProfile, EmployeeView } from "@features/employee/types/employee.types";

interface Props {
  view: EmployeeView;
  profile: EmployeeProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EmployeeEditModal({ view, profile, onClose, onSaved }: Props) {
  const lookups = useEmployeeLookups();
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, watch, setValue, formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: profile?.firstName ?? view.firstName ?? "",
      middleName: profile?.middleName ?? view.middleName ?? "",
      lastName: profile?.lastName ?? view.lastName ?? "",
      dateOfBirth: (profile?.dateOfBirth ?? view.dateOfBirth ?? "").slice(0, 10),
      gender: (profile?.gender ?? view.gender ?? "undisclosed") as EmployeeFormValues["gender"],
      maritalStatus: (profile?.maritalStatus ?? view.maritalStatus ?? "single") as EmployeeFormValues["maritalStatus"],
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
      salaryZone: (view.salaryZone || "zone1") as EmployeeFormValues["salaryZone"],
      hireDate: (view.hireDate ?? "").slice(0, 10),
    },
  });


  async function onSubmit(form: EmployeeFormValues) {
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
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
          <EmployeeFormFields
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            lookups={lookups}
            mode="edit"
            excludeManagerId={view.id}
          />
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


import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { FormModal } from "@shared/components/FormModal";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import { organizationService } from "@features/organization/services/organization.service";
import { toEmployeeView } from "@features/employee/constants";
import type { EmployeeContractRecord, EmployeeView } from "@features/employee/types/employee.types";

export type LifecycleAction =
  | "transfer"
  | "position"
  | "manager"
  | "probation-complete"
  | "probation-extend"
  | "salary"
  | "end"
  | "rehire";

interface Props {
  action: LifecycleAction;
  view: EmployeeView;
  contract: EmployeeContractRecord | null;
  onClose: () => void;
  onDone: () => void;
}

interface Option { id: string; label: string; departmentId?: string }

const TITLE: Record<LifecycleAction, string> = {
  transfer: "Điều chuyển phòng ban",
  position: "Đổi chức vụ",
  manager: "Đổi quản lý",
  "probation-complete": "Hoàn tất thử việc",
  "probation-extend": "Gia hạn thử việc",
  salary: "Thay đổi lương",
  end: "Kết thúc hợp tác",
  rehire: "Tái tuyển nhân viên",
};

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Một hộp thoại cho mọi thao tác vòng đời. Các thao tác chỉ khác nhau ở vài ô nhập
 * nhưng dùng chung khung: giá trị hiện tại → giá trị mới, ngày hiệu lực, lý do bắt
 * buộc. Gộp lại tránh tám hộp thoại gần trùng nhau lệch pha dần theo thời gian.
 */
export function LifecycleActionModal({ action, view, contract, onClose, onDone }: Props) {
  const [departments, setDepartments] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [managers, setManagers] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    departmentId: "",
    positionId: "",
    managerId: "",
    changeType: "position_change" as "position_change" | "promotion",
    effectiveDate: today(),
    newEndDate: contract?.endDate ? String(contract.endDate).slice(0, 10) : today(),
    baseSalary: "",
    contractNumber: "",
    separationType: "resignation" as "resignation" | "termination",
    noticeDate: "",
    lastWorkingDate: today(),
    note: "",
    reason: "",
    withContract: false,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const needsOrgOptions = action === "transfer" || action === "position" || action === "rehire";
  const needsManagers = action === "manager" || action === "transfer" || action === "rehire";

  useEffect(() => {
    let cancelled = false;
    if (needsOrgOptions) {
      organizationService.departmentsFlat()
        .then((nodes) => { if (!cancelled) setDepartments(nodes.map((n) => ({ id: n.id, label: n.name }))); })
        .catch(() => { if (!cancelled) setDepartments([]); });
      organizationService.positions()
        .then((rows) => {
          if (!cancelled) setPositions(rows.map((p) => ({ id: p._id, label: p.title, departmentId: p.departmentId })));
        })
        .catch(() => { if (!cancelled) setPositions([]); });
    }
    if (needsManagers) {
      employeeService.list({ limit: 200, status: "active" })
        .then(({ items }) => {
          if (cancelled) return;
          setManagers(
            items
              .map((r) => toEmployeeView(r))
              .filter((v) => v.id !== view.id)
              .map((v) => ({ id: v.id, label: `${v.fullName} · ${v.code}` })),
          );
        })
        .catch(() => { if (!cancelled) setManagers([]); });
    }
    return () => { cancelled = true; };
  }, [needsOrgOptions, needsManagers, view.id]);

  // Chọn phòng ban nào thì chỉ hiện chức vụ của phòng ban đó.
  const scopedPositions = form.departmentId
    ? positions.filter((p) => p.departmentId === form.departmentId)
    : positions;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await run();
      onDone();
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setError(err?.response?.data?.error?.message ?? "Không thực hiện được thay đổi này.");
    } finally {
      setSaving(false);
    }
  }

  function run() {
    switch (action) {
      case "transfer":
        return employeeService.transferDepartment(view.id, {
          newDepartmentId: form.departmentId,
          newPositionId: form.positionId || undefined,
          newManagerId: form.managerId ? form.managerId : undefined,
          effectiveDate: form.effectiveDate,
          reason: form.reason,
        });
      case "position":
        return employeeService.changePosition(view.id, {
          newPositionId: form.positionId,
          changeType: form.changeType,
          effectiveDate: form.effectiveDate,
          reason: form.reason,
        });
      case "manager":
        return employeeService.changeManager(view.id, {
          newManagerId: form.managerId || null,
          effectiveDate: form.effectiveDate,
          reason: form.reason,
        });
      case "probation-complete":
        return employeeService.completeProbation(view.id, {
          effectiveDate: form.effectiveDate,
          reason: form.reason,
        });
      case "probation-extend":
        return employeeService.extendProbation(view.id, {
          newEndDate: form.newEndDate,
          reason: form.reason,
        });
      case "salary":
        return employeeService.changeSalary(view.id, {
          newBaseSalary: Number(form.baseSalary),
          contractNumber: form.contractNumber.trim(),
          effectiveDate: form.effectiveDate,
          reason: form.reason,
        });
      case "end":
        return employeeService.endEmployment(view.id, {
          separationType: form.separationType,
          noticeDate: form.noticeDate || undefined,
          lastWorkingDate: form.lastWorkingDate,
          reason: form.reason,
          note: form.note || undefined,
        });
      case "rehire":
        return employeeService.rehire(view.id, {
          rehireDate: form.effectiveDate,
          departmentId: form.departmentId,
          positionId: form.positionId,
          managerId: form.managerId || null,
          reason: form.reason,
          contract: form.withContract
            ? {
                contractType: "fixed_term",
                employmentStatus: "probation",
                contractNumber: form.contractNumber.trim(),
                startDate: form.effectiveDate,
                baseSalary: Number(form.baseSalary),
              }
            : undefined,
        });
    }
  }

  const missing = requiredMissing(action, form);

  return (
    <FormModal
      open
      onClose={onClose}
      title={TITLE[action]}
      subtitle={`${view.fullName} · ${view.code}`}
      maxWidth={560}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving || missing}
            className={cn("gap-1.5 rounded-xl", action === "end" ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600")}
          >
            <Check className="size-4" strokeWidth={2.4} /> {saving ? "Đang lưu…" : "Xác nhận"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {action === "transfer" && (
          <>
            <Field label="Phòng ban hiện tại">
              <input className={inputCls} value={view.departmentName || "—"} readOnly disabled />
            </Field>
            <Field label="Phòng ban mới *">
              <select
                className={inputCls}
                value={form.departmentId}
                onChange={(e) => { set("departmentId", e.target.value); set("positionId", ""); }}
              >
                <option value="">— Chọn phòng ban —</option>
                {departments.filter((d) => d.id !== view.departmentId).map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Chức vụ mới">
              <select className={inputCls} value={form.positionId} onChange={(e) => set("positionId", e.target.value)}>
                <option value="">— Giữ nguyên —</option>
                {scopedPositions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Quản lý mới">
              <select className={inputCls} value={form.managerId} onChange={(e) => set("managerId", e.target.value)}>
                <option value="">— Giữ nguyên —</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          </>
        )}

        {action === "position" && (
          <>
            <Field label="Chức vụ hiện tại">
              <input className={inputCls} value={view.positionName || "—"} readOnly disabled />
            </Field>
            <Field label="Chức vụ mới *">
              <select className={inputCls} value={form.positionId} onChange={(e) => set("positionId", e.target.value)}>
                <option value="">— Chọn chức vụ —</option>
                {positions.filter((p) => p.id !== view.positionId).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Hình thức *">
              <select
                className={inputCls}
                value={form.changeType}
                onChange={(e) => set("changeType", e.target.value as typeof form.changeType)}
              >
                <option value="position_change">Điều chuyển ngang</option>
                <option value="promotion">Thăng chức</option>
              </select>
            </Field>
          </>
        )}

        {action === "manager" && (
          <>
            <Field label="Quản lý hiện tại">
              <input className={inputCls} value={view.managerName || "—"} readOnly disabled />
            </Field>
            <Field label="Quản lý mới *">
              <select className={inputCls} value={form.managerId} onChange={(e) => set("managerId", e.target.value)}>
                <option value="">— Gỡ quản lý —</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          </>
        )}

        {action === "probation-extend" && (
          <>
            <Field label="Kết thúc hiện tại">
              <input
                className={inputCls}
                value={contract?.endDate ? String(contract.endDate).slice(0, 10) : "—"}
                readOnly
                disabled
              />
            </Field>
            <Field label="Kết thúc mới *">
              <DateField className={inputCls} value={form.newEndDate} onChange={(iso) => set("newEndDate", iso)} />
            </Field>
          </>
        )}

        {action === "salary" && (
          <>
            <Field label="Lương hiện tại">
              <input
                className={cn(inputCls, "tabular-nums")}
                value={contract ? Number(contract.baseSalary).toLocaleString("vi-VN") : "—"}
                readOnly
                disabled
              />
            </Field>
            <Field label="Lương mới *">
              <input
                className={cn(inputCls, "tabular-nums")}
                inputMode="numeric"
                value={form.baseSalary}
                onChange={(e) => set("baseSalary", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="Số hợp đồng / phụ lục mới *" span>
              <input
                className={cn(inputCls, "font-mono")}
                value={form.contractNumber}
                onChange={(e) => set("contractNumber", e.target.value)}
                placeholder="VD: PL-2026-001"
              />
            </Field>
            <p className="col-span-2 -mt-1 text-[12px] text-muted-foreground">
              Hợp đồng cũ được đóng lại chứ không sửa số tiền, nên các kỳ lương đã tính vẫn giữ nguyên mức cũ.
            </p>
          </>
        )}

        {action === "end" && (
          <>
            <Field label="Hình thức *">
              <select
                className={inputCls}
                value={form.separationType}
                onChange={(e) => set("separationType", e.target.value as typeof form.separationType)}
              >
                <option value="resignation">Nghỉ theo nguyện vọng</option>
                <option value="termination">Công ty chấm dứt</option>
              </select>
            </Field>
            <Field label="Ngày báo trước">
              <DateField className={inputCls} value={form.noticeDate} onChange={(iso) => set("noticeDate", iso)} />
            </Field>
            <Field label="Ngày làm việc cuối *">
              <DateField
                className={inputCls}
                value={form.lastWorkingDate}
                onChange={(iso) => set("lastWorkingDate", iso)}
              />
            </Field>
            <Field label="Ghi chú" span>
              <input className={inputCls} value={form.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
            <p className="col-span-2 -mt-1 text-[12px] text-muted-foreground">
              Hồ sơ, hợp đồng và lịch sử được giữ nguyên; tài khoản đăng nhập bị vô hiệu.
            </p>
          </>
        )}

        {action === "rehire" && (
          <>
            <Field label="Phòng ban *">
              <select
                className={inputCls}
                value={form.departmentId}
                onChange={(e) => { set("departmentId", e.target.value); set("positionId", ""); }}
              >
                <option value="">— Chọn phòng ban —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Chức vụ *">
              <select className={inputCls} value={form.positionId} onChange={(e) => set("positionId", e.target.value)}>
                <option value="">— Chọn chức vụ —</option>
                {scopedPositions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Quản lý">
              <select className={inputCls} value={form.managerId} onChange={(e) => set("managerId", e.target.value)}>
                <option value="">— Không —</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Hợp đồng mới">
              <label className="flex h-10 items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.withContract}
                  onChange={(e) => set("withContract", e.target.checked)}
                />
                Lập ngay hợp đồng thử việc
              </label>
            </Field>
            {form.withContract && (
              <>
                <Field label="Số hợp đồng *">
                  <input
                    className={cn(inputCls, "font-mono")}
                    value={form.contractNumber}
                    onChange={(e) => set("contractNumber", e.target.value)}
                  />
                </Field>
                <Field label="Lương cơ bản *">
                  <input
                    className={cn(inputCls, "tabular-nums")}
                    inputMode="numeric"
                    value={form.baseSalary}
                    onChange={(e) => set("baseSalary", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              </>
            )}
            <p className="col-span-2 -mt-1 text-[12px] text-muted-foreground">
              Dùng lại đúng hồ sơ cũ (giữ mã nhân viên, lịch sử, hợp đồng và bảng lương cũ).
            </p>
          </>
        )}

        {action !== "probation-extend" && (
          <Field label={action === "end" ? "Ngày hiệu lực (tự theo ngày làm việc cuối)" : action === "rehire" ? "Ngày tái tuyển *" : "Ngày hiệu lực *"}>
            {action === "end" ? (
              <input className={inputCls} value={form.lastWorkingDate} readOnly disabled />
            ) : (
              <DateField className={inputCls} value={form.effectiveDate} onChange={(iso) => set("effectiveDate", iso)} />
            )}
          </Field>
        )}

        <Field label="Lý do *" span>
          <input
            className={inputCls}
            value={form.reason}
            onChange={(e) => set("reason", e.target.value)}
            placeholder="Tối thiểu 3 ký tự — sẽ hiển thị trong dòng thời gian"
          />
        </Field>
      </div>

      {error && <p className="mt-4 text-[12.5px] text-destructive">{error}</p>}
    </FormModal>
  );
}

/** Chặn gửi sớm ở client; server vẫn kiểm tra lại đầy đủ. */
function requiredMissing(action: LifecycleAction, form: Record<string, unknown>): boolean {
  const has = (key: string) => String(form[key] ?? "").trim().length > 0;
  if (!has("reason") || String(form.reason).trim().length < 3) return true;

  switch (action) {
    case "transfer":
      return !has("departmentId") || !has("effectiveDate");
    case "position":
      return !has("positionId") || !has("effectiveDate");
    case "manager":
      return !has("effectiveDate");
    case "probation-complete":
      return !has("effectiveDate");
    case "probation-extend":
      return !has("newEndDate");
    case "salary":
      return !has("baseSalary") || !has("contractNumber") || !has("effectiveDate");
    case "end":
      return !has("lastWorkingDate");
    case "rehire":
      return (
        !has("departmentId") ||
        !has("positionId") ||
        !has("effectiveDate") ||
        (form.withContract === true && (!has("contractNumber") || !has("baseSalary")))
      );
  }
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn(span && "col-span-2")}>
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

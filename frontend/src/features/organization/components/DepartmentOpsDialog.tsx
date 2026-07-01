import { useEffect, useMemo, useState } from "react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DepartmentNode } from "@features/organization/types/organization.types";
import { employeeService } from "@features/employee/services/employee.service";
import type {
  EmployeeRecord,
  EmployeeProfile,
} from "@features/employee/types/employee.types";

export type OpsMode = "head" | "move" | "transfer" | "merge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: OpsMode;
  /** The department the operation acts on. */
  node: DepartmentNode;
  /** Current head id (for "head" mode prefill). */
  currentManagerId?: string | null;
  /** Flat list of all departments for target/parent selectors. */
  allDepartments: DepartmentNode[];
  /** Run the operation; throw to surface the error message. */
  onConfirm: (payload: {
    managerId?: string | null;
    parentDepartmentId?: string | null;
    targetDepartmentId?: string;
  }) => Promise<void>;
}

const TITLES: Record<OpsMode, string> = {
  head: "Bổ nhiệm trưởng phòng",
  move: "Di chuyển phòng ban",
  transfer: "Điều chuyển nhân sự",
  merge: "Gộp phòng ban",
};

const DESCRIPTIONS: Record<OpsMode, string> = {
  head: "Chọn trưởng phòng từ nhân viên đang hoạt động của phòng.",
  move: "Đổi phòng ban cha trong sơ đồ tổ chức.",
  transfer: "Chuyển toàn bộ nhân sự đang hoạt động sang phòng ban khác.",
  merge: "Chuyển toàn bộ nhân sự + chức vụ sang phòng đích, sau đó lưu trữ phòng này.",
};

function fullName(p?: EmployeeProfile | null): string {
  if (!p) return "";
  return [p.lastName, p.firstName].filter(Boolean).join(" ");
}

/** ids of node + descendants — invalid as a move target. */
function collectSubtreeIds(node: DepartmentNode): Set<string> {
  const ids = new Set<string>();
  const walk = (n: DepartmentNode) => {
    ids.add(n.id);
    n.children.forEach(walk);
  };
  walk(node);
  return ids;
}

export function DepartmentOpsDialog({
  open,
  onOpenChange,
  mode,
  node,
  currentManagerId,
  allDepartments,
  onConfirm,
}: Props) {
  const needsEmployees = mode === "head";
  const [managerId, setManagerId] = useState<string>(currentManagerId ?? "");
  const [targetId, setTargetId] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active employees of this department for the head selector.
  useEffect(() => {
    if (!needsEmployees) return;
    let cancelled = false;
    employeeService
      .list({ departmentId: node.id, status: "active", limit: 200 })
      .then((res) => {
        if (!cancelled) setEmployees(res.items);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsEmployees, node.id]);

  // Department options exclude this dept; for "move" also exclude descendants.
  const deptOptions = useMemo(() => {
    const excluded =
      mode === "move" ? collectSubtreeIds(node) : new Set<string>([node.id]);
    return allDepartments.filter((d) => !excluded.has(d.id) && d.status === "active");
  }, [allDepartments, mode, node]);

  const canSubmit =
    mode === "head" ? true : targetId.length > 0 || mode === "move";

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "head") {
        await onConfirm({ managerId: managerId || null });
      } else if (mode === "move") {
        await onConfirm({ parentDepartmentId: targetId || null });
      } else {
        if (!targetId) {
          setError("Vui lòng chọn phòng ban đích.");
          setSubmitting(false);
          return;
        }
        await onConfirm({ targetDepartmentId: targetId });
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Đã có lỗi xảy ra. Vui lòng thử lại.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(false)}
        disabled={submitting}
      >
        Hủy
      </Button>
      <Button type="button" size="sm" disabled={!canSubmit || submitting} onClick={handleConfirm}>
        {submitting ? "Đang xử lý…" : "Xác nhận"}
      </Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={TITLES[mode]}
      subtitle={DESCRIPTIONS[mode]}
      footer={footer}
    >
        <div className="flex flex-col gap-4">
          {mode === "head" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ops-head">Trưởng phòng</Label>
              <select
                id="ops-head"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Không có trưởng phòng —</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.employeeCode} · {fullName(e.profile) || e.employeeCode}
                  </option>
                ))}
              </select>
              {employees.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Phòng ban chưa có nhân viên đang hoạt động.
                </span>
              )}
            </div>
          )}

          {mode === "move" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ops-parent">Phòng ban cha mới</Label>
              <select
                id="ops-parent"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Không (cấp gốc) —</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(mode === "transfer" || mode === "merge") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ops-target">Phòng ban đích *</Label>
              <select
                id="ops-target"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Chọn phòng ban —</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
              {mode === "merge" && (
                <span className="text-[11px] text-destructive">
                  Phòng "{node.name}" sẽ được lưu trữ sau khi gộp.
                </span>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              {error}
            </p>
          )}
        </div>
    </FormModal>
  );
}

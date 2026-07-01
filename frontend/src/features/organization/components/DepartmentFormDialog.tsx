import { useMemo, useState } from "react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  CreateDepartmentInput,
  DepartmentNode,
  UpdateDepartmentInput,
} from "@features/organization/types/organization.types";
import {
  departmentFormSchema,
  fieldErrors,
} from "@features/organization/schemas/organization.schema";

export type DepartmentFormMode = "create" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DepartmentFormMode;
  /** The node being edited (edit mode) — used to prefill fields. */
  target?: DepartmentNode | null;
  /** Preselected parent id (create mode "add sub-unit"). */
  presetParentId?: string | null;
  /** Flat list of all departments for the parent selector. */
  allDepartments: DepartmentNode[];
  /** Resolve with success; throw to surface the error message in the dialog. */
  onSubmit: (
    input: CreateDepartmentInput | UpdateDepartmentInput,
  ) => Promise<void>;
}

/** ids of node + all its descendants — invalid as parent choices when editing. */
function collectSubtreeIds(node: DepartmentNode): Set<string> {
  const ids = new Set<string>();
  const walk = (n: DepartmentNode) => {
    ids.add(n.id);
    n.children.forEach(walk);
  };
  walk(node);
  return ids;
}

export function DepartmentFormDialog({
  open,
  onOpenChange,
  mode,
  target,
  presetParentId,
  allDepartments,
  onSubmit,
}: Props) {
  // Fields are seeded from props via lazy initialisers. The parent remounts
  // this component (via a changing `key`) on each open, so state resets per
  // session without a state-syncing effect.
  const isEdit = mode === "edit" && target;
  const [name, setName] = useState(() => (isEdit ? target.name : ""));
  const [code, setCode] = useState(() => (isEdit ? target.code : ""));
  const [parentId, setParentId] = useState<string>(() =>
    isEdit ? (target.parentDepartmentId ?? "") : (presetParentId ?? ""),
  );
  const [description, setDescription] = useState(() =>
    isEdit ? (target.description ?? "") : "",
  );
  const [status, setStatus] = useState<"active" | "archived">(() =>
    isEdit ? target.status : "active",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fErrors, setFErrors] = useState<Record<string, string>>({});

  const parentOptions = useMemo(() => {
    const excluded =
      mode === "edit" && target ? collectSubtreeIds(target) : new Set<string>();
    return allDepartments.filter((d) => !excluded.has(d.id));
  }, [allDepartments, mode, target]);

  const canSubmit = name.trim().length > 0 && code.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const errs = fieldErrors(departmentFormSchema, {
      name, code, parentDepartmentId: parentId, description, status,
    });
    if (errs) { setFErrors(errs); return; }
    setFErrors({});
    setSubmitting(true);
    setError(null);

    const common = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      parentDepartmentId: parentId || null,
      description: description.trim() || undefined,
    };
    const payload: CreateDepartmentInput | UpdateDepartmentInput =
      mode === "create" ? common : { ...common, status };

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err) {
      const message =
        // axios error envelope: { error: { message } }
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
        className="rounded-xl"
      >
        Hủy
      </Button>
      <Button
        type="submit"
        form="department-form"
        size="sm"
        disabled={!canSubmit || submitting}
        className="rounded-xl"
      >
        {submitting ? "Đang lưu…" : mode === "create" ? "Tạo phòng ban" : "Lưu thay đổi"}
      </Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={mode === "create" ? "Tạo phòng ban" : "Chỉnh sửa phòng ban"}
      subtitle={
        mode === "create"
          ? "Thêm một phòng ban / đơn vị mới vào sơ đồ tổ chức."
          : "Cập nhật thông tin phòng ban."
      }
      footer={footer}
    >
      <form id="department-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="dept-name">Tên phòng ban *</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Backend Team"
                maxLength={120}
                autoFocus
              />
              {fErrors.name && <span className="text-[11px] text-destructive">{fErrors.name}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-code">Mã *</Label>
              <Input
                id="dept-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: BE"
                maxLength={20}
              />
              {fErrors.code && <span className="text-[11px] text-destructive">{fErrors.code}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-parent">Phòng ban cha</Label>
              <select
                id="dept-parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Không (cấp gốc) —</option>
                {parentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </div>

            {mode === "edit" && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="dept-status">Trạng thái</Label>
                <select
                  id="dept-status"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "active" | "archived")
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="archived">Đã lưu trữ</option>
                </select>
              </div>
            )}

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="dept-desc">Mô tả</Label>
              <Textarea
                id="dept-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về phòng ban…"
                maxLength={500}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              {error}
            </p>
          )}
      </form>
    </FormModal>
  );
}

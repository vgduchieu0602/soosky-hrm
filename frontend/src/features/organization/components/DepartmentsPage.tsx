import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  ChevronRight,
  ChevronDown,
  Briefcase,
  Plus,
  Search,
  Pencil,
  Archive,
  CornerDownRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils/cn";
import { useAuthStore } from "@core/store/auth.store";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { organizationService } from "@features/organization/services/organization.service";
import type {
  CreateDepartmentInput,
  CreatePositionInput,
  DepartmentNode,
  Position,
  UpdateDepartmentInput,
  UpdatePositionInput,
} from "@features/organization/types/organization.types";
import {
  DepartmentFormDialog,
  type DepartmentFormMode,
} from "@features/organization/components/DepartmentFormDialog";
import { DeleteDepartmentDialog } from "@features/organization/components/DeleteDepartmentDialog";
import {
  PositionFormDialog,
  type PositionFormMode,
} from "@features/organization/components/PositionFormDialog";
import { DeletePositionDialog } from "@features/organization/components/DeletePositionDialog";

const COLOR_BY_CODE: Record<string, string> = {
  SK: "slate",
  CEO: "blue",
  CGO: "indigo",
  PO: "violet",
  APP: "cyan",
  DSG: "rose",
  QA: "emerald",
  BE: "blue",
  HR: "violet",
  UA: "amber",
};

function chipFor(code: string): string {
  return COLOR_BY_CODE[code] ?? "slate";
}

function subtreeHeadcount(node: DepartmentNode): number {
  return (node.headcount || 0) + node.children.reduce((s, c) => s + subtreeHeadcount(c), 0);
}

function flatten(tree: DepartmentNode[]): DepartmentNode[] {
  const out: DepartmentNode[] = [];
  const walk = (n: DepartmentNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

function findById(tree: DepartmentNode[], id: string): DepartmentNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const inChild = findById(node.children, id);
    if (inChild) return inChild;
  }
  return null;
}

const MANAGE_ROLES = ["admin", "hr_manager"];

export default function DepartmentsPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = roles.some((r) => MANAGE_ROLES.includes(r));

  const [tree, setTree] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posState, setPosState] = useState<{ deptId: string; items: Position[] }>({
    deptId: "",
    items: [],
  });
  const [q, setQ] = useState("");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<DepartmentFormMode>("create");
  const [formTarget, setFormTarget] = useState<DepartmentNode | null>(null);
  const [presetParentId, setPresetParentId] = useState<string | null>(null);
  const [formSession, setFormSession] = useState(0); // bump to remount the form
  const [deleteTarget, setDeleteTarget] = useState<DepartmentNode | null>(null);

  // Position dialog state
  const [posReload, setPosReload] = useState(0); // bump to refetch positions
  const [posFormOpen, setPosFormOpen] = useState(false);
  const [posFormMode, setPosFormMode] = useState<PositionFormMode>("create");
  const [posTarget, setPosTarget] = useState<Position | null>(null);
  const [posFormSession, setPosFormSession] = useState(0);
  const [posDeleteTarget, setPosDeleteTarget] = useState<Position | null>(null);

  // Promise-chain form: state is only touched inside async callbacks, so this
  // is safe to call straight from an effect without a cascading render.
  const loadTree = useCallback(
    () =>
      organizationService
        .departmentsTree()
        .then((data) => {
          setTree(Array.isArray(data) ? data : []);
          setError(null);
        })
        .catch(() => {
          setError("Không thể tải danh sách phòng ban từ máy chủ.");
        })
        .finally(() => {
          setLoading(false);
        }),
    [],
  );

  // Manual refresh: toggling the spinner happens in this event handler (not an
  // effect), then the shared loader runs.
  function refresh() {
    setLoading(true);
    void loadTree();
  }

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const flat = useMemo(() => flatten(tree), [tree]);
  const selected = useMemo(
    () => (selectedId ? findById(tree, selectedId) : null),
    [tree, selectedId],
  );

  // Load positions for the selected department from BE. We tag the result with
  // the department id so a slow response for a previous selection is ignored
  // and stale rows never flash for the new one.
  const selectedDeptId = selected?.id ?? null;
  useEffect(() => {
    if (!selectedDeptId) return;
    let cancelled = false;
    organizationService
      .positionsByDept(selectedDeptId)
      .then((data) => {
        if (!cancelled) setPosState({ deptId: selectedDeptId, items: data });
      })
      .catch(() => {
        if (!cancelled) setPosState({ deptId: selectedDeptId, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDeptId, posReload]);

  const positions = posState.deptId === selectedDeptId ? posState.items : [];

  const totals = useMemo(
    () => ({
      total: flat.length,
      headcount: flat.reduce((s, d) => s + d.headcount, 0),
      teams: flat.filter((d) => d.parentDepartmentId !== null).length,
    }),
    [flat],
  );

  // --- CRUD handlers ---------------------------------------------------------
  function openCreate(parentId: string | null = null) {
    setFormMode("create");
    setFormTarget(null);
    setPresetParentId(parentId);
    setFormSession((s) => s + 1);
    setFormOpen(true);
  }

  function openEdit(node: DepartmentNode) {
    setFormMode("edit");
    setFormTarget(node);
    setPresetParentId(null);
    setFormSession((s) => s + 1);
    setFormOpen(true);
  }

  async function handleSubmit(
    input: CreateDepartmentInput | UpdateDepartmentInput,
  ) {
    if (formMode === "create") {
      const created = await organizationService.createDepartment(
        input as CreateDepartmentInput,
      );
      await loadTree();
      setSelectedId(created._id);
    } else if (formTarget) {
      await organizationService.updateDepartment(
        formTarget.id,
        input as UpdateDepartmentInput,
      );
      await loadTree();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await organizationService.archiveDepartment(deleteTarget.id);
    if (selectedId === deleteTarget.id) setSelectedId(null);
    await loadTree();
  }

  // --- Position handlers ----------------------------------------------------
  function openCreatePosition() {
    setPosFormMode("create");
    setPosTarget(null);
    setPosFormSession((s) => s + 1);
    setPosFormOpen(true);
  }

  function openEditPosition(p: Position) {
    setPosFormMode("edit");
    setPosTarget(p);
    setPosFormSession((s) => s + 1);
    setPosFormOpen(true);
  }

  async function handlePositionSubmit(
    input: CreatePositionInput | UpdatePositionInput,
  ) {
    if (posFormMode === "create") {
      if (!selectedDeptId) return;
      await organizationService.createPosition({
        ...(input as CreatePositionInput),
        departmentId: selectedDeptId,
      });
    } else if (posTarget) {
      await organizationService.updatePosition(
        posTarget._id,
        input as UpdatePositionInput,
      );
    }
    setPosReload((n) => n + 1);
  }

  async function handlePositionDelete() {
    if (!posDeleteTarget) return;
    await organizationService.deletePosition(posDeleteTarget._id);
    setPosReload((n) => n + 1);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="org" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Phòng ban"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">
                  Phòng ban
                </h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Sơ đồ tổ chức Soosky · {totals.total} phòng ban · {totals.headcount} nhân sự
                  {loading && " · đang đồng bộ…"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 rounded-full text-[13px]"
                  onClick={refresh}
                  disabled={loading}
                >
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} strokeWidth={1.9} />
                  Làm mới
                </Button>
                {canManage && (
                  <Button
                    size="sm"
                    className="h-9 gap-2 rounded-full text-[13px]"
                    onClick={() => openCreate(null)}
                  >
                    <Plus className="size-3.5" strokeWidth={1.9} /> Tạo phòng ban
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <SummaryTile chip="blue" icon={Building2} label="Tổng đơn vị" value={totals.total} />
              <SummaryTile chip="emerald" icon={Briefcase} label="Team trực thuộc" value={totals.teams} />
              <SummaryTile chip="violet" icon={Users} label="Tổng nhân sự" value={totals.headcount} />
            </div>

            {error && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
                <span>{error}</span>
                <Button variant="outline" size="sm" className="h-7" onClick={refresh}>
                  Thử lại
                </Button>
              </div>
            )}

            <div className="grid grid-cols-12 gap-5">
              <Card className="col-span-7 flex flex-col p-5">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="flex-1 text-[14px] font-semibold text-foreground">
                    Sơ đồ tổ chức
                  </h3>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Tìm phòng ban…"
                      className="h-8 w-56 pl-8 text-[12.5px]"
                    />
                  </div>
                </div>
                <div className="overflow-auto">
                  {loading ? (
                    <div className="flex flex-col gap-2 py-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" />
                      ))}
                    </div>
                  ) : tree.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <Building2 className="size-8 text-muted-foreground/50" />
                      <p className="text-[13px] text-muted-foreground">
                        Chưa có phòng ban nào.
                      </p>
                      {canManage && (
                        <Button size="sm" className="gap-1.5" onClick={() => openCreate(null)}>
                          <Plus className="size-3.5" /> Tạo phòng ban đầu tiên
                        </Button>
                      )}
                    </div>
                  ) : (
                    tree.map((root) => (
                      <DeptTreeNode
                        key={root.id}
                        node={root}
                        depth={0}
                        query={q}
                        selectedId={selectedId}
                        onSelect={(n) => setSelectedId(n.id)}
                      />
                    ))
                  )}
                </div>
              </Card>

              <Card className="col-span-5 flex flex-col p-5">
                {selected ? (
                  <DepartmentDetail
                    node={selected}
                    positions={positions}
                    canManage={canManage}
                    onEdit={() => openEdit(selected)}
                    onArchive={() => setDeleteTarget(selected)}
                    onAddSub={() => openCreate(selected.id)}
                    onAddPosition={openCreatePosition}
                    onEditPosition={openEditPosition}
                    onDeletePosition={setPosDeleteTarget}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center py-12 text-center text-[13px] text-muted-foreground">
                    Chọn một phòng ban để xem chi tiết.
                  </div>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>

      <DepartmentFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        target={formTarget}
        presetParentId={presetParentId}
        allDepartments={flat}
        onSubmit={handleSubmit}
      />
      <DeleteDepartmentDialog
        key={deleteTarget?.id ?? "none"}
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        target={deleteTarget}
        onConfirm={handleDelete}
      />
      <PositionFormDialog
        key={`pos-${posFormSession}`}
        open={posFormOpen}
        onOpenChange={setPosFormOpen}
        mode={posFormMode}
        departmentName={selected?.name ?? ""}
        target={posTarget}
        onSubmit={handlePositionSubmit}
      />
      <DeletePositionDialog
        key={posDeleteTarget?._id ?? "pos-none"}
        open={posDeleteTarget !== null}
        onOpenChange={(open) => !open && setPosDeleteTarget(null)}
        target={posDeleteTarget}
        onConfirm={handlePositionDelete}
      />
    </div>
  );
}

function SummaryTile({
  chip, icon: Icon, label, value,
}: { chip: string; icon: typeof Users; label: string; value: number | string }) {
  const bg = `var(--chip-${chip}-bg)`;
  const ink = `var(--chip-${chip}-ink)`;
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span
        className="flex size-11 items-center justify-center rounded-2xl"
        style={{ background: bg, color: ink }}
      >
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div>
        <div className="text-[22px] font-bold leading-none tabular-nums text-foreground">{value}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

interface TreeNodeProps {
  node: DepartmentNode;
  depth: number;
  query: string;
  selectedId: string | null;
  onSelect: (n: DepartmentNode) => void;
}

function DeptTreeNode({ node, depth, query, selectedId, onSelect }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 1);
  const hasKids = node.children.length > 0;
  const matches =
    !query ||
    node.name.toLowerCase().includes(query.toLowerCase()) ||
    node.code.toLowerCase().includes(query.toLowerCase());
  const isSelected = selectedId === node.id;
  const subTotal = subtreeHeadcount(node);

  return (
    <div>
      <button
        type="button"
        onClick={() => { onSelect(node); if (hasKids) setOpen((o) => !o); }}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] transition-colors hover:bg-muted/60",
          isSelected && "bg-muted",
          node.status === "archived" && "opacity-55",
        )}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <span className="flex size-5 items-center justify-center text-muted-foreground">
          {hasKids ? (
            open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />
          ) : (
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </span>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Badge variant={chipFor(node.code) as any} className="font-mono">{node.code}</Badge>
        <span className={cn("flex-1 font-semibold", matches ? "text-foreground" : "text-muted-foreground/70")}>
          {node.name}
        </span>
        {node.status === "archived" && (
          <Badge variant="secondary" className="text-[10px]">Lưu trữ</Badge>
        )}
        <span className="text-[11.5px] tabular-nums text-muted-foreground">
          {node.headcount} <span className="text-muted-foreground/60">/ {subTotal}</span>
        </span>
      </button>
      {hasKids && open && (
        <div className="border-l border-dashed border-border/60" style={{ marginLeft: 8 + depth * 18 + 9 }}>
          {node.children.map((c) => (
            <DeptTreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              query={query}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DetailProps {
  node: DepartmentNode;
  positions: Position[];
  canManage: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onAddSub: () => void;
  onAddPosition: () => void;
  onEditPosition: (p: Position) => void;
  onDeletePosition: (p: Position) => void;
}

function DepartmentDetail({
  node, positions, canManage, onEdit, onArchive, onAddSub,
  onAddPosition, onEditPosition, onDeletePosition,
}: DetailProps) {
  const subTotal = subtreeHeadcount(node);
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Badge variant={chipFor(node.code) as any} className="font-mono text-[11px]">
          {node.code}
        </Badge>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">{node.name}</h2>
          {node.description && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">{node.description}</p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={onEdit}>
            <Pencil className="size-3.5" /> Chỉnh sửa
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={onAddSub}>
            <CornerDownRight className="size-3.5" /> Thêm đơn vị con
          </Button>
          {node.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[12px] text-destructive hover:text-destructive"
              onClick={onArchive}
            >
              <Archive className="size-3.5" /> Lưu trữ
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Trực tiếp
          </div>
          <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">
            {node.headcount}
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Tổng subtree
          </div>
          <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{subTotal}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Trạng thái
          </div>
          <div className="mt-1 text-[13px] font-semibold text-foreground">
            {node.status === "active" ? "Đang hoạt động" : "Đã lưu trữ"}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">Chức vụ</h3>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[12px]"
              onClick={onAddPosition}
            >
              <Plus className="size-3.5" /> Thêm chức vụ
            </Button>
          )}
        </div>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center text-[12.5px] text-muted-foreground">
            <span>Chưa có chức vụ nào trong phòng ban này.</span>
            {canManage && (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]" onClick={onAddPosition}>
                <Plus className="size-3.5" /> Thêm chức vụ đầu tiên
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {positions.map((p) => (
              <li
                key={p._id}
                className="group flex items-center gap-3 rounded-xl border p-3 text-[12.5px]"
              >
                <Briefcase className="size-4 text-muted-foreground" />
                <span className="flex-1 font-semibold text-foreground">{p.title}</span>
                <Badge variant="secondary" className="font-mono">{p.code}</Badge>
                <span className="w-12 text-right tabular-nums text-muted-foreground">
                  Lv {p.level}
                </span>
                {canManage && (
                  <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onEditPosition(p)}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Sửa chức vụ"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePosition(p)}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Xoá chức vụ"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {node.children.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-foreground">Đơn vị con</h3>
          <ul className="flex flex-col gap-1.5">
            {node.children.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 text-[12.5px]"
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Badge variant={chipFor(c.code) as any} className="font-mono">{c.code}</Badge>
                <span className="flex-1 font-semibold text-foreground">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {subtreeHeadcount(c)} NV
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

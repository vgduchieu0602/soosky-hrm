import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  RefreshCw,
  Network,
  ListTree,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { apiErrorMessage } from "@shared/utils/apiError";
import { useAuthStore } from "@core/store/auth.store";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { organizationService } from "@features/organization/services/organization.service";
import type {
  CreateDepartmentInput,
  CreatePositionInput,
  DepartmentHistoryEntry,
  DepartmentNode,
  Position,
  UpdateDepartmentInput,
  UpdatePositionInput,
} from "@features/organization/types/organization.types";
import { chipFor, subtreeHeadcount, flatten, findById } from "@features/organization/utils/org.utils";
import {
  DepartmentFormDialog,
  type DepartmentFormMode,
} from "@features/organization/components/DepartmentFormDialog";
import {
  DepartmentOpsDialog,
  type OpsMode,
} from "@features/organization/components/DepartmentOpsDialog";
import { DeleteDepartmentDialog } from "@features/organization/components/DeleteDepartmentDialog";
import {
  PositionFormDialog,
  type PositionFormMode,
} from "@features/organization/components/PositionFormDialog";
import { DeletePositionDialog } from "@features/organization/components/DeletePositionDialog";
import { DepartmentAnalytics } from "@features/organization/components/DepartmentAnalytics";
import { OrgChart } from "@features/organization/components/OrgChart";
import { DepartmentDetailTabs } from "@features/organization/components/DepartmentDetailTabs";

const MANAGE_ROLES = ["admin", "hr_manager"];
type ViewMode = "chart" | "tree";

export default function DepartmentsPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = roles.some((r) => MANAGE_ROLES.includes(r));

  const [searchParams, setSearchParams] = useSearchParams();
  const view: ViewMode = searchParams.get("view") === "chart" ? "chart" : "tree";
  const setView = (next: ViewMode) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("view", next);
    setSearchParams(sp, { replace: true });
  };

  const [tree, setTree] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posState, setPosState] = useState<{ deptId: string; items: Position[] }>({ deptId: "", items: [] });
  const [q, setQ] = useState("");

  // Department dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<DepartmentFormMode>("create");
  const [formTarget, setFormTarget] = useState<DepartmentNode | null>(null);
  const [presetParentId, setPresetParentId] = useState<string | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentNode | null>(null);

  // Lifecycle ops dialog
  const [opsMode, setOpsMode] = useState<OpsMode>("head");
  const [opsOpen, setOpsOpen] = useState(false);
  const [opsSession, setOpsSession] = useState(0);

  // Change-log
  const [history, setHistory] = useState<DepartmentHistoryEntry[]>([]);
  const [historyReload, setHistoryReload] = useState(0);

  // Position dialog state
  const [posReload, setPosReload] = useState(0);
  const [posFormOpen, setPosFormOpen] = useState(false);
  const [posFormMode, setPosFormMode] = useState<PositionFormMode>("create");
  const [posTarget, setPosTarget] = useState<Position | null>(null);
  const [posFormSession, setPosFormSession] = useState(0);
  const [posDeleteTarget, setPosDeleteTarget] = useState<Position | null>(null);

  const loadTree = useCallback(
    () =>
      organizationService
        .departmentsTree()
        .then((data) => {
          setTree(Array.isArray(data) ? data : []);
          setError(null);
        })
        .catch(() => setError("Không thể tải danh sách phòng ban từ máy chủ."))
        .finally(() => setLoading(false)),
    [],
  );

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

  useEffect(() => {
    if (!selectedDeptId) return;
    let cancelled = false;
    organizationService
      .departmentHistory(selectedDeptId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDeptId, historyReload]);

  const positions =
    posState.deptId === selectedDeptId ? posState.items.filter((p) => p.status !== "archived") : [];

  // --- Department handlers --------------------------------------------------
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

  async function handleSubmit(input: CreateDepartmentInput | UpdateDepartmentInput) {
    try {
      if (formMode === "create") {
        const created = await organizationService.createDepartment(input as CreateDepartmentInput);
        await loadTree();
        setSelectedId(created._id);
        toast.success("Đã tạo phòng ban");
      } else if (formTarget) {
        await organizationService.updateDepartment(formTarget.id, input as UpdateDepartmentInput);
        await loadTree();
        toast.success("Đã cập nhật phòng ban");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Không thể lưu phòng ban"));
      throw err; // let the dialog show the inline error + stay open
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await organizationService.deleteDepartment(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      await loadTree();
      toast.success("Đã xóa phòng ban");
    } catch (err) {
      // 409 ORG_DEPT_HAS_DATA → dependency warning surfaced as a toast.
      toast.error(apiErrorMessage(err, "Không thể xóa phòng ban"));
      throw err;
    }
  }

  // --- Lifecycle ops --------------------------------------------------------
  function openOps(mode: OpsMode) {
    setOpsMode(mode);
    setOpsSession((s) => s + 1);
    setOpsOpen(true);
  }

  async function handleOpsConfirm(payload: {
    managerId?: string | null;
    parentDepartmentId?: string | null;
    targetDepartmentId?: string;
  }) {
    if (!selected) return;
    if (opsMode === "head") {
      await organizationService.assignHead(selected.id, payload.managerId ?? null);
    } else if (opsMode === "move") {
      await organizationService.moveDepartment(selected.id, payload.parentDepartmentId ?? null);
    } else if (opsMode === "transfer") {
      await organizationService.transferEmployees(selected.id, {
        targetDepartmentId: payload.targetDepartmentId!,
      });
    } else if (opsMode === "merge") {
      await organizationService.mergeDepartment(selected.id, payload.targetDepartmentId!);
    }
    await loadTree();
    setPosReload((n) => n + 1);
    setHistoryReload((n) => n + 1);
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

  async function handlePositionSubmit(input: CreatePositionInput | UpdatePositionInput) {
    if (posFormMode === "create") {
      if (!selectedDeptId) return;
      await organizationService.createPosition({
        ...(input as CreatePositionInput),
        departmentId: selectedDeptId,
      });
    } else if (posTarget) {
      await organizationService.updatePosition(posTarget._id, input as UpdatePositionInput);
    }
    setPosReload((n) => n + 1);
  }

  async function handlePositionDelete() {
    if (!posDeleteTarget) return;
    await organizationService.archivePosition(posDeleteTarget._id);
    setPosReload((n) => n + 1);
  }

  const totalHeadcount = flat.reduce((s, d) => s + d.headcount, 0);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="org" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Phòng ban"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Phòng ban</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Sơ đồ tổ chức Soosky · {flat.length} phòng ban · {totalHeadcount} nhân sự
                  {loading && " · đang đồng bộ…"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ViewToggle view={view} onChange={setView} />
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

            <DepartmentAnalytics flat={flat} tree={tree} />

            {error && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
                <span>{error}</span>
                <Button variant="outline" size="sm" className="h-7" onClick={refresh}>Thử lại</Button>
              </div>
            )}

            <div className="grid grid-cols-12 gap-5">
              <Card className="col-span-12 flex flex-col p-5 lg:col-span-8">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="flex-1 text-[14px] font-semibold text-foreground">
                    {view === "chart" ? "Sơ đồ tổ chức" : "Cây phòng ban"}
                  </h3>
                  {view === "tree" && (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm phòng ban…"
                        className="h-8 w-56 pl-8 text-[12.5px]"
                      />
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="flex flex-col gap-2 py-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" />
                    ))}
                  </div>
                ) : tree.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Building2 className="size-8 text-muted-foreground/50" />
                    <p className="text-[13px] text-muted-foreground">Chưa có phòng ban nào.</p>
                    {canManage && (
                      <Button size="sm" className="gap-1.5" onClick={() => openCreate(null)}>
                        <Plus className="size-3.5" /> Tạo phòng ban đầu tiên
                      </Button>
                    )}
                  </div>
                ) : view === "chart" ? (
                  <OrgChart tree={tree} selectedId={selectedId} onSelect={(n) => setSelectedId(n.id)} />
                ) : (
                  <div className="overflow-auto">
                    {tree.map((root) => (
                      <DeptTreeNode
                        key={root.id}
                        node={root}
                        depth={0}
                        query={q}
                        selectedId={selectedId}
                        onSelect={(n) => setSelectedId(n.id)}
                      />
                    ))}
                  </div>
                )}
              </Card>

              <Card className="col-span-12 flex flex-col p-5 lg:col-span-4">
                {selected ? (
                  <DepartmentDetailTabs
                    node={selected}
                    positions={positions}
                    history={history}
                    canManage={canManage}
                    onEdit={() => openEdit(selected)}
                    onArchive={() => setDeleteTarget(selected)}
                    onAddSub={() => openCreate(selected.id)}
                    onAssignHead={() => openOps("head")}
                    onMove={() => openOps("move")}
                    onTransfer={() => openOps("transfer")}
                    onMerge={() => openOps("merge")}
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
      {selected && (
        <DepartmentOpsDialog
          key={`ops-${opsSession}`}
          open={opsOpen}
          onOpenChange={setOpsOpen}
          mode={opsMode}
          node={selected}
          currentManagerId={selected.managerId ?? null}
          allDepartments={flat}
          onConfirm={handleOpsConfirm}
        />
      )}
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

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center rounded-full border bg-muted/40 p-0.5">
      <ToggleBtn active={view === "chart"} onClick={() => onChange("chart")} icon={Network} label="Sơ đồ" />
      <ToggleBtn active={view === "tree"} onClick={() => onChange("tree")} icon={ListTree} label="Cây" />
    </div>
  );
}

function ToggleBtn({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Network; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" /> {label}
    </button>
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
            <DeptTreeNode key={c.id} node={c} depth={depth + 1} query={query} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

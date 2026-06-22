import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, UserPlus, Download, ChevronRight, ChevronLeft, ChevronDown, Check,
  Users, UserCheck, CalendarDays, RefreshCw, UserX, X, Upload, type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import { useAuthStore } from "@core/store/auth.store";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { organizationService } from "@features/organization/services/organization.service";
import { employeeService } from "@features/employee/services/employee.service";
import { EmployeeDetail } from "@features/employee/components/EmployeeDetail";
import { CreateEmployeeModal } from "@features/employee/components/CreateEmployeeModal";
import { BulkTerminateDialog } from "@features/employee/components/BulkTerminateDialog";
import { ContractRemindersCard } from "@features/employee/components/ContractRemindersCard";
import { ImportEmployeesDialog } from "@features/employee/components/ImportEmployeesDialog";
import { SavedFilters, type FilterState } from "@features/employee/components/SavedFilters";
import { EMP_STATUS, EMP_TYPE, formatDate, toEmployeeView } from "@features/employee/constants";
import type {
  EmployeeStats, EmployeeStatus, EmployeeView, ListMeta,
} from "@features/employee/types/employee.types";

type ChipKey = "blue" | "emerald" | "violet" | "amber";
const CHIP: Record<ChipKey, { bg: string; ink: string }> = {
  blue: { bg: "var(--chip-blue-bg)", ink: "var(--chip-blue-ink)" },
  emerald: { bg: "var(--chip-emerald-bg)", ink: "var(--chip-emerald-ink)" },
  violet: { bg: "var(--chip-violet-bg)", ink: "var(--chip-violet-ink)" },
  amber: { bg: "var(--chip-amber-bg)", ink: "var(--chip-amber-ink)" },
};

const MANAGE_ROLES = ["admin", "hr_manager"];
const PAGE_SIZE = 20;

interface Option { value: string; label: string }

const STATUS_OPTIONS: Option[] = [
  { value: "", label: "Tất cả" },
  { value: "onboarding,active,on_leave", label: "Đang hoạt động" },
  { value: "terminated", label: "Ngừng hoạt động" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Đang làm việc" },
  { value: "on_leave", label: "Đang nghỉ" },
];

const TYPE_OPTIONS: Option[] = [
  { value: "", label: "Tất cả" },
  ...Object.entries(EMP_TYPE).map(([value, label]) => ({ value, label: String(label) })),
];

function StatCard({
  chip, icon: Icon, label, value,
}: { chip: ChipKey; icon: LucideIcon; label: string; value: number | string }) {
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span className="flex size-11 items-center justify-center rounded-2xl" style={{ background: CHIP[chip].bg, color: CHIP[chip].ink }}>
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div>
        <div className="text-[22px] font-bold leading-none tabular-nums text-foreground">{value}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function FilterPill({
  label, value, options, onChange,
}: { label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "";
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <span className="text-muted-foreground">{label}:</span> {current}
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-11 z-30 max-h-[320px] min-w-[200px] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-md">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                  value === o.value && "font-semibold text-primary-600",
                )}
              >
                {o.label}
                {value === o.value && <Check className="size-3.5" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={cn("px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>{children}</th>
);
const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

export default function EmployeesPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = roles.some((r) => MANAGE_ROLES.includes(r));

  const [rows, setRows] = useState<EmployeeView[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [deptOptions, setDeptOptions] = useState<Option[]>([{ value: "", label: "Tất cả" }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [employeeType, setEmployeeType] = useState("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [selected, setSelected] = useState<EmployeeView | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Server-side filters (department, status, page). Search `q` is applied
  // client-side over the loaded page — see edit.md for server-side search.
  const loadList = useCallback(
    () =>
      employeeService
        .list({
          page, limit: PAGE_SIZE,
          departmentId: dept || undefined,
          status: status || undefined,
          employeeType: employeeType || undefined,
          q: debouncedQ.trim() || undefined,
        })
        .then(({ items, meta: m }) => {
          setRows(items.map(toEmployeeView));
          setMeta(m);
          setSelectedIds(new Set());
          setError(null);
        })
        .catch(() => setError("Không thể tải danh sách nhân viên từ máy chủ."))
        .finally(() => setLoading(false)),
    [page, dept, status, employeeType, debouncedQ],
  );

  // Initial loading state is `true`; filter/pagination handlers flip it back on
  // before changing deps, so the effect only needs to kick the fetch.
  useEffect(() => { void loadList(); }, [loadList]);

  // Debounce the search box into the server-side query (`debouncedQ`).
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // Stats + department options load once.
  useEffect(() => {
    let cancelled = false;
    employeeService.stats().then((s) => { if (!cancelled) setStats(s); }).catch(() => {});
    organizationService
      .departmentsFlat()
      .then((nodes) => {
        if (!cancelled)
          setDeptOptions([{ value: "", label: "Tất cả" }, ...nodes.map((n) => ({ value: n.id, label: n.name }))]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function refresh() { setLoading(true); void loadList(); }

  function reloadAll() {
    setLoading(true);
    void loadList();
    employeeService.stats().then(setStats).catch(() => {});
  }

  // Search + filters are applied server-side; the page rows are already filtered.
  const filtered = rows;

  // Only active-group employees can be bulk-terminated.
  const selectableRows = useMemo(() => filtered.filter((e) => EMP_STATUS[e.status].group === "active"), [filtered]);
  const allSelected = selectableRows.length > 0 && selectableRows.every((e) => selectedIds.has(e.id));

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableRows.map((e) => e.id)));
  }

  function handleStatusChange(next: EmployeeStatus) {
    if (!selected) return;
    const target = selected;
    setSelected({ ...target, status: next });
    setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: next } : r)));
    employeeService
      .updateStatus(target.id, next)
      .then(() => employeeService.stats().then(setStats).catch(() => {}))
      .catch(() => { reloadAll(); });
  }

  function handleAccountGranted() {
    if (selected) setSelected({ ...selected, userId: "granted" });
    reloadAll();
  }

  const [exporting, setExporting] = useState(false);
  function exportExcel() {
    setExporting(true);
    employeeService
      .exportCsv({
        departmentId: dept || undefined,
        status: status || undefined,
        employeeType: employeeType || undefined,
        q: debouncedQ.trim() || undefined,
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nhan-vien.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("Không thể xuất dữ liệu."))
      .finally(() => setExporting(false));
  }

  function setFilter(setter: (v: string) => void, v: string) {
    setLoading(true);
    setter(v);
    setPage(1);
  }

  function applyView(f: FilterState) {
    setLoading(true);
    setDept(f.dept);
    setStatus(f.status);
    setEmployeeType(f.employeeType);
    setQ(f.q);
    setDebouncedQ(f.q);
    setPage(1);
  }

  function goToPage(next: number) {
    setLoading(true);
    setPage(next);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="emp" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Nhân viên"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
            {/* header */}
            <div className="flex items-end justify-between gap-6">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Nhân viên</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Quản lý hồ sơ, hợp đồng và thông tin nhân sự toàn công ty.
                  {loading && " · đang đồng bộ…"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]" onClick={refresh} disabled={loading}>
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} strokeWidth={1.9} /> Làm mới
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={exporting} className="h-9 gap-2 rounded-full text-[13px]">
                  <Download className={cn("size-3.5", exporting && "animate-pulse")} strokeWidth={1.8} /> Xuất Excel
                </Button>
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-9 gap-2 rounded-full text-[13px]">
                    <Upload className="size-3.5" strokeWidth={1.9} /> Nhập CSV
                  </Button>
                )}
                {canManage && (
                  <Button onClick={() => setCreating(true)} size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                    <UserPlus className="size-3.5" strokeWidth={1.9} /> Tạo nhân viên
                  </Button>
                )}
              </div>
            </div>

            {canManage && <ContractRemindersCard onLocate={(code) => { setQ(code); setPage(1); }} />}

            {/* stat strip */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard chip="blue" icon={Users} label="Tổng nhân viên" value={stats?.total ?? "—"} />
              <StatCard chip="emerald" icon={UserCheck} label="Đang làm việc" value={stats?.active ?? "—"} />
              <StatCard chip="violet" icon={UserPlus} label="Đang onboarding" value={stats?.onboarding ?? "—"} />
              <StatCard chip="amber" icon={CalendarDays} label="Đang nghỉ phép" value={stats?.onLeave ?? "—"} />
            </div>

            {error && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
                <span>{error}</span>
                <Button variant="outline" size="sm" className="h-7" onClick={refresh}>Thử lại</Button>
              </div>
            )}

            {canManage && selectedIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-2.5 text-[13px]">
                <span className="font-medium text-foreground">Đã chọn <b className="tabular-nums">{selectedIds.size}</b> nhân viên</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={() => setBulkOpen(true)}>
                    <UserX className="size-3.5" /> Cho nghỉ việc
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setSelectedIds(new Set())} aria-label="Bỏ chọn">
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* table */}
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã NV, chức vụ…" className="h-9 pl-10 text-[13px]" />
                </div>
                <FilterPill label="Phòng ban" value={dept} options={deptOptions} onChange={(v) => setFilter(setDept, v)} />
                <FilterPill label="Trạng thái" value={status} options={STATUS_OPTIONS} onChange={(v) => setFilter(setStatus, v)} />
                <FilterPill label="Loại NV" value={employeeType} options={TYPE_OPTIONS} onChange={(v) => setFilter(setEmployeeType, v)} />
                <SavedFilters current={{ dept, status, employeeType, q }} onApply={applyView} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {canManage && (
                        <Th className="w-10 text-center">
                          <input type="checkbox" aria-label="Chọn tất cả" className="size-4 accent-primary align-middle"
                            checked={allSelected} onChange={toggleAll} disabled={selectableRows.length === 0} />
                        </Th>
                      )}
                      <Th className="w-12 text-center">STT</Th>
                      <Th>Nhân viên</Th><Th>Mã NV</Th><Th>Mã vân tay</Th>
                      <Th>Phòng ban</Th><Th>Chức vụ</Th>
                      <Th>Loại</Th><Th>Ngày vào</Th><Th>Trạng thái</Th>
                      <Th className="text-right">·</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td colSpan={canManage ? 11 : 10} className="px-4 py-3"><div className="h-8 animate-pulse rounded-lg bg-muted/60" /></td>
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={canManage ? 11 : 10} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Không tìm thấy nhân viên phù hợp.</td></tr>
                    ) : (
                      filtered.map((e, idx) => {
                        const g = EMP_STATUS[e.status].group;
                        return (
                          <tr key={e.id} onClick={() => setSelected(e)} className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                            {canManage && (
                              <Td className="text-center" >
                                <input type="checkbox" aria-label={`Chọn ${e.fullName}`} className="size-4 accent-primary align-middle disabled:opacity-40"
                                  checked={selectedIds.has(e.id)} disabled={g !== "active"}
                                  onClick={(ev) => ev.stopPropagation()}
                                  onChange={() => toggleOne(e.id)} />
                              </Td>
                            )}
                            <Td className="text-center text-[12px] tabular-nums text-muted-foreground">{(meta.page - 1) * meta.limit + idx + 1}</Td>
                            <Td>
                              <div className="flex items-center gap-3">
                                <Avatar className="size-9 text-[12px]"><AvatarFallback>{e.initials}</AvatarFallback></Avatar>
                                <div>
                                  <div className="font-semibold text-foreground">{e.fullName}</div>
                                  <div className="text-[12px] text-muted-foreground">{e.email || "—"}</div>
                                </div>
                              </div>
                            </Td>
                            <Td><span className="font-mono text-[12px] text-muted-foreground">{e.code}</span></Td>
                            <Td><span className="font-mono text-[12px] text-muted-foreground">{e.fingerprintId || "—"}</span></Td>
                            <Td><span className="text-foreground/80">{e.departmentName || "—"}</span></Td>
                            <Td><span className="text-foreground/80">{e.positionName || "—"}</span></Td>
                            <Td><span className="text-foreground/70">{EMP_TYPE[e.employeeType]}</span></Td>
                            <Td><span className="tabular-nums text-foreground/70">{formatDate(e.hireDate)}</span></Td>
                            <Td>
                              <Badge variant={g === "active" ? "emerald" : "slate"}>
                                {g === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}
                              </Badge>
                            </Td>
                            <Td className="text-right">
                              <ChevronRight className="ml-auto size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </Td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>Hiển thị <b className="text-foreground tabular-nums">{filtered.length}</b> / {meta.total} nhân viên</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={meta.page <= 1} onClick={() => goToPage(Math.max(1, page - 1))}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="px-2 tabular-nums">{meta.page} / {meta.totalPages}</span>
                  <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={meta.page >= meta.totalPages} onClick={() => goToPage(page + 1)}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {selected && (
        <EmployeeDetail
          key={selected.id}
          view={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onStatusChanged={handleStatusChange}
          onAccountGranted={handleAccountGranted}
          onUpdated={reloadAll}
          onDeleted={() => { setSelected(null); reloadAll(); }}
        />
      )}
      {creating && (
        <CreateEmployeeModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reloadAll(); }}
        />
      )}
      {bulkOpen && (
        <BulkTerminateDialog
          open
          onOpenChange={setBulkOpen}
          employeeIds={[...selectedIds]}
          onDone={() => { setSelectedIds(new Set()); reloadAll(); }}
        />
      )}
      {importOpen && (
        <ImportEmployeesDialog
          open
          onOpenChange={setImportOpen}
          onDone={reloadAll}
        />
      )}
    </div>
  );
}

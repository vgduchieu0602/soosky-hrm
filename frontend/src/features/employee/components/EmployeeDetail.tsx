import { useEffect, useState } from "react";
import {
  X, Phone, Mail, FileText, Briefcase, Laptop, History, IdCard, Plus,
  Key, RefreshCw, Send, Power, Pencil, ChevronDown, Check, Trash2, RotateCcw,
  Paperclip, Download, Loader2, Camera,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import { uploadFile, signDownload, type UploadScope } from "@/shared/utils/upload";
import { employeeService } from "@features/employee/services/employee.service";
import { EmployeeEditModal } from "@features/employee/components/EmployeeEditModal";
import {
  CONTRACT_TYPE, COND, DOC_TYPE, EMP_STATUS, EMP_TYPE, GENDER, HIST_EVENT,
  MARITAL, REL, ROLE, SALARY_ZONE_LABEL, STATUS_ACTIVE, STATUS_INACTIVE,
  formatDate, formatMoney, fullNameOf, parseDecimal,
} from "@features/employee/constants";
import type {
  AccountView, EmployeeAssetRecord, EmployeeContactRecord, EmployeeContractRecord,
  EmployeeDocumentRecord, EmployeeHistoryRecord, EmployeeProfile,
  EmployeeStatus, EmployeeView,
} from "@features/employee/types/employee.types";

const CHIP = (c: string) => ({ background: `var(--chip-${c}-bg)`, color: `var(--chip-${c}-ink)` });
const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

interface Props {
  view: EmployeeView;
  canManage: boolean;
  onClose: () => void;
  onStatusChanged: (next: EmployeeStatus) => void;
  onAccountGranted: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

const TABS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "profile", label: "Hồ sơ", Icon: IdCard },
  { id: "account", label: "Tài khoản", Icon: Key },
  { id: "contacts", label: "Liên hệ", Icon: Phone },
  { id: "documents", label: "Tài liệu", Icon: FileText },
  { id: "contracts", label: "Hợp đồng", Icon: Briefcase },
  { id: "assets", label: "Tài sản", Icon: Laptop },
  { id: "history", label: "Lịch sử", Icon: History },
];

export function EmployeeDetail({ view, canManage, onClose, onStatusChanged, onAccountGranted, onUpdated, onDeleted }: Props) {
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [profileKey, setProfileKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    employeeService
      .remove(view.id)
      .then(() => { setConfirmDelete(false); onDeleted?.(); })
      .catch((e) => setDeleteError(e?.response?.data?.error?.message ?? "Không thể xoá nhân viên."))
      .finally(() => setDeleting(false));
  }

  useEffect(() => {
    let cancelled = false;
    employeeService
      .getById(view.id)
      .then((rec) => { if (!cancelled) setProfile((rec.profile as EmployeeProfile) ?? null); })
      .catch(() => { if (!cancelled) setProfile(null); });
    return () => { cancelled = true; };
  }, [view.id, profileKey]);

  const st = EMP_STATUS[view.status];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]" style={{ animation: "fadeIn .2s ease" }} onClick={onClose} />
      <div className="relative flex h-full w-[560px] max-w-[92vw] flex-col bg-background shadow-2xl" style={{ animation: "slideOver .28s cubic-bezier(.2,.8,.2,1)" }}>
        {/* header */}
        <div className="relative shrink-0 px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <button type="button" onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-4">
            <AvatarUploader
              employeeId={view.id}
              avatarKey={profile?.avatarUrl}
              initials={view.initials}
              canManage={canManage}
              onChanged={() => setProfileKey((k) => k + 1)}
            />
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold tracking-tight">{view.fullName}</h2>
              <div className="mt-0.5 text-[13px] text-white/70">{view.positionName || "—"} · {view.departmentName || "—"}</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[12px] text-white/50">
                {view.code}{view.fingerprintId ? ` · Vân tay ${view.fingerprintId}` : ""}
              </div>
            </div>
          </div>
          <div className="mt-4">
            {canManage ? (
              <StatusSelect value={view.status} onChange={onStatusChanged} />
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Badge variant={st.variant as any}>{st.label}</Badge>
            )}
          </div>
          {canManage && (
            <div className="mt-5 flex gap-2">
              <Button size="sm" onClick={() => setEditing(true)} className="h-8 gap-1.5 rounded-lg bg-white/15 text-[12.5px] text-white hover:bg-white/25"><Pencil className="size-3.5" /> Chỉnh sửa</Button>
              {view.personalEmail && (
                <a href={`mailto:${view.personalEmail}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-[12.5px] text-white transition hover:bg-white/25"><Mail className="size-3.5" /> Gửi email</a>
              )}
              <Button size="sm" onClick={() => setConfirmDelete(true)} className="h-8 gap-1.5 rounded-lg bg-rose-500/90 text-[12.5px] text-white hover:bg-rose-500"><Trash2 className="size-3.5" /> Xoá</Button>
            </div>
          )}
        </div>

        {/* tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-4">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                tab === id ? "border-primary-500 text-primary-600" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <Icon className="size-4" strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          {tab === "profile" && <ProfileTab view={view} profile={profile} />}
          {tab === "account" && <AccountTab view={view} canManage={canManage} onGranted={onAccountGranted} />}
          {tab === "contacts" && <ContactsTab employeeId={view.id} canManage={canManage} />}
          {tab === "documents" && <DocumentsTab employeeId={view.id} canManage={canManage} />}
          {tab === "contracts" && <ContractsTab employeeId={view.id} canManage={canManage} />}
          {tab === "assets" && <AssetsTab employeeId={view.id} canManage={canManage} />}
          {tab === "history" && <HistoryTab employeeId={view.id} />}
        </div>
      </div>

      {editing && (
        <EmployeeEditModal
          view={view}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setProfileKey((k) => k + 1);
            onUpdated?.();
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]" onClick={() => !deleting && setConfirmDelete(false)} />
          <div className="relative w-full max-w-[440px] rounded-2xl bg-background p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600"><Trash2 className="size-5" /></span>
              <div>
                <h3 className="text-[16px] font-bold text-foreground">Xoá nhân viên?</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Xoá vĩnh viễn <b className="text-foreground">{view.fullName}</b> ({view.code}) cùng toàn bộ hồ sơ,
                  hợp đồng, tài liệu, tài sản{view.userId ? " và tài khoản đăng nhập" : ""}. Hành động không thể hoàn tác.
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">Gợi ý: nếu chỉ nghỉ việc, hãy đổi trạng thái sang “Đã nghỉ” thay vì xoá.</p>
              </div>
            </div>
            {deleteError && <p className="mt-3 text-[12.5px] text-destructive">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" disabled={deleting} onClick={() => setConfirmDelete(false)} className="rounded-xl">Huỷ</Button>
              <Button disabled={deleting} onClick={handleDelete} className="gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-600">
                <Trash2 className="size-4" /> {deleting ? "Đang xoá…" : "Xoá vĩnh viễn"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== StatusSelect =====================
function StatusSelect({ value, onChange }: { value: EmployeeStatus; onChange: (s: EmployeeStatus) => void }) {
  const [open, setOpen] = useState(false);
  const st = EMP_STATUS[value];
  const Item = ({ k }: { k: EmployeeStatus }) => (
    <button type="button" onClick={() => { onChange(k); setOpen(false); }}
      className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12.5px] transition-colors hover:bg-muted", value === k && "bg-muted font-semibold")}>
      <span className="inline-flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: `var(--chip-${EMP_STATUS[k].variant}-ink)` }} />
        {EMP_STATUS[k].label}
      </span>
      {value === k && <Check className="size-3.5 text-primary-600" strokeWidth={2.4} />}
    </button>
  );
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold transition hover:ring-2 hover:ring-primary-200" style={CHIP(st.variant)}>
        {st.label} <ChevronDown className="size-3 opacity-70" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-50 w-[210px] rounded-xl border bg-card p-1.5 text-left text-foreground shadow-md">
            <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Đang hoạt động</div>
            {STATUS_ACTIVE.map((k) => <Item key={k} k={k} />)}
            <div className="my-1 h-px bg-border" />
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-500">Ngừng hoạt động</div>
            {STATUS_INACTIVE.map((k) => <Item key={k} k={k} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ===================== shared primitives =====================
function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-[13.5px] text-foreground", mono && "font-mono")}>{value || "—"}</div>
    </div>
  );
}
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}
function TabLoading() {
  return <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />)}</div>;
}
function TabEmpty({ text }: { text: string }) {
  return <div className="py-8 text-center text-[13px] text-muted-foreground">{text}</div>;
}
function LabeledInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// File picker that uploads straight to object storage and reports back the key.
function FileUploadField({
  scope, ownerId, value, onUploaded, onClear,
}: {
  scope: UploadScope;
  ownerId?: string;
  value?: string;
  onUploaded: (key: string) => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    setFailed(false);
    uploadFile(file, scope, ownerId)
      .then((key) => onUploaded(key))
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }

  return (
    <div>
      {value ? (
        <div className="flex h-9 items-center justify-between rounded-lg border border-input bg-card px-3 text-[13px]">
          <span className="flex items-center gap-1.5 truncate text-emerald-600">
            <Check className="size-3.5 shrink-0" /> Đã đính kèm tệp
          </span>
          <button type="button" onClick={onClear} className="ml-2 cursor-pointer text-muted-foreground hover:text-rose-600">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <label className={cn(inputCls, "cursor-pointer items-center gap-1.5 text-muted-foreground", busy && "opacity-60")}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          <span className="truncate">{busy ? "Đang tải lên…" : "Chọn tệp để tải lên"}</span>
          <input type="file" className="hidden" disabled={busy} onChange={pick} />
        </label>
      )}
      {failed && <div className="mt-1 text-[11px] text-rose-600">Tải tệp thất bại, thử lại.</div>}
    </div>
  );
}

// Opens a stored object via a short-lived signed URL.
function DownloadLink({ fileKey, label }: { fileKey: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  function open() {
    setBusy(true);
    signDownload(fileKey)
      .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
      .catch(() => {})
      .finally(() => setBusy(false));
  }
  return (
    <button type="button" onClick={open} disabled={busy}
      className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-primary-600 hover:underline disabled:opacity-60">
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {label ?? "Tải tệp"}
    </button>
  );
}

// Header avatar with inline upload (resolves the stored key to a signed URL for display).
function AvatarUploader({
  employeeId, avatarKey, initials, canManage, onChanged,
}: {
  employeeId: string;
  avatarKey?: string;
  initials: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!avatarKey) return;
    let cancelled = false;
    signDownload(avatarKey)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [avatarKey]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    uploadFile(file, "avatar", employeeId)
      .then((key) => employeeService.updateProfile(employeeId, { avatarUrl: key }))
      .then(() => onChanged())
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <div className="relative shrink-0">
      <Avatar className="size-16 bg-white/10 text-[20px] text-white ring-2 ring-white/20">
        {avatarKey && url && <AvatarImage src={url} alt={initials} />}
        <AvatarFallback className="bg-transparent text-white">{initials}</AvatarFallback>
      </Avatar>
      {canManage && (
        <label className={cn(
          "absolute -bottom-1 -right-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-white text-secondary-900 shadow ring-2 ring-[#163985] transition hover:bg-white/90",
          busy && "pointer-events-none opacity-60",
        )} title="Đổi ảnh đại diện">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={pick} />
        </label>
      )}
    </div>
  );
}

// per-tab fetch with a reload key
function useResource<T>(fetcher: () => Promise<T[]>, dep: string) {
  const [state, setState] = useState<{ loading: boolean; items: T[]; error: boolean }>({
    loading: true, items: [], error: false,
  });
  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((items) => { if (!cancelled) setState({ loading: false, items, error: false }); })
      .catch(() => { if (!cancelled) setState({ loading: false, items: [], error: true }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return state;
}

// ===================== Profile =====================
function ProfileTab({ view, profile }: { view: EmployeeView; profile: EmployeeProfile | null }) {
  const dob = formatDate(profile?.dateOfBirth ?? view.dateOfBirth);
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Thông tin cá nhân">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Họ và tên" value={fullNameOf(profile?.firstName ?? view.firstName, profile?.lastName ?? view.lastName, profile?.middleName ?? view.middleName) || view.fullName} />
          <Field label="Ngày sinh" value={dob} />
          <Field label="Giới tính" value={(profile?.gender && GENDER[profile.gender]) || (view.gender ? GENDER[view.gender] : "")} />
          <Field label="Tình trạng hôn nhân" value={(profile?.maritalStatus && MARITAL[profile.maritalStatus]) || (view.maritalStatus ? MARITAL[view.maritalStatus] : "")} />
          <Field label="Quốc tịch" value={profile?.nationality ?? view.nationality} />
          <Field label="Điện thoại" value={profile?.phone ?? view.phone} mono />
          <Field label="Email công ty" value={profile?.workEmail ?? view.email} />
          <Field label="Email cá nhân" value={profile?.email ?? view.personalEmail} />
          <div className="col-span-2"><Field label="Địa chỉ" value={profile?.address ?? view.address} /></div>
        </div>
      </Panel>
      <Panel title="Thông tin công việc">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Mã nhân viên" value={view.code} mono />
          <Field label="Mã vân tay" value={view.fingerprintId} mono />
          <Field label="Phòng ban" value={view.departmentName} />
          <Field label="Chức vụ" value={view.positionName} />
          <Field label="Quản lý trực tiếp" value={view.managerName} />
          <Field label="Loại hợp đồng" value={EMP_TYPE[view.employeeType]} />
          <Field label="Ngày vào làm" value={formatDate(view.hireDate)} />
          <Field label="Vùng lương" value={view.salaryZone ? SALARY_ZONE_LABEL[view.salaryZone] : ""} />
          <Field label="Trạng thái" value={EMP_STATUS[view.status].label} />
        </div>
      </Panel>
    </div>
  );
}

// ===================== Account =====================
function AccountTab({ view, canManage, onGranted }: { view: EmployeeView; canManage: boolean; onGranted: () => void }) {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [sendInvite, setSendInvite] = useState(true);

  useEffect(() => {
    let cancelled = false;
    employeeService
      .account(view.id)
      .then((a) => { if (!cancelled) { setAccount(a); setLoading(false); } })
      .catch(() => { if (!cancelled) { setAccount(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [view.id, reloadKey]);

  function run(p: Promise<unknown>, ok: string) {
    setBusy(true); setMsg(null); setError(null);
    p.then(() => { setMsg(ok); setReloadKey((k) => k + 1); })
      .catch((e) => setError(e?.response?.data?.error?.message ?? "Thao tác thất bại."))
      .finally(() => setBusy(false));
  }

  function grant() {
    setBusy(true); setMsg(null); setError(null);
    employeeService
      .grantLogin(view.id, { username: username.trim() || undefined, sendEmail: sendInvite })
      .then(() => { onGranted(); setReloadKey((k) => k + 1); setMsg("Đã cấp tài khoản & gửi lời mời."); })
      .catch((e) => setError(e?.response?.data?.error?.message ?? "Không thể cấp tài khoản."))
      .finally(() => setBusy(false));
  }

  if (loading) return <TabLoading />;

  const hasAccount = account?.hasAccount === true;

  if (!hasAccount) {
    return (
      <div className="flex flex-col gap-5">
        <Panel title="Tài khoản hệ thống">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full" style={CHIP("blue")}><Key className="size-5" strokeWidth={1.7} /></span>
            <div>
              <div className="text-[14px] font-semibold text-foreground">Chưa có tài khoản đăng nhập</div>
              <p className="mx-auto mt-1 max-w-[300px] text-[12.5px] text-muted-foreground">Admin/HR cấp tài khoản để nhân viên tự đăng nhập vào hệ thống.</p>
            </div>
          </div>
        </Panel>
        {canManage && (
          <Panel title="Cấp tài khoản">
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tên đăng nhập (email cá nhân)</div>
                <div className="mt-1.5 flex h-10 items-center rounded-lg border bg-muted/40 px-3 font-mono text-[13px] text-foreground">{view.personalEmail || "Chưa có email cá nhân trên hồ sơ"}</div>
              </div>
              <LabeledInput label="Tên đăng nhập tuỳ chọn (không bắt buộc)">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="vd: lan.nt" className={cn(inputCls, "h-10 font-mono")} />
              </LabeledInput>
              <label className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3 text-[13px]">
                <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="size-4 accent-primary-500" />
                <span className="flex-1 text-foreground">Gửi email lời mời kích hoạt tới nhân viên</span>
                <Mail className="size-4 text-muted-foreground" />
              </label>
              {error && <p className="text-[12.5px] text-destructive">{error}</p>}
              {msg && <p className="text-[12.5px] text-emerald-600">{msg}</p>}
              <Button onClick={grant} disabled={busy || !view.personalEmail} className="gap-2 rounded-xl">
                <Key className="size-4" strokeWidth={1.8} /> {busy ? "Đang cấp…" : "Cấp tài khoản & gửi lời mời"}
              </Button>
            </div>
          </Panel>
        )}
      </div>
    );
  }

  const disabled = account.status === "disabled";
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Tài khoản hệ thống" action={<Badge variant={disabled ? "slate" : "emerald"}>{disabled ? "Đã vô hiệu hoá" : "Đang hoạt động"}</Badge>}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Tên đăng nhập" value={account.username} mono />
          <Field label="Vai trò" value={ROLE[account.role] ?? account.role} />
          <Field label="Email" value={account.email} />
          <Field label="Đăng nhập gần nhất" value={account.lastLoginAt ? formatDate(account.lastLoginAt) : "Chưa đăng nhập"} />
          <Field label="Đổi mật khẩu lần đầu" value={account.mustChangePassword ? "Bắt buộc" : "Không"} />
          <Field label="Xác thực 2 lớp" value={account.mfaEnabled ? "Đã bật" : "Chưa bật"} />
        </div>
      </Panel>
      {canManage && (
        <Panel title="Thao tác">
          {error && <p className="mb-2 text-[12.5px] text-destructive">{error}</p>}
          {msg && <p className="mb-2 text-[12.5px] text-emerald-600">{msg}</p>}
          <div className="mb-4">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Vai trò</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(ROLE).map((r) => (
                <button key={r} type="button" disabled={busy || account.role === r}
                  onClick={() => run(employeeService.updateAccount(view.id, { role: r }), `Đã đổi vai trò sang ${ROLE[r]}.`)}
                  className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-[12.5px] font-medium transition disabled:opacity-100",
                    account.role === r ? "border-primary-500 bg-primary-50 text-primary-700" : "text-foreground hover:bg-muted")}>
                  {ROLE[r]}{account.role === r && <Check className="size-3.5" strokeWidth={2.4} />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(employeeService.resetPassword(view.id), "Đã gửi liên kết đặt lại mật khẩu tới email.")} className="justify-start gap-2.5 rounded-xl">
              <RefreshCw className="size-4" strokeWidth={1.8} /> Đặt lại mật khẩu
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => run(employeeService.resendInvite(view.id), "Đã gửi lại email kích hoạt tài khoản.")} className="justify-start gap-2.5 rounded-xl">
              <Send className="size-4" strokeWidth={1.8} /> Gửi lại email lời mời
            </Button>
            {disabled ? (
              <Button disabled={busy} onClick={() => run(employeeService.updateAccount(view.id, { status: "active" }), "Đã kích hoạt lại tài khoản.")} className="justify-start gap-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600">
                <Power className="size-4" strokeWidth={1.8} /> Kích hoạt lại tài khoản
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => run(employeeService.updateAccount(view.id, { status: "disabled" }), "Đã vô hiệu hoá đăng nhập.")} className="justify-start gap-2.5 rounded-xl text-rose-600 hover:border-rose-200 hover:bg-rose-50">
                <Power className="size-4" strokeWidth={1.8} /> Vô hiệu hoá đăng nhập
              </Button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ===================== Contacts =====================
function ContactsTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const [rk, setRk] = useState(0);
  const [adding, setAdding] = useState(false);
  const { loading, items, error } = useResource<EmployeeContactRecord>(() => employeeService.contacts(employeeId), `${employeeId}:${rk}`);
  const emptyForm = { name: "", relationship: "spouse", phone: "", isPrimary: false };
  const [f, setF] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  function remove(contactId: string) {
    setRemoving(contactId);
    employeeService
      .deleteContact(employeeId, contactId)
      .then(() => setRk((k) => k + 1))
      .catch(() => {})
      .finally(() => setRemoving(null));
  }

  function startEdit(c: EmployeeContactRecord) {
    setEditingId(c._id);
    setF({ name: c.name, relationship: c.relationship, phone: c.phone ?? "", isPrimary: !!c.isPrimary });
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setF(emptyForm);
  }

  function save() {
    setBusy(true);
    const payload = { name: f.name.trim(), relationship: f.relationship as EmployeeContactRecord["relationship"], phone: f.phone.trim() || undefined, isPrimary: f.isPrimary };
    const req = editingId
      ? employeeService.updateContact(employeeId, editingId, payload)
      : employeeService.addContact(employeeId, payload);
    req
      .then(() => { closeForm(); setRk((k) => k + 1); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <Panel title="Người liên hệ khẩn cấp" action={canManage && <Button variant="outline" size="sm" onClick={() => (adding ? closeForm() : setAdding(true))} className="h-8 gap-1.5 rounded-lg text-[12.5px]"><Plus className="size-3.5" /> Thêm</Button>}>
      {adding && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3.5">
          <LabeledInput label="Họ tên"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></LabeledInput>
          <LabeledInput label="Quan hệ">
            <select className={inputCls} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>
              <option value="spouse">Vợ/Chồng</option><option value="parent">Cha/Mẹ</option><option value="sibling">Anh/Chị/Em</option><option value="other">Khác</option>
            </select>
          </LabeledInput>
          <LabeledInput label="Điện thoại"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></LabeledInput>
          <label className="flex items-end gap-2 pb-1 text-[12.5px]"><input type="checkbox" checked={f.isPrimary} onChange={(e) => setF({ ...f, isPrimary: e.target.checked })} className="size-4 accent-primary-500" /> Liên hệ chính</label>
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeForm} className="rounded-lg">Huỷ</Button>
            <Button size="sm" disabled={busy || !f.name.trim()} onClick={save} className="rounded-lg">{editingId ? "Cập nhật" : "Lưu"}</Button>
          </div>
        </div>
      )}
      {loading ? <TabLoading /> : error ? <TabEmpty text="Không tải được liên hệ." /> :
        items.length === 0 ? <TabEmpty text="Chưa có người liên hệ nào." /> : (
          <div className="flex flex-col gap-3">
            {items.map((c) => (
              <div key={c._id} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3.5">
                <Avatar className="size-10 text-[13px]"><AvatarFallback>{c.name.split(" ").slice(-1)[0]?.[0] ?? "?"}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-foreground">{c.name}</span>
                    {c.isPrimary && <Badge variant="blue" className="text-[10px]">Chính</Badge>}
                  </div>
                  <div className="text-[12px] text-muted-foreground">{REL[c.relationship] ?? c.relationship} · <span className="font-mono">{c.phone ?? "—"}</span></div>
                </div>
                {c.phone && <a href={`tel:${c.phone}`} className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"><Phone className="size-4 text-muted-foreground" /></a>}
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(c)} className="size-8 text-muted-foreground hover:text-primary-600"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={removing === c._id} onClick={() => remove(c._id)} className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
    </Panel>
  );
}

// ===================== Documents =====================
function DocumentsTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const [rk, setRk] = useState(0);
  const [adding, setAdding] = useState(false);
  const { loading, items, error } = useResource<EmployeeDocumentRecord>(() => employeeService.documents(employeeId), `${employeeId}:${rk}`);
  const emptyForm = { documentType: "id_card", documentNumber: "", issuedDate: "", expiryDate: "", issuedBy: "", fileUrl: "" };
  const [f, setF] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  function remove(docId: string) {
    setRemoving(docId);
    employeeService
      .deleteDocument(employeeId, docId)
      .then(() => setRk((k) => k + 1))
      .catch(() => {})
      .finally(() => setRemoving(null));
  }

  function startEdit(d: EmployeeDocumentRecord) {
    setEditingId(d._id);
    setF({
      documentType: d.documentType,
      documentNumber: d.documentNumber,
      issuedDate: d.issuedDate ? d.issuedDate.slice(0, 10) : "",
      expiryDate: d.expiryDate ? d.expiryDate.slice(0, 10) : "",
      issuedBy: d.issuedBy ?? "",
      fileUrl: d.fileUrl ?? "",
    });
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setF(emptyForm);
  }

  function save() {
    setBusy(true);
    const payload = {
      documentType: f.documentType as EmployeeDocumentRecord["documentType"],
      documentNumber: f.documentNumber.trim(),
      issuedDate: f.issuedDate || undefined,
      expiryDate: f.expiryDate || undefined,
      issuedBy: f.issuedBy.trim() || undefined,
      fileUrl: f.fileUrl || undefined,
    };
    const req = editingId
      ? employeeService.updateDocument(employeeId, editingId, payload)
      : employeeService.addDocument(employeeId, payload);
    req
      .then(() => { closeForm(); setRk((k) => k + 1); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <Panel title="Tài liệu & giấy tờ" action={canManage && <Button variant="outline" size="sm" onClick={() => (adding ? closeForm() : setAdding(true))} className="h-8 gap-1.5 rounded-lg text-[12.5px]"><Plus className="size-3.5" /> Thêm</Button>}>
      {adding && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3.5">
          <LabeledInput label="Loại giấy tờ">
            <select className={inputCls} value={f.documentType} onChange={(e) => setF({ ...f, documentType: e.target.value })}>
              {Object.entries(DOC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </LabeledInput>
          <LabeledInput label="Số"><input className={inputCls} value={f.documentNumber} onChange={(e) => setF({ ...f, documentNumber: e.target.value })} /></LabeledInput>
          <LabeledInput label="Ngày cấp"><DateField className={inputCls} value={f.issuedDate} onChange={(iso) => setF({ ...f, issuedDate: iso })} /></LabeledInput>
          <LabeledInput label="Hết hạn"><DateField className={inputCls} value={f.expiryDate} onChange={(iso) => setF({ ...f, expiryDate: iso })} /></LabeledInput>
          <LabeledInput label="Nơi cấp"><input className={inputCls} value={f.issuedBy} onChange={(e) => setF({ ...f, issuedBy: e.target.value })} /></LabeledInput>
          <div className="col-span-2">
            <LabeledInput label="Tệp đính kèm">
              <FileUploadField scope="document" ownerId={employeeId} value={f.fileUrl}
                onUploaded={(key) => setF((s) => ({ ...s, fileUrl: key }))}
                onClear={() => setF((s) => ({ ...s, fileUrl: "" }))} />
            </LabeledInput>
          </div>
          <div className="col-span-2 flex items-end justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeForm} className="rounded-lg">Huỷ</Button>
            <Button size="sm" disabled={busy || !f.documentNumber.trim()} onClick={save} className="rounded-lg">{editingId ? "Cập nhật" : "Lưu"}</Button>
          </div>
        </div>
      )}
      {loading ? <TabLoading /> : error ? <TabEmpty text="Không tải được tài liệu." /> :
        items.length === 0 ? <TabEmpty text="Chưa có tài liệu nào." /> : (
          <div className="flex flex-col gap-2.5">
            {items.map((d) => (
              <div key={d._id} className="flex items-center gap-3 rounded-xl border p-3.5">
                <span className="flex size-10 items-center justify-center rounded-lg" style={CHIP("indigo")}><FileText className="size-5" strokeWidth={1.7} /></span>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-foreground">{DOC_TYPE[d.documentType] ?? d.documentType}</div>
                  <div className="text-[12px] text-muted-foreground">
                    Số: <span className="font-mono">{d.documentNumber}</span>
                    {d.issuedDate ? ` · Cấp ${formatDate(d.issuedDate)}` : ""}{d.expiryDate ? ` · HH ${formatDate(d.expiryDate)}` : ""}
                  </div>
                  {d.fileUrl && <div className="mt-1.5"><DownloadLink fileKey={d.fileUrl} /></div>}
                </div>
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(d)} className="size-8 text-muted-foreground hover:text-primary-600"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={removing === d._id} onClick={() => remove(d._id)} className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
    </Panel>
  );
}

// ===================== Contracts =====================
function ContractsTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const [rk, setRk] = useState(0);
  const [adding, setAdding] = useState(false);
  const { loading, items, error } = useResource<EmployeeContractRecord>(() => employeeService.contracts(employeeId), `${employeeId}:${rk}`);
  const emptyForm = { contractType: "probation", contractNumber: "", startDate: "", endDate: "", baseSalary: "", fileUrl: "" };
  const [f, setF] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(c: EmployeeContractRecord) {
    setEditingId(c._id);
    setF({
      contractType: c.contractType,
      contractNumber: c.contractNumber,
      startDate: c.startDate ? c.startDate.slice(0, 10) : "",
      endDate: c.endDate ? c.endDate.slice(0, 10) : "",
      baseSalary: String(parseDecimal(c.baseSalary) || ""),
      fileUrl: c.fileUrl ?? "",
    });
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setF(emptyForm);
  }

  function save() {
    setBusy(true);
    const payload = {
      contractType: f.contractType as EmployeeContractRecord["contractType"],
      contractNumber: f.contractNumber.trim(),
      startDate: f.startDate,
      endDate: f.endDate || undefined,
      baseSalary: Number(f.baseSalary) || 0,
      fileUrl: f.fileUrl || undefined,
    };
    const req = editingId
      ? employeeService.updateContract(employeeId, editingId, payload)
      : employeeService.addContract(employeeId, payload);
    req
      .then(() => { closeForm(); setRk((k) => k + 1); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <Panel title="Hợp đồng lao động" action={canManage && <Button variant="outline" size="sm" onClick={() => (adding ? closeForm() : setAdding(true))} className="h-8 gap-1.5 rounded-lg text-[12.5px]"><Plus className="size-3.5" /> Thêm</Button>}>
      {adding && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3.5">
          <LabeledInput label="Loại HĐ">
            <select className={inputCls} value={f.contractType} onChange={(e) => setF({ ...f, contractType: e.target.value })}>
              {Object.entries(CONTRACT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </LabeledInput>
          <LabeledInput label="Số HĐ"><input className={cn(inputCls, "font-mono")} value={f.contractNumber} onChange={(e) => setF({ ...f, contractNumber: e.target.value })} /></LabeledInput>
          <LabeledInput label="Bắt đầu"><DateField className={inputCls} value={f.startDate} onChange={(iso) => setF({ ...f, startDate: iso })} /></LabeledInput>
          <LabeledInput label="Kết thúc"><DateField className={inputCls} value={f.endDate} onChange={(iso) => setF({ ...f, endDate: iso })} /></LabeledInput>
          <LabeledInput label="Lương cơ bản (₫)"><input type="number" className={cn(inputCls, "font-mono")} value={f.baseSalary} onChange={(e) => setF({ ...f, baseSalary: e.target.value })} /></LabeledInput>
          <LabeledInput label="Tệp hợp đồng">
            <FileUploadField scope="contract" ownerId={employeeId} value={f.fileUrl}
              onUploaded={(key) => setF((s) => ({ ...s, fileUrl: key }))}
              onClear={() => setF((s) => ({ ...s, fileUrl: "" }))} />
          </LabeledInput>
          <div className="col-span-2 flex items-end justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeForm} className="rounded-lg">Huỷ</Button>
            <Button size="sm" disabled={busy || !f.contractNumber.trim() || !f.startDate} onClick={save} className="rounded-lg">{editingId ? "Cập nhật" : "Lưu"}</Button>
          </div>
        </div>
      )}
      {loading ? <TabLoading /> : error ? <TabEmpty text="Không tải được hợp đồng." /> :
        items.length === 0 ? <TabEmpty text="Chưa có hợp đồng nào." /> : (
          <div className="flex flex-col gap-3">
            {items.map((c) => (
              <div key={c._id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] font-semibold text-foreground">{c.contractNumber}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={c.status === "active" ? "emerald" : "slate"}>{c.status === "active" ? "Hiệu lực" : "Hết hiệu lực"}</Badge>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => startEdit(c)} className="size-8 text-muted-foreground hover:text-primary-600"><Pencil className="size-4" /></Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
                  <Field label="Loại" value={CONTRACT_TYPE[c.contractType] ?? c.contractType} />
                  <Field label="Lương cơ bản" value={`${formatMoney(c.baseSalary)} ₫`} />
                  <Field label="Bắt đầu" value={formatDate(c.startDate)} />
                  <Field label="Kết thúc" value={c.endDate ? formatDate(c.endDate) : "Không thời hạn"} />
                </div>
                {c.fileUrl && <div className="mt-3"><DownloadLink fileKey={c.fileUrl} label="Tải hợp đồng" /></div>}
              </div>
            ))}
          </div>
        )}
    </Panel>
  );
}

// ===================== Assets =====================
function AssetsTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const [rk, setRk] = useState(0);
  const [adding, setAdding] = useState(false);
  const { loading, items, error } = useResource<EmployeeAssetRecord>(() => employeeService.assets(employeeId), `${employeeId}:${rk}`);
  const emptyForm = { assetName: "", assetCode: "", assignedDate: "", condition: "good", note: "" };
  const [f, setF] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  function markReturned(assetId: string) {
    setActingId(assetId);
    employeeService
      .returnAsset(employeeId, assetId, {})
      .then(() => setRk((k) => k + 1))
      .catch(() => {})
      .finally(() => setActingId(null));
  }

  // Re-assign a previously returned asset (clear the returned date).
  function reassign(assetId: string) {
    setActingId(assetId);
    employeeService
      .updateAsset(employeeId, assetId, { returnedDate: null })
      .then(() => setRk((k) => k + 1))
      .catch(() => {})
      .finally(() => setActingId(null));
  }

  function remove(assetId: string) {
    setActingId(assetId);
    employeeService
      .deleteAsset(employeeId, assetId)
      .then(() => setRk((k) => k + 1))
      .catch(() => {})
      .finally(() => setActingId(null));
  }

  function startEdit(a: EmployeeAssetRecord) {
    setEditingId(a._id);
    setF({
      assetName: a.assetName,
      assetCode: a.assetCode,
      assignedDate: a.assignedDate ? a.assignedDate.slice(0, 10) : "",
      condition: a.condition,
      note: a.note ?? "",
    });
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setF(emptyForm);
  }

  function save() {
    setBusy(true);
    const payload = {
      assetName: f.assetName.trim(),
      assetCode: f.assetCode.trim(),
      assignedDate: f.assignedDate,
      condition: f.condition as EmployeeAssetRecord["condition"],
      note: f.note.trim() || undefined,
    };
    const req = editingId
      ? employeeService.updateAsset(employeeId, editingId, payload)
      : employeeService.addAsset(employeeId, payload);
    req
      .then(() => { closeForm(); setRk((k) => k + 1); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <Panel title="Tài sản được cấp" action={canManage && <Button variant="outline" size="sm" onClick={() => (adding ? closeForm() : setAdding(true))} className="h-8 gap-1.5 rounded-lg text-[12.5px]"><Plus className="size-3.5" /> Cấp tài sản</Button>}>
      {adding && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3.5">
          <LabeledInput label="Tên tài sản"><input className={inputCls} value={f.assetName} onChange={(e) => setF({ ...f, assetName: e.target.value })} /></LabeledInput>
          <LabeledInput label="Mã tài sản"><input className={cn(inputCls, "font-mono")} value={f.assetCode} onChange={(e) => setF({ ...f, assetCode: e.target.value })} /></LabeledInput>
          <LabeledInput label="Ngày cấp"><DateField className={inputCls} value={f.assignedDate} onChange={(iso) => setF({ ...f, assignedDate: iso })} /></LabeledInput>
          <LabeledInput label="Tình trạng">
            <select className={inputCls} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
              {Object.entries(COND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </LabeledInput>
          <div className="col-span-2 flex items-end justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeForm} className="rounded-lg">Huỷ</Button>
            <Button size="sm" disabled={busy || !f.assetName.trim() || !f.assetCode.trim() || !f.assignedDate} onClick={save} className="rounded-lg">{editingId ? "Cập nhật" : "Lưu"}</Button>
          </div>
        </div>
      )}
      {loading ? <TabLoading /> : error ? <TabEmpty text="Không tải được tài sản." /> :
        items.length === 0 ? <TabEmpty text="Chưa có tài sản nào được cấp." /> : (
          <div className="flex flex-col gap-2.5">
            {items.map((a) => (
              <div key={a._id} className="flex items-center gap-3 rounded-xl border p-3.5">
                <span className="flex size-10 items-center justify-center rounded-lg" style={CHIP("cyan")}><Laptop className="size-5" strokeWidth={1.7} /></span>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-foreground">{a.assetName}</div>
                  <div className="text-[12px] text-muted-foreground">
                    Mã: <span className="font-mono">{a.assetCode}</span> · Cấp {formatDate(a.assignedDate)}
                    {a.returnedDate ? ` · Đã thu hồi ${formatDate(a.returnedDate)}` : ""}
                  </div>
                </div>
                <Badge variant={a.returnedDate ? "slate" : "emerald"}>{a.returnedDate ? "Đã thu hồi" : (COND[a.condition] ?? a.condition)}</Badge>
                {canManage && (
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon" disabled={actingId === a._id} onClick={() => startEdit(a)} title="Chỉnh sửa" className="size-8 text-muted-foreground hover:text-primary-600"><Pencil className="size-4" /></Button>
                    {a.returnedDate ? (
                      <Button variant="ghost" size="icon" disabled={actingId === a._id} onClick={() => reassign(a._id)} title="Cấp lại tài sản" className="size-8 text-muted-foreground hover:text-emerald-600"><RotateCcw className="size-4" /></Button>
                    ) : (
                      <Button variant="ghost" size="icon" disabled={actingId === a._id} onClick={() => markReturned(a._id)} title="Thu hồi tài sản" className="size-8 text-muted-foreground hover:text-amber-600"><RotateCcw className="size-4" /></Button>
                    )}
                    <Button variant="ghost" size="icon" disabled={actingId === a._id} onClick={() => remove(a._id)} title="Xoá tài sản" className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </Panel>
  );
}

// ===================== History =====================
function HistoryTab({ employeeId }: { employeeId: string }) {
  const { loading, items, error } = useResource<EmployeeHistoryRecord>(() => employeeService.history(employeeId), employeeId);
  return (
    <Panel title="Lịch sử nhân sự">
      {loading ? <TabLoading /> : error ? <TabEmpty text="Không tải được lịch sử." /> :
        items.length === 0 ? <TabEmpty text="Chưa có sự kiện nào." /> : (
          <ol className="relative">
            <span className="pointer-events-none absolute bottom-2 left-[15px] top-2 w-px bg-border" />
            {items.map((h) => (
              <li key={h._id} className="relative flex items-start gap-3 py-2.5">
                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary-600"><History className="size-3.5" strokeWidth={1.8} /></span>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{HIST_EVENT[h.eventType] ?? h.eventType}</span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">{formatDate(h.effectiveDate)}</span>
                  </div>
                  {h.note && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{h.note}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
    </Panel>
  );
}

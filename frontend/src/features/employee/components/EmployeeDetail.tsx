import { useEffect, useState } from "react";
import {
  X, Phone, Mail, FileText, Briefcase, Laptop, History, IdCard, Plus,
  Key, RefreshCw, Send, Power, Pencil, ChevronDown, Check, Trash2, RotateCcw,
  Paperclip, Download, Loader2, Camera, Landmark, Eye, Filter,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import { uploadFile, signDownload, UPLOAD_RULES, type UploadScope } from "@/shared/utils/upload";
import { employeeService } from "@features/employee/services/employee.service";
import { iamService } from "@features/iam/services/iam.service";
import { EmployeeEditModal } from "@features/employee/components/EmployeeEditModal";
import { ProfileCompletenessCard } from "@features/employee/components/ProfileCompletenessCard";
import {
  CONTRACT_TYPE, EMPLOYMENT_STATUS, COND, DOC_TYPE, EMP_STATUS, EMP_TYPE, GENDER, HIST_EVENT,
  MARITAL, REL, ROLE, SALARY_ZONE_LABEL, STATUS_ACTIVE, STATUS_INACTIVE,
  formatDate, formatMoney, fullNameOf, parseDecimal,
} from "@features/employee/constants";
import type {
  AccountView, EmployeeAssetRecord, EmployeeBankAccountRecord, EmployeeContactRecord, EmployeeContractRecord,
  EmployeeDocumentRecord, EmployeeHistoryRecord, EmployeeProfile,
  EmployeeStatus, EmployeeView,
} from "@features/employee/types/employee.types";
import { bankService, type Bank } from "@features/settings/services/bank.service";

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
  { id: "bank", label: "Ngân hàng", Icon: Landmark },
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
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
          <div className="relative z-10 flex items-center gap-4">
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
          <div className="relative z-10 mt-4">
            {canManage ? (
              <StatusSelect value={view.status} onChange={onStatusChanged} />
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Badge variant={st.variant as any}>{st.label}</Badge>
            )}
          </div>
          {canManage && (
            <div className="relative z-10 mt-5 flex gap-2">
              <Button size="sm" onClick={() => setEditing(true)} className="h-8 gap-1.5 rounded-lg bg-white/15 text-[12.5px] text-white hover:bg-white/25"><Pencil className="size-3.5" /> Chỉnh sửa</Button>
              {view.personalEmail && (
                <a href={`mailto:${view.personalEmail}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-[12.5px] text-white transition hover:bg-white/25"><Mail className="size-3.5" /> Gửi email</a>
              )}
              <Button size="sm" onClick={() => setConfirmDelete(true)} className="h-8 gap-1.5 rounded-lg bg-rose-500/90 text-[12.5px] text-white hover:bg-rose-500"><Trash2 className="size-3.5" /> Xoá</Button>
            </div>
          )}
        </div>

        {/* tabs */}
        <div role="tablist" aria-label="Hồ sơ nhân viên" className="flex shrink-0 flex-wrap gap-1 border-b bg-card px-3 py-2">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} type="button" role="tab" aria-selected={active} onClick={() => setTab(id)}
                className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary-50 text-primary-700" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} /> {label}
              </button>
            );
          })}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          {tab === "profile" && (
            <>
              {canManage && <ProfileCompletenessCard employeeId={view.id} />}
              <ProfileTab view={view} profile={profile} />
            </>
          )}
          {tab === "account" && <AccountTab view={view} canManage={canManage} onGranted={onAccountGranted} />}
          {tab === "contacts" && <ContactsTab employeeId={view.id} canManage={canManage} />}
          {tab === "bank" && <BankAccountsTab employeeId={view.id} canManage={canManage} />}
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
  const empty = !value;
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className={cn("mt-1 truncate text-[14px] leading-snug", empty ? "text-muted-foreground/50" : "text-foreground", mono && "font-mono")} title={value || undefined}>
        {value || "—"}
      </div>
    </div>
  );
}
function Panel({ title, icon: Icon, tone = "cyan", action, children }: { title: string; icon?: LucideIcon; tone?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={CHIP(tone)} aria-hidden>
              <Icon className="size-4" strokeWidth={2} />
            </span>
          )}
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{title}</h3>
        </div>
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
  const [err, setErr] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    setErr(null);
    uploadFile(file, scope, ownerId)
      .then((key) => onUploaded(key))
      .catch((ex) => setErr(ex?.response?.data?.error?.message ?? ex?.message ?? "Tải tệp thất bại, thử lại."))
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
          <input type="file" accept={UPLOAD_RULES[scope].accept} className="hidden" disabled={busy} onChange={pick} />
        </label>
      )}
      {!value && !busy && !err && <div className="mt-1 text-[11px] text-muted-foreground">PDF, Word hoặc ảnh · tối đa {Math.round(UPLOAD_RULES[scope].maxBytes / (1024 * 1024))}MB</div>}
      {err && <div className="mt-1 text-[11px] text-rose-600">{err}</div>}
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

const PREVIEW_IMG = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

/** Inline preview of an uploaded file (image / PDF) via a short-lived signed URL. */
function FilePreview({ fileKey }: { fileKey: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ext = (fileKey.split(".").pop() ?? "").toLowerCase();
  const isImg = PREVIEW_IMG.includes(ext);
  const isPdf = ext === "pdf";

  function view() {
    setOpen(true);
    if (url) return;
    setBusy(true);
    signDownload(fileKey).then(setUrl).catch(() => {}).finally(() => setBusy(false));
  }

  return (
    <>
      <button type="button" onClick={view}
        className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-primary-600 hover:underline">
        <Eye className="size-3.5" /> Xem trước
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-secondary-900/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} style={{ animation: "fadeIn .2s ease" }} />
          <div className="relative flex max-h-[90vh] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl bg-background shadow-2xl" style={{ animation: "fadeIn .2s ease" }}>
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <span className="text-[13px] font-semibold text-foreground">Xem trước tài liệu</span>
              <button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
            </div>
            <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-muted/30 p-3">
              {busy || !url ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : isImg ? (
                <img src={url} alt="preview" className="max-h-[76vh] max-w-full object-contain" />
              ) : isPdf ? (
                <iframe src={url} title="preview" className="h-[76vh] w-full rounded-lg bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[13px] text-muted-foreground">
                  Không thể xem trước định dạng này.
                  <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">Tải xuống để xem</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
      <Panel title="Thông tin cá nhân" icon={IdCard} tone="cyan">
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
      <Panel title="Thông tin công việc" icon={Briefcase} tone="indigo">
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
// The only roles assignable to an employee account, with their display labels.
const SYS_ROLE_LABEL: Record<string, string> = {
  admin: "System Administrator",
  hr_manager: "HR Manager",
  employee: "Employee",
};
const FALLBACK_SYS_ROLES = Object.entries(SYS_ROLE_LABEL).map(([name, label]) => ({ name, label }));

function AccountTab({ view, canManage, onGranted }: { view: EmployeeView; canManage: boolean; onGranted: () => void }) {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(view.personalEmail ?? "");
  const [sendInvite, setSendInvite] = useState(true);
  const [regrant, setRegrant] = useState(false);
  const [roles, setRoles] = useState<{ name: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    employeeService
      .account(view.id)
      .then((a) => { if (!cancelled) { setAccount(a); setLoading(false); } })
      .catch(() => { if (!cancelled) { setAccount(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [view.id, reloadKey]);

  // Assignable roles for an employee account are the three core system roles.
  useEffect(() => {
    let cancelled = false;
    iamService.listRoles()
      .then((rs) => {
        if (cancelled) return;
        const picked = rs
          .filter((r) => r.name in SYS_ROLE_LABEL)
          .map((r) => ({ name: r.name, label: SYS_ROLE_LABEL[r.name] }));
        setRoles(picked.length ? picked : FALLBACK_SYS_ROLES);
      })
      .catch(() => { if (!cancelled) setRoles(FALLBACK_SYS_ROLES); });
    return () => { cancelled = true; };
  }, []);

  function run(p: Promise<unknown>, ok: string) {
    setBusy(true); setMsg(null); setError(null);
    p.then(() => { setMsg(ok); setReloadKey((k) => k + 1); })
      .catch((e) => setError(e?.response?.data?.error?.message ?? "Thao tác thất bại."))
      .finally(() => setBusy(false));
  }

  function grant(reprovision = false) {
    setBusy(true); setMsg(null); setError(null);
    employeeService
      .grantLogin(view.id, {
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        sendEmail: sendInvite,
      })
      .then(() => {
        onGranted();
        setReloadKey((k) => k + 1);
        setRegrant(false);
        setMsg(reprovision
          ? "Đã cấp lại tài khoản với mật khẩu mới & gửi lời mời."
          : "Đã cấp tài khoản & gửi lời mời.");
      })
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
              <LabeledInput label="Email cá nhân (dùng để gửi lời mời)">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vd: lan.nguyen@gmail.com" className={cn(inputCls, "h-10")} />
                {!view.personalEmail && (
                  <p className="mt-1 text-[11.5px] text-amber-600">Hồ sơ chưa có email cá nhân — nhập email tại đây để lưu vào hồ sơ và gửi lời mời.</p>
                )}
              </LabeledInput>
              <LabeledInput label="Tên đăng nhập tuỳ chọn (không bắt buộc)">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Mặc định lấy từ email" className={cn(inputCls, "h-10 font-mono")} />
              </LabeledInput>
              <label className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3 text-[13px]">
                <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="size-4 accent-primary-500" />
                <span className="flex-1 text-foreground">Gửi email lời mời kích hoạt tới nhân viên</span>
                <Mail className="size-4 text-muted-foreground" />
              </label>
              {error && <p className="text-[12.5px] text-destructive">{error}</p>}
              {msg && <p className="text-[12.5px] text-emerald-600">{msg}</p>}
              <Button onClick={() => grant()} disabled={busy || !email.trim()} className="gap-2 rounded-xl">
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
          <Field label="Vai trò" value={roles.find((r) => r.name === account.role)?.label ?? ROLE[account.role] ?? account.role} />
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
            {roles.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">Đang tải danh sách vai trò…</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <button key={r.name} type="button" disabled={busy || account.role === r.name}
                    onClick={() => run(employeeService.updateAccount(view.id, { role: r.name }), `Đã đổi vai trò sang ${r.label}.`)}
                    className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-[12.5px] font-medium transition disabled:opacity-100",
                      account.role === r.name ? "border-primary-500 bg-primary-50 text-primary-700" : "text-foreground hover:bg-muted")}>
                    {r.label}{account.role === r.name && <Check className="size-3.5" strokeWidth={2.4} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(employeeService.resetPassword(view.id), "Đã gửi liên kết đặt lại mật khẩu tới email.")} className="justify-start gap-2.5 rounded-xl">
              <RefreshCw className="size-4" strokeWidth={1.8} /> Đặt lại mật khẩu
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => run(employeeService.resendInvite(view.id), "Đã gửi lại email kích hoạt tài khoản.")} className="justify-start gap-2.5 rounded-xl">
              <Send className="size-4" strokeWidth={1.8} /> Gửi lại email lời mời
            </Button>
            <Button variant="outline" disabled={busy}
              onClick={() => { setRegrant((v) => !v); setEmail(account.email); setUsername(account.username); setMsg(null); setError(null); }}
              className="justify-start gap-2.5 rounded-xl">
              <Key className="size-4" strokeWidth={1.8} /> Cấp lại tài khoản & gửi lời mời
            </Button>
            {regrant && (
              <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3.5">
                <LabeledInput label="Email cá nhân">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputCls, "h-10")} />
                </LabeledInput>
                <LabeledInput label="Tên đăng nhập">
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className={cn(inputCls, "h-10 font-mono")} />
                </LabeledInput>
                <label className="flex items-center gap-2.5 text-[12.5px]">
                  <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="size-4 accent-primary-500" />
                  <span className="flex-1 text-foreground">Gửi lại email lời mời kích hoạt</span>
                </label>
                <p className="text-[11.5px] text-muted-foreground">Cập nhật email/tên đăng nhập (nếu đổi), tạo lại mật khẩu tự sinh mới và gửi lại lời mời.</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setRegrant(false)} className="rounded-lg">Huỷ</Button>
                  <Button size="sm" disabled={busy || !email.trim()} onClick={() => grant(true)} className="rounded-lg">{busy ? "Đang xử lý…" : "Xác nhận cấp lại"}</Button>
                </div>
              </div>
            )}
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

// ===================== Bank accounts =====================
function BankAccountsTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const [rk, setRk] = useState(0);
  const [adding, setAdding] = useState(false);
  const { loading, items, error } = useResource<EmployeeBankAccountRecord>(() => employeeService.bankAccounts(employeeId), `${employeeId}:${rk}`);
  const [banks, setBanks] = useState<Bank[]>([]);
  useEffect(() => {
    bankService.list().then((bs) => setBanks(bs.filter((b) => b.status === "active"))).catch(() => {});
  }, []);
  const emptyForm = { bankName: "", branch: "", accountNumber: "", accountHolder: "", isPrimary: false };
  const [f, setF] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  function remove(accountId: string) {
    setRemoving(accountId);
    employeeService.deleteBankAccount(employeeId, accountId)
      .then(() => setRk((k) => k + 1))
      .catch(() => {})
      .finally(() => setRemoving(null));
  }
  function startEdit(b: EmployeeBankAccountRecord) {
    setEditingId(b._id);
    setF({ bankName: b.bankName, branch: b.branch ?? "", accountNumber: b.accountNumber, accountHolder: b.accountHolder, isPrimary: !!b.isPrimary });
    setAdding(true);
  }
  function closeForm() { setAdding(false); setEditingId(null); setF(emptyForm); }
  function setPrimary(b: EmployeeBankAccountRecord) {
    if (b.isPrimary) return;
    employeeService.updateBankAccount(employeeId, b._id, { isPrimary: true }).then(() => setRk((k) => k + 1)).catch(() => {});
  }
  function save() {
    setBusy(true);
    const payload = {
      bankName: f.bankName.trim(),
      branch: f.branch.trim() || undefined,
      accountNumber: f.accountNumber.trim(),
      accountHolder: f.accountHolder.trim(),
      isPrimary: f.isPrimary,
    };
    const req = editingId
      ? employeeService.updateBankAccount(employeeId, editingId, payload)
      : employeeService.addBankAccount(employeeId, payload);
    req.then(() => { closeForm(); setRk((k) => k + 1); }).catch(() => {}).finally(() => setBusy(false));
  }
  const valid = f.bankName.trim() && f.accountNumber.trim().length >= 4 && f.accountHolder.trim();

  return (
    <Panel title="Tài khoản ngân hàng" action={canManage && <Button variant="outline" size="sm" onClick={() => (adding ? closeForm() : setAdding(true))} className="h-8 gap-1.5 rounded-lg text-[12.5px]"><Plus className="size-3.5" /> Thêm</Button>}>
      {adding && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3.5">
          <LabeledInput label="Ngân hàng">
            <select className={inputCls} value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })}>
              <option value="">— Chọn ngân hàng —</option>
              {f.bankName && !banks.some((b) => b.name === f.bankName) && <option value={f.bankName}>{f.bankName}</option>}
              {banks.map((b) => <option key={b._id} value={b.name}>{b.name}{b.code ? ` (${b.code})` : ""}</option>)}
            </select>
            {banks.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">Chưa có ngân hàng. Tạo trong Cài đặt → Ngân hàng.</p>}
          </LabeledInput>
          <LabeledInput label="Chi nhánh"><input className={inputCls} value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} placeholder="VD: CN Hà Nội" /></LabeledInput>
          <LabeledInput label="Số tài khoản"><input className={cn(inputCls, "font-mono")} value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" /></LabeledInput>
          <LabeledInput label="Chủ tài khoản"><input className={inputCls} value={f.accountHolder} onChange={(e) => setF({ ...f, accountHolder: e.target.value })} placeholder="Tên in trên thẻ" /></LabeledInput>
          <label className="flex items-end gap-2 pb-1 text-[12.5px]"><input type="checkbox" checked={f.isPrimary} onChange={(e) => setF({ ...f, isPrimary: e.target.checked })} className="size-4 accent-primary-500" /> Tài khoản nhận lương chính</label>
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeForm} className="rounded-lg">Huỷ</Button>
            <Button size="sm" disabled={busy || !valid} onClick={save} className="rounded-lg">{editingId ? "Cập nhật" : "Lưu"}</Button>
          </div>
        </div>
      )}
      {loading ? <TabLoading /> : error ? <TabEmpty text="Không tải được tài khoản ngân hàng." /> :
        items.length === 0 ? <TabEmpty text="Chưa có tài khoản ngân hàng nào." /> : (
          <div className="flex flex-col gap-3">
            {items.map((b) => (
              <div key={b._id} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Landmark className="size-5" strokeWidth={1.8} /></span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-foreground">{b.bankName}</span>
                    {b.isPrimary && <Badge variant="blue" className="text-[10px]">Nhận lương</Badge>}
                  </div>
                  <div className="text-[12px] text-muted-foreground"><span className="font-mono">{b.accountNumber}</span> · {b.accountHolder}{b.branch ? ` · ${b.branch}` : ""}</div>
                </div>
                {canManage && (
                  <>
                    {!b.isPrimary && <Button variant="ghost" size="sm" onClick={() => setPrimary(b)} className="h-8 rounded-lg text-[12px] text-muted-foreground hover:text-primary-600">Đặt chính</Button>}
                    <Button variant="ghost" size="icon" onClick={() => startEdit(b)} className="size-8 text-muted-foreground hover:text-primary-600"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={removing === b._id} onClick={() => remove(b._id)} className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
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
                  {d.fileUrl && <div className="mt-1.5 flex items-center gap-4"><FilePreview fileKey={d.fileUrl} /><DownloadLink fileKey={d.fileUrl} /></div>}
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
  const emptyForm = { contractType: "fixed_term", employmentStatus: "official", contractNumber: "", startDate: "", endDate: "", baseSalary: "", fileUrl: "" };
  const [f, setF] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(c: EmployeeContractRecord) {
    setEditingId(c._id);
    setF({
      contractType: c.contractType,
      employmentStatus: c.employmentStatus ?? "official",
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
      employmentStatus: f.employmentStatus as NonNullable<EmployeeContractRecord["employmentStatus"]>,
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
          <LabeledInput label="Loại HĐLĐ">
            <select className={inputCls} value={f.contractType} onChange={(e) => setF({ ...f, contractType: e.target.value })}>
              {Object.entries(CONTRACT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </LabeledInput>
          <LabeledInput label="Tình trạng">
            <select className={inputCls} value={f.employmentStatus} onChange={(e) => setF({ ...f, employmentStatus: e.target.value })}>
              {Object.entries(EMPLOYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                    {(() => {
                      const status = c.employmentStatus ?? "official";
                      const noInsurance = status === "probation" || status === "internship";
                      return (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <Badge variant={(noInsurance ? "amber" : "blue") as any} title={noInsurance ? `${EMPLOYMENT_STATUS[status]}: nhận 85% lương, không đóng BHXH` : "Chính thức: đóng BHXH đầy đủ"}>
                          {noInsurance ? `${EMPLOYMENT_STATUS[status]} · 85%, miễn BH` : "Chính thức · đóng BH"}
                        </Badge>
                      );
                    })()}
                    <Badge variant={c.status === "active" ? "emerald" : "slate"}>{c.status === "active" ? "Hiệu lực" : "Hết hiệu lực"}</Badge>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => startEdit(c)} className="size-8 text-muted-foreground hover:text-primary-600"><Pencil className="size-4" /></Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
                  <Field label="Loại HĐLĐ" value={CONTRACT_TYPE[c.contractType] ?? c.contractType} />
                  <Field label="Tình trạng" value={EMPLOYMENT_STATUS[c.employmentStatus ?? "official"]} />
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
const HIST_FIELD_LABEL: Record<string, string> = {
  status: "Trạng thái", departmentId: "Phòng ban", positionId: "Vị trí",
  hireDate: "Ngày vào làm", terminationDate: "Ngày nghỉ việc",
  contractNumber: "Số hợp đồng", contractType: "Loại hợp đồng",
  baseSalary: "Lương cơ bản", employmentStatus: "Tình trạng làm việc",
  managerId: "Quản lý", email: "Email",
};
const histFieldLabel = (k: string) => HIST_FIELD_LABEL[k] ?? k;

function histFmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (typeof v === "string") {
    // ISO date-ish → friendly date
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v);
    return v;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const TIME_RANGES: { id: string; label: string; days: number | null }[] = [
  { id: "all", label: "Tất cả thời gian", days: null },
  { id: "7", label: "7 ngày qua", days: 7 },
  { id: "30", label: "30 ngày qua", days: 30 },
  { id: "90", label: "90 ngày qua", days: 90 },
];

function HistoryTab({ employeeId }: { employeeId: string }) {
  const { loading, items, error } = useResource<EmployeeHistoryRecord>(() => employeeService.history(employeeId), employeeId);
  const [range, setRange] = useState("all");
  const [action, setAction] = useState("all");
  const [dataCat, setDataCat] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // Filter option sets derived from the loaded records.
  const actionTypes = Array.from(new Set(items.map((h) => h.eventType)));
  const dataKeys = Array.from(
    new Set(items.flatMap((h) => [...Object.keys(h.fromValue ?? {}), ...Object.keys(h.toValue ?? {})])),
  );

  const cutoff = (() => {
    const days = TIME_RANGES.find((r) => r.id === range)?.days;
    if (!days) return null;
    return Date.now() - days * 86_400_000;
  })();

  const filtered = items.filter((h) => {
    if (cutoff && new Date(h.effectiveDate).getTime() < cutoff) return false;
    if (action !== "all" && h.eventType !== action) return false;
    if (dataCat !== "all") {
      const keys = [...Object.keys(h.fromValue ?? {}), ...Object.keys(h.toValue ?? {})];
      if (!keys.includes(dataCat)) return false;
    }
    return true;
  });

  const selCls = "h-9 rounded-lg border border-input bg-card px-2.5 text-[12.5px] focus-visible:outline-none focus-visible:border-primary-500";

  return (
    <Panel title="Lịch sử thao tác">
      {/* Minimal filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Filter className="size-3.5" /> Lọc:</span>
        <select className={selCls} value={range} onChange={(e) => setRange(e.target.value)}>
          {TIME_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select className={selCls} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">Mọi hành động</option>
          {actionTypes.map((t) => <option key={t} value={t}>{HIST_EVENT[t] ?? t}</option>)}
        </select>
        <select className={selCls} value={dataCat} onChange={(e) => setDataCat(e.target.value)}>
          <option value="all">Mọi loại dữ liệu</option>
          {dataKeys.map((k) => <option key={k} value={k}>{histFieldLabel(k)}</option>)}
        </select>
      </div>

      {loading ? <TabLoading /> : error ? <TabEmpty text="Không tải được lịch sử." /> :
        items.length === 0 ? <TabEmpty text="Chưa có sự kiện nào." /> :
        filtered.length === 0 ? <TabEmpty text="Không có bản ghi khớp bộ lọc." /> : (
          <div className="flex flex-col gap-2">
            {filtered.map((h) => {
              const keys = Array.from(new Set([...Object.keys(h.fromValue ?? {}), ...Object.keys(h.toValue ?? {})]));
              const hasDiff = keys.length > 0;
              const open = openId === h._id;
              return (
                <div key={h._id} className="overflow-hidden rounded-xl border">
                  <button type="button" disabled={!hasDiff} onClick={() => setOpenId(open ? null : h._id)}
                    className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors", hasDiff && "hover:bg-muted/40 cursor-pointer")}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary-600"><History className="size-3.5" strokeWidth={1.8} /></span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">{HIST_EVENT[h.eventType] ?? h.eventType}</span>
                        <span className="text-[11.5px] tabular-nums text-muted-foreground">{formatDate(h.effectiveDate)}</span>
                      </div>
                      {h.note && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{h.note}</div>}
                    </div>
                    {hasDiff && <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />}
                  </button>
                  {/* Accordion: old → new comparison slides down on click */}
                  <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <div className="border-t bg-muted/20 px-3.5 py-3">
                        <div className="flex flex-col gap-2">
                          {keys.map((k) => (
                            <div key={k} className="grid grid-cols-[120px_1fr] gap-2 text-[12.5px]">
                              <span className="font-medium text-muted-foreground">{histFieldLabel(k)}</span>
                              <span className="flex items-center gap-2">
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-600 line-through">{histFmt(h.fromValue?.[k])}</span>
                                <ChevronDown className="size-3 -rotate-90 text-muted-foreground" />
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">{histFmt(h.toValue?.[k])}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </Panel>
  );
}

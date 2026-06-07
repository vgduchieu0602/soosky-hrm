import { useState, useMemo } from "react";
import {
  Search, UserPlus, Download, ChevronRight, ChevronLeft, ChevronDown, Check,
  X, Phone, Mail, FileText, Briefcase, Laptop, History, IdCard, Plus, MoreHorizontal,
  Users, UserCheck, CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import {
  EMPLOYEES, DEPARTMENTS, EMP_STATUS, EMP_TYPE, DOC_TYPE, CONTRACT_TYPE, REL, COND,
  HIST_EVENT, GENDER, MARITAL, fullName,
  type Employee,
} from "@features/employee/data";

type ChipKey = "blue" | "emerald" | "violet" | "amber" | "indigo" | "cyan";

const CHIP: Record<ChipKey, { bg: string; ink: string }> = {
  blue: { bg: "var(--chip-blue-bg)", ink: "var(--chip-blue-ink)" },
  emerald: { bg: "var(--chip-emerald-bg)", ink: "var(--chip-emerald-ink)" },
  violet: { bg: "var(--chip-violet-bg)", ink: "var(--chip-violet-ink)" },
  amber: { bg: "var(--chip-amber-bg)", ink: "var(--chip-amber-ink)" },
  indigo: { bg: "var(--chip-indigo-bg)", ink: "var(--chip-indigo-ink)" },
  cyan: { bg: "var(--chip-cyan-bg)", ink: "var(--chip-cyan-ink)" },
};

function StatCard({
  chip, icon: Icon, label, value,
}: { chip: ChipKey; icon: LucideIcon; label: string; value: number | string }) {
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span
        className="flex size-11 items-center justify-center rounded-2xl"
        style={{ background: CHIP[chip].bg, color: CHIP[chip].ink }}
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

function FilterPill({
  label, value, setValue, options,
}: { label: string; value: string; setValue: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        className="h-9 gap-2 rounded-full text-[13px]"
      >
        <span className="text-muted-foreground">{label}:</span> {value}
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-11 z-30 min-w-[180px] rounded-xl border bg-card p-1.5 shadow-md">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => { setValue(o); setOpen(false); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                  value === o && "font-semibold text-primary-600",
                )}
              >
                {o}
                {value === o && <Check className="size-3.5" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th
    className={cn(
      "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
      className,
    )}
  >
    {children}
  </th>
);

const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

export default function EmployeesPage() {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [dept, setDept] = useState("Tất cả");
  const [status, setStatus] = useState("Tất cả");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      EMPLOYEES.filter((e) => {
        if (dept !== "Tất cả" && e.dept !== dept) return false;
        if (status !== "Tất cả" && EMP_STATUS[e.status].label !== status) return false;
        if (q && !`${fullName(e)} ${e.code} ${e.position}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [dept, status, q],
  );

  const counts = useMemo(
    () => ({
      total: EMPLOYEES.length,
      active: EMPLOYEES.filter((e) => e.status === "active").length,
      onboarding: EMPLOYEES.filter((e) => e.status === "onboarding").length,
      onLeave: EMPLOYEES.filter((e) => e.status === "on_leave").length,
    }),
    [],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="emp" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Nhân viên"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Nhân viên</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Quản lý hồ sơ, hợp đồng và thông tin nhân sự toàn công ty.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                  <Download className="size-3.5" strokeWidth={1.8} /> Xuất Excel
                </Button>
                <Button size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                  <UserPlus className="size-3.5" strokeWidth={1.9} /> Tạo nhân viên
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <StatCard chip="blue" icon={Users} label="Tổng nhân viên" value={counts.total} />
              <StatCard chip="emerald" icon={UserCheck} label="Đang làm việc" value={counts.active} />
              <StatCard chip="violet" icon={UserPlus} label="Đang onboarding" value={counts.onboarding} />
              <StatCard chip="amber" icon={CalendarDays} label="Đang nghỉ phép" value={counts.onLeave} />
            </div>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Tìm theo tên, mã NV, chức vụ…"
                    className="h-9 pl-10 text-[13px]"
                  />
                </div>
                <FilterPill
                  label="Phòng ban"
                  value={dept}
                  setValue={setDept}
                  options={["Tất cả", ...DEPARTMENTS]}
                />
                <FilterPill
                  label="Trạng thái"
                  value={status}
                  setValue={setStatus}
                  options={[
                    "Tất cả",
                    "Đang làm việc",
                    "Onboarding",
                    "Đang nghỉ",
                    "Đã nghỉ việc",
                  ]}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <Th>Nhân viên</Th>
                      <Th>Mã NV</Th>
                      <Th>Phòng ban</Th>
                      <Th>Chức vụ</Th>
                      <Th>Loại</Th>
                      <Th>Quản lý</Th>
                      <Th>Ngày vào</Th>
                      <Th>Trạng thái</Th>
                      <Th className="text-right">·</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => {
                      const st = EMP_STATUS[e.status];
                      return (
                        <tr
                          key={e.code}
                          onClick={() => setSelected(e)}
                          className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                        >
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9 text-[12px]">
                                <AvatarFallback>{e.initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-foreground">{fullName(e)}</div>
                                <div className="text-[12px] text-muted-foreground">{e.email}</div>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <span className="font-mono text-[12px] text-muted-foreground">{e.code}</span>
                          </Td>
                          <Td><span className="text-foreground/80">{e.dept}</span></Td>
                          <Td><span className="text-foreground/80">{e.position}</span></Td>
                          <Td><span className="text-foreground/70">{EMP_TYPE[e.type]}</span></Td>
                          <Td><span className="text-foreground/70">{e.manager}</span></Td>
                          <Td><span className="tabular-nums text-foreground/70">{e.hireDate}</span></Td>
                          <Td>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <Badge variant={st.variant as any}>{st.label}</Badge>
                          </Td>
                          <Td className="text-right">
                            <ChevronRight className="ml-auto size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                          </Td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center text-[13px] text-muted-foreground">
                          Không tìm thấy nhân viên phù hợp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>
                  Hiển thị <b className="text-foreground tabular-nums">{filtered.length}</b> /{" "}
                  {EMPLOYEES.length} nhân viên
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-8 rounded-lg bg-muted">
                    1
                  </Button>
                  <Button variant="outline" size="icon" className="size-8 rounded-lg">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {selected && <EmployeeDetail e={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ===================== DETAIL SLIDE-OVER =====================
const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Hồ sơ", icon: IdCard },
  { id: "contacts", label: "Liên hệ", icon: Phone },
  { id: "documents", label: "Tài liệu", icon: FileText },
  { id: "contracts", label: "Hợp đồng", icon: Briefcase },
  { id: "assets", label: "Tài sản", icon: Laptop },
  { id: "history", label: "Lịch sử", icon: History },
];

function EmployeeDetail({ e, onClose }: { e: Employee; onClose: () => void }) {
  const [tab, setTab] = useState("profile");
  const st = EMP_STATUS[e.status];
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]"
        style={{ animation: "fadeIn .2s ease" }}
        onClick={onClose}
      />
      <div
        className="relative flex h-full w-[560px] max-w-[92vw] flex-col bg-background shadow-2xl"
        style={{ animation: "slideOver .28s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div
          className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white"
          style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-4">
            <Avatar className="size-16 bg-white/10 text-[20px] text-white ring-2 ring-white/20">
              <AvatarFallback className="bg-transparent text-white">{e.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[20px] font-bold tracking-tight">{fullName(e)}</h2>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Badge variant={st.variant as any} className="border border-white/10">
                  {st.label}
                </Badge>
              </div>
              <div className="mt-0.5 text-[13px] text-white/70">{e.position} · {e.dept}</div>
              <div className="mt-1 font-mono text-[12px] text-white/50">{e.code}</div>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button size="sm" className="h-8 gap-1.5 rounded-lg bg-white/15 text-[12.5px] text-white hover:bg-white/25">
              <FileText className="size-3.5" /> Chỉnh sửa
            </Button>
            <Button size="sm" className="h-8 gap-1.5 rounded-lg bg-white/15 text-[12.5px] text-white hover:bg-white/25">
              <Mail className="size-3.5" /> Gửi email
            </Button>
            <Button size="sm" className="h-8 gap-1.5 rounded-lg bg-white/15 text-[12.5px] text-white hover:bg-white/25">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                  tab === t.id
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.8} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-6">
          {tab === "profile" && <ProfileTab e={e} />}
          {tab === "contacts" && <ContactsTab e={e} />}
          {tab === "documents" && <DocumentsTab e={e} />}
          {tab === "contracts" && <ContractsTab e={e} />}
          {tab === "assets" && <AssetsTab e={e} />}
          {tab === "history" && <HistoryTab e={e} />}
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value, mono }: { label: string; value?: string; mono?: boolean }) => (
  <div>
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className={cn("mt-1 text-[13.5px] text-foreground", mono && "font-mono")}>
      {value || "—"}
    </div>
  </div>
);

const Panel = ({
  title, action, children,
}: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <Card className="p-5">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      {action}
    </div>
    {children}
  </Card>
);

function ProfileTab({ e }: { e: Employee }) {
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Thông tin cá nhân">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Họ và tên" value={fullName(e)} />
          <Field label="Ngày sinh" value={e.dob} />
          <Field label="Giới tính" value={GENDER[e.gender]} />
          <Field label="Tình trạng hôn nhân" value={MARITAL[e.marital]} />
          <Field label="Quốc tịch" value={e.nationality} />
          <Field label="Điện thoại" value={e.phone} mono />
          <Field label="Email công ty" value={e.email} />
          <Field label="Email cá nhân" value={e.personalEmail} />
          <div className="col-span-2">
            <Field label="Địa chỉ" value={e.address} />
          </div>
        </div>
      </Panel>
      <Panel title="Thông tin công việc">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Mã nhân viên" value={e.code} mono />
          <Field label="Phòng ban" value={e.dept} />
          <Field label="Chức vụ" value={e.position} />
          <Field label="Quản lý trực tiếp" value={e.manager} />
          <Field label="Loại hợp đồng" value={EMP_TYPE[e.type]} />
          <Field label="Ngày vào làm" value={e.hireDate} />
          <Field label="Vùng lương" value={e.zone.replace("zone", "Vùng ")} />
          <Field label="Trạng thái" value={EMP_STATUS[e.status].label} />
        </div>
      </Panel>
    </div>
  );
}

function ContactsTab({ e }: { e: Employee }) {
  return (
    <Panel
      title="Người liên hệ khẩn cấp"
      action={
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px]">
          <Plus className="size-3.5" /> Thêm
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {e.contacts.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3.5">
            <Avatar className="size-10 text-[13px]">
              <AvatarFallback>{c.name.split(" ").slice(-1)[0][0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-foreground">{c.name}</span>
                {c.primary && <Badge variant="blue" className="text-[10px]">Chính</Badge>}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {REL[c.rel]} · <span className="font-mono">{c.phone}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-8">
              <Phone className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DocumentsTab({ e }: { e: Employee }) {
  return (
    <Panel
      title="Tài liệu & giấy tờ"
      action={
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px]">
          <Plus className="size-3.5" /> Tải lên
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        {e.documents.map((d, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-3.5">
            <span
              className="flex size-10 items-center justify-center rounded-lg"
              style={{ background: CHIP.indigo.bg, color: CHIP.indigo.ink }}
            >
              <FileText className="size-5" strokeWidth={1.7} />
            </span>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-foreground">{DOC_TYPE[d.type]}</div>
              <div className="text-[12px] text-muted-foreground">
                Số: <span className="font-mono">{d.num}</span> · Cấp {d.issued}
                {d.expiry ? ` · HH ${d.expiry}` : ""}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-8">
              <Download className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ContractsTab({ e }: { e: Employee }) {
  return (
    <Panel
      title="Hợp đồng lao động"
      action={
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px]">
          <Plus className="size-3.5" /> Thêm
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {e.contracts.map((c, i) => (
          <div key={i} className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-semibold text-foreground">{c.no}</span>
              <Badge variant={c.status === "active" ? "emerald" : "slate"}>
                {c.status === "active" ? "Hiệu lực" : "Hết hiệu lực"}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
              <Field label="Loại" value={CONTRACT_TYPE[c.type]} />
              <Field label="Lương cơ bản" value={`${c.base} ₫`} />
              <Field label="Bắt đầu" value={c.start} />
              <Field label="Kết thúc" value={c.end ?? "Không thời hạn"} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AssetsTab({ e }: { e: Employee }) {
  if (!e.assets.length)
    return (
      <Panel title="Tài sản được cấp">
        <div className="py-8 text-center text-[13px] text-muted-foreground">
          Chưa có tài sản nào được cấp.
        </div>
      </Panel>
    );
  return (
    <Panel
      title="Tài sản được cấp"
      action={
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px]">
          <Plus className="size-3.5" /> Cấp tài sản
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        {e.assets.map((a, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-3.5">
            <span
              className="flex size-10 items-center justify-center rounded-lg"
              style={{ background: CHIP.cyan.bg, color: CHIP.cyan.ink }}
            >
              <Laptop className="size-5" strokeWidth={1.7} />
            </span>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-foreground">{a.name}</div>
              <div className="text-[12px] text-muted-foreground">
                Mã: <span className="font-mono">{a.code}</span> · Cấp {a.assigned}
              </div>
            </div>
            <Badge variant="slate">{COND[a.condition]}</Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HistoryTab({ e }: { e: Employee }) {
  return (
    <Panel title="Lịch sử nhân sự">
      <ol className="relative">
        <span className="pointer-events-none absolute bottom-2 left-[15px] top-2 w-px bg-border" />
        {e.history.map((h, i) => (
          <li key={i} className="relative flex items-start gap-3 py-2.5">
            <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary-600">
              <History className="size-3.5" strokeWidth={1.8} />
            </span>
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-foreground">{HIST_EVENT[h.event]}</span>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">{h.date}</span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">{h.note}</div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

import { useState, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Search, Calendar, Plus, ChevronDown, Check, X, Phone, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import {
  LEAVE_TYPE,
  LEAVE_STATUS,
  DEPTS,
  REQUESTS,
  BALANCES,
  HOLIDAYS,
} from "@features/attendance/data/leave.data";
import type {
  ChipColor,
} from "@features/dashboard/data";
import type {
  LeaveRequest,
  LeaveTypeKey,
} from "@features/attendance/data/leave.data";

const chipStyle = (chip: ChipColor): CSSProperties => ({
  background: `var(--chip-${chip}-bg)`,
  color: `var(--chip-${chip}-ink)`,
});

interface StatCardProps {
  chip: ChipColor;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
}

function StatCard({ chip, icon: Icon, label, value, sub }: StatCardProps) {
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span className="flex size-11 items-center justify-center rounded-2xl" style={chipStyle(chip)}>
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold leading-none tabular-nums text-foreground">{value}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">
          {label}
          {sub && <span className="text-muted-foreground/70"> · {sub}</span>}
        </div>
      </div>
    </Card>
  );
}

function TypeChip({ type }: { type: LeaveTypeKey }) {
  const t = LEAVE_TYPE[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
      style={chipStyle(t.chip)}
    >
      {t.label}
    </span>
  );
}

interface FilterPillProps {
  label: string;
  value: string;
  setValue: (v: string) => void;
  options: readonly string[];
}

function FilterPill({ label, value, setValue, options }: FilterPillProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <span className="text-muted-foreground">{label}:</span> {value} <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-30 min-w-[180px] rounded-xl border bg-card p-1.5 shadow-md">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => {
                  setValue(o);
                  setOpen(false);
                }}
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

const Th = ({ children, className }: { children: ReactNode; className?: string }) => (
  <th className={cn("px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>{children}</th>
);
const Td = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

const ALL = "Tất cả";

export default function LeavePage() {
  const [dept, setDept] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<LeaveRequest | null>(null);

  const rows = useMemo(
    () =>
      REQUESTS.filter((r) => {
        if (dept !== ALL && r.dept !== dept) return false;
        if (status !== ALL && LEAVE_STATUS[r.status].label !== status) return false;
        if (q && !`${r.name} ${r.code} ${r.id}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [dept, status, q],
  );

  const k = useMemo(
    () => ({
      pending: REQUESTS.filter((r) => r.status === "pending").length,
      approvedMonth: REQUESTS.filter((r) => r.status === "approved").length,
      onLeaveToday: 1,
      remaining: BALANCES.find((b) => b.type === "annual")?.remaining ?? 0,
    }),
    [],
  );

  const pending = rows.filter((r) => r.status === "pending");
  const history = rows.filter((r) => r.status !== "pending");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="leave" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Nghỉ phép"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Nghỉ phép</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Thứ ba, 03/06/2026 · Duyệt đơn, theo dõi số dư phép và ngày lễ.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                  <Calendar className="size-3.5" strokeWidth={1.8} /> Lịch nghỉ
                </Button>
                <Button size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                  <Plus className="size-3.5" strokeWidth={2} /> Tạo đơn nghỉ
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <StatCard chip="amber" icon={Calendar} label="Đơn chờ duyệt" value={k.pending} />
              <StatCard chip="emerald" icon={Check} label="Đã duyệt tháng này" value={k.approvedMonth} />
              <StatCard chip="violet" icon={Phone} label="Đang nghỉ hôm nay" value={k.onLeaveToday} />
              <StatCard chip="cyan" icon={Calendar} label="Phép năm còn lại" value={k.remaining} sub="ngày TB" />
            </div>

            <div className="grid grid-cols-4 gap-4">
              {BALANCES.map((b) => {
                const t = LEAVE_TYPE[b.type];
                const pct = b.entitled ? Math.round((b.used / b.entitled) * 100) : 0;
                return (
                  <Card key={b.type} className="p-4">
                    <div className="flex items-center justify-between">
                      <TypeChip type={b.type} />
                      <span className="text-[11px] tabular-nums text-muted-foreground">{b.entitled ? `${pct}%` : "∞"}</span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[20px] font-bold tabular-nums text-foreground">{b.remaining}</span>
                      <span className="text-[12px] text-muted-foreground">/ {b.entitled || "∞"} ngày còn lại</span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${b.entitled ? pct : 0}%`, background: `var(--chip-${t.chip}-ink)` }} />
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Đã dùng <b className="text-foreground/80 tabular-nums">{b.used}</b> ngày
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div className="col-span-2 flex flex-col gap-5">
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-foreground">Đơn chờ phê duyệt</h3>
                      <Badge variant="amber">{pending.length}</Badge>
                    </div>
                    <FilterPill label="Phòng ban" value={dept} setValue={setDept} options={DEPTS} />
                  </div>
                  <ul className="flex flex-col">
                    {pending.map((r) => (
                      <li
                        key={r.id}
                        onClick={() => setDetail(r)}
                        className="group flex cursor-pointer items-center gap-4 border-b border-border/60 px-4 py-3.5 transition-colors last:border-0 hover:bg-muted/40"
                      >
                        <Avatar className="size-10 text-[12px]">
                          <AvatarFallback>{r.initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-foreground">{r.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                            <TypeChip type={r.type} />
                            <span className="font-medium text-foreground/80 tabular-nums">
                              {r.start}
                              {r.days > 1 ? ` → ${r.end}` : ""}
                            </span>
                            <span>
                              · {r.days} ngày
                              {r.half ? ` (${r.half === "morning" ? "sáng" : "chiều"})` : ""}
                            </span>
                          </div>
                        </div>
                        <div className="hidden text-right text-[11px] text-muted-foreground md:block">Gửi {r.submitted}</div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8 rounded-lg hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Từ chối"
                          >
                            <X className="size-4" strokeWidth={2} />
                          </Button>
                          <Button
                            size="icon"
                            className="size-8 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Phê duyệt"
                          >
                            <Check className="size-4" strokeWidth={2.4} />
                          </Button>
                        </div>
                      </li>
                    ))}
                    {pending.length === 0 && (
                      <li className="px-4 py-12 text-center text-[13px] text-muted-foreground">Không có đơn nào chờ duyệt.</li>
                    )}
                  </ul>
                </Card>

                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 border-b p-4">
                    <h3 className="mr-auto text-[14px] font-semibold text-foreground">Lịch sử đơn nghỉ</h3>
                    <div className="relative min-w-[200px]">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm đơn, tên NV…" className="h-9 pl-10 text-[13px]" />
                    </div>
                    <FilterPill
                      label="Trạng thái"
                      value={status}
                      setValue={setStatus}
                      options={["Tất cả", "Chờ duyệt", "Đã duyệt", "Từ chối", "Đã huỷ"]}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <Th>Nhân viên</Th>
                          <Th>Loại</Th>
                          <Th>Thời gian</Th>
                          <Th className="text-right">Số ngày</Th>
                          <Th>Trạng thái</Th>
                          <Th className="text-right">·</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() => setDetail(r)}
                            className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                          >
                            <Td>
                              <div className="flex items-center gap-3">
                                <Avatar className="size-9 text-[12px]">
                                  <AvatarFallback>{r.initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold text-foreground">{r.name}</div>
                                  <div className="font-mono text-[11px] text-muted-foreground">{r.id}</div>
                                </div>
                              </div>
                            </Td>
                            <Td>
                              <TypeChip type={r.type} />
                            </Td>
                            <Td>
                              <span className="tabular-nums text-foreground/80">
                                {r.start}
                                {r.days > 1 ? ` → ${r.end}` : ""}
                              </span>
                            </Td>
                            <Td className="text-right tabular-nums text-foreground/80">{r.days}</Td>
                            <Td>
                              <Badge variant={LEAVE_STATUS[r.status].variant}>{LEAVE_STATUS[r.status].label}</Badge>
                            </Td>
                            <Td className="text-right">
                              <ChevronDown className="ml-auto size-4 -rotate-90 text-muted-foreground/50" />
                            </Td>
                          </tr>
                        ))}
                        {history.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-muted-foreground">
                              Không có đơn phù hợp.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <div className="flex flex-col gap-5">
                <Card className="p-5">
                  <h3 className="mb-4 text-[14px] font-semibold text-foreground">Ngày lễ sắp tới</h3>
                  <ul className="flex flex-col gap-3">
                    {HOLIDAYS.map((h) => (
                      <li key={h.name} className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg" style={chipStyle("rose")}>
                          <Calendar className="size-4" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-foreground">{h.name}</div>
                          <div className="text-[11.5px] text-muted-foreground tabular-nums">
                            {h.date}
                            {h.recurring ? " · hằng năm" : ""}
                          </div>
                        </div>
                        <Badge variant="slate">{h.days} ngày</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-5">
                  <h3 className="mb-1 text-[14px] font-semibold text-foreground">Chính sách nghỉ phép</h3>
                  <p className="mb-4 text-[12px] text-muted-foreground">Hạn mức theo năm (Bộ luật Lao động VN)</p>
                  <ul className="flex flex-col gap-2.5 text-[12.5px]">
                    <li className="flex items-center justify-between">
                      <span className="text-muted-foreground">Phép năm</span>
                      <span className="font-semibold text-foreground tabular-nums">12 ngày</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-muted-foreground">Nghỉ ốm (BHXH)</span>
                      <span className="font-semibold text-foreground tabular-nums">30 ngày</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-muted-foreground">Thai sản</span>
                      <span className="font-semibold text-foreground tabular-nums">180 ngày</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-muted-foreground">Nghỉ vợ sinh</span>
                      <span className="font-semibold text-foreground tabular-nums">5–14 ngày</span>
                    </li>
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {detail && <LeaveDetail r={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

const Field = ({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) => (
  <div>
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-[13.5px] text-foreground", mono && "font-mono")}>{value || "—"}</div>
  </div>
);

function LeaveDetail({ r, onClose }: { r: LeaveRequest; onClose: () => void }) {
  const st = LEAVE_STATUS[r.status];
  const bal = BALANCES.find((b) => b.type === r.type);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]" style={{ animation: "fadeIn .2s ease" }} onClick={onClose} />
      <div
        className="relative flex h-full w-[480px] max-w-[92vw] flex-col bg-background shadow-2xl"
        style={{ animation: "slideOver .28s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div
          className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white"
          style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-4">
            <Avatar className="size-14 bg-white/10 text-[18px] text-white ring-2 ring-white/20">
              <AvatarFallback className="bg-transparent text-white">{r.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-[19px] font-bold tracking-tight">{r.name}</h2>
              <div className="mt-0.5 text-[13px] text-white/70">
                <span className="font-mono">{r.code}</span> · {r.dept}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={st.variant} className="border border-white/10">
                  {st.label}
                </Badge>
                <span className="font-mono text-[11px] text-white/50">{r.id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5">
            <Card className="p-5">
              <h3 className="mb-4 text-[14px] font-semibold text-foreground">Chi tiết đơn nghỉ</h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <div className="col-span-2">
                  <Field label="Loại nghỉ" value={<TypeChip type={r.type} />} />
                </div>
                <Field label="Từ ngày" value={r.start} mono />
                <Field label="Đến ngày" value={r.days > 1 ? r.end : "—"} mono />
                <Field label="Số ngày" value={`${r.days} ngày${r.half ? ` (buổi ${r.half === "morning" ? "sáng" : "chiều"})` : ""}`} />
                <Field label="Người duyệt" value={r.approver} />
                <div className="col-span-2">
                  <Field label="Lý do" value={r.reason} />
                </div>
                {r.rejection && (
                  <div className="col-span-2">
                    <Field label="Lý do từ chối" value={r.rejection} />
                  </div>
                )}
              </div>
            </Card>

            {bal && (
              <Card className="p-5">
                <h3 className="mb-4 text-[14px] font-semibold text-foreground">Số dư phép · {LEAVE_TYPE[r.type].label}</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[18px] font-bold tabular-nums text-foreground">{bal.entitled || "∞"}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Được cấp</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold tabular-nums text-amber-600">{bal.used}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Đã dùng</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold tabular-nums text-emerald-600">{bal.remaining}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Còn lại</div>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-5">
              <h3 className="mb-2 text-[14px] font-semibold text-foreground">Thời gian gửi</h3>
              <p className="text-[13px] text-muted-foreground">
                Đơn được gửi lúc <span className="font-medium text-foreground/80">{r.submitted}</span>
              </p>
            </Card>

            {r.status === "pending" && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 rounded-xl hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                  <X className="size-4" strokeWidth={2} /> Từ chối
                </Button>
                <Button className="flex-1 gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600">
                  <Check className="size-4" strokeWidth={2.4} /> Phê duyệt
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

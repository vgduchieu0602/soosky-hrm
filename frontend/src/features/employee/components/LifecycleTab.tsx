import { useEffect, useState } from "react";
import {
  ArrowRightLeft, Award, CalendarClock, GitBranch, History, Landmark,
  LogOut, RotateCcw, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import { formatDate, HIST_EVENT } from "@features/employee/constants";
import { LifecycleActionModal, type LifecycleAction } from "@features/employee/components/LifecycleActionModal";
import type { EmployeeContractRecord, EmployeeView, LifecycleEntry } from "@features/employee/types/employee.types";

interface Props {
  view: EmployeeView;
  canManage: boolean;
  /** Gọi lại khi trạng thái hiện tại của nhân viên đã đổi (phòng ban, quản lý, nghỉ việc…). */
  onChanged: () => void;
}

/** Sự kiện nào dùng biểu tượng nào — timeline đọc nhanh hơn bảng chữ. */
const EVENT_ICON: Record<string, typeof History> = {
  hired: Award,
  transfer: ArrowRightLeft,
  promotion: Award,
  position_change: GitBranch,
  manager_change: UserCog,
  salary_change: Landmark,
  contract_renew: CalendarClock,
  contract_ended: CalendarClock,
  probation_started: CalendarClock,
  probation_extended: CalendarClock,
  probation_completed: Award,
  resigned: LogOut,
  terminated: LogOut,
  rehired: RotateCcw,
  info_update: History,
};

const EVENT_TONE: Record<string, string> = {
  hired: "text-emerald-600 bg-emerald-50",
  promotion: "text-violet-600 bg-violet-50",
  probation_completed: "text-emerald-600 bg-emerald-50",
  rehired: "text-emerald-600 bg-emerald-50",
  resigned: "text-rose-600 bg-rose-50",
  terminated: "text-rose-600 bg-rose-50",
};

export function LifecycleTab({ view, canManage, onChanged }: Props) {
  // Một state duy nhất cho lần nạp: đặt trong callback của promise nên không có
  // setState đồng bộ trong effect (quy tắc react-hooks/set-state-in-effect).
  const [data, setData] = useState<{
    loading: boolean;
    entries: LifecycleEntry[];
    contract: EmployeeContractRecord | null;
    error: boolean;
  }>({ loading: true, entries: [], contract: null, error: false });
  const [reloadKey, setReloadKey] = useState(0);
  const [action, setAction] = useState<LifecycleAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([employeeService.lifecycle(view.id), employeeService.contracts(view.id)])
      .then(([timeline, contracts]) => {
        if (cancelled) return;
        setData({
          loading: false,
          entries: timeline,
          contract: contracts.find((c) => c.status === "active") ?? null,
          error: false,
        });
      })
      .catch(() => {
        if (!cancelled) setData({ loading: false, entries: [], contract: null, error: true });
      });
    return () => { cancelled = true; };
  }, [view.id, reloadKey]);

  const { loading, entries, contract, error } = data;

  function handleDone() {
    setAction(null);
    setData((d) => ({ ...d, loading: true }));
    setReloadKey((k) => k + 1);
    onChanged();
  }

  const separated = view.status === "terminated";
  const onProbation = contract?.employmentStatus === "probation";

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Thay đổi vòng đời
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Mỗi thay đổi cần ngày hiệu lực và lý do, và được lưu vĩnh viễn vào dòng thời gian bên dưới.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {separated ? (
              <ActionButton icon={RotateCcw} label="Tái tuyển" onClick={() => setAction("rehire")} />
            ) : (
              <>
                <ActionButton icon={ArrowRightLeft} label="Điều chuyển phòng ban" onClick={() => setAction("transfer")} />
                <ActionButton icon={GitBranch} label="Đổi chức vụ" onClick={() => setAction("position")} />
                <ActionButton icon={UserCog} label="Đổi quản lý" onClick={() => setAction("manager")} />
                <ActionButton icon={Landmark} label="Thay đổi lương" onClick={() => setAction("salary")} />
                {onProbation && (
                  <>
                    <ActionButton icon={Award} label="Hoàn tất thử việc" onClick={() => setAction("probation-complete")} />
                    <ActionButton icon={CalendarClock} label="Gia hạn thử việc" onClick={() => setAction("probation-extend")} />
                  </>
                )}
                <ActionButton icon={LogOut} label="Kết thúc hợp tác" tone="danger" onClick={() => setAction("end")} />
              </>
            )}
          </div>
        </div>
      )}

      <ProbationCard contract={contract} status={view.status} />

      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Dòng thời gian
        </div>
        {loading ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Đang tải…</p>
        ) : error ? (
          <p className="py-6 text-center text-[13px] text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Chưa có sự kiện nào.</p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l border-border/70 pl-6">
            {entries.map((entry) => (
              <TimelineItem key={entry._id} entry={entry} />
            ))}
          </ol>
        )}
      </div>

      {action && (
        <LifecycleActionModal
          action={action}
          view={view}
          contract={contract}
          onClose={() => setAction(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon, label, onClick, tone,
}: { icon: typeof History; label: string; onClick: () => void; tone?: "danger" }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("h-8 gap-1.5 rounded-lg text-[12.5px]", tone === "danger" && "border-rose-200 text-rose-600 hover:bg-rose-50")}
    >
      <Icon className="size-3.5" /> {label}
    </Button>
  );
}

/** Thông tin thử việc lấy từ hợp đồng đang hiệu lực — không nhân bản sang bảng nhân viên. */
function ProbationCard({ contract, status }: { contract: EmployeeContractRecord | null; status: string }) {
  if (!contract) return null;
  const probation = contract.employmentStatus === "probation";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Thử việc</div>
        <Badge variant={probation ? "amber" : "emerald"}>
          {probation ? "Đang thử việc" : status === "terminated" ? "Đã kết thúc" : "Chính thức"}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
        <Cell label="Bắt đầu" value={formatDate(contract.startDate)} />
        <Cell label="Kết thúc" value={contract.endDate ? formatDate(contract.endDate) : "—"} />
        <Cell label="Hợp đồng" value={contract.contractNumber} mono />
      </div>
    </div>
  );
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-foreground", mono && "font-mono text-[12.5px]")}>{value}</div>
    </div>
  );
}

function TimelineItem({ entry }: { entry: LifecycleEntry }) {
  const Icon = EVENT_ICON[entry.eventType] ?? History;
  const tone = EVENT_TONE[entry.eventType] ?? "text-primary-600 bg-primary-50";
  // Chỉ hiện thay đổi có giá trị — bản ghi cũ có thể trống một vế.
  const changes = entry.changes.filter((c) => c.from !== null || c.to !== null);

  return (
    <li className="relative">
      <span className={cn("absolute -left-[34px] flex size-6 items-center justify-center rounded-full border border-border bg-card", tone)}>
        <Icon className="size-3" strokeWidth={2} />
      </span>
      <div className="rounded-xl border bg-card px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">
            {HIST_EVENT[entry.eventType] ?? entry.eventType}
          </span>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            hiệu lực {formatDate(entry.effectiveDate)}
          </span>
        </div>

        {changes.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {changes.map((c) => (
              <div key={c.field} className="grid grid-cols-[110px_1fr] gap-2 text-[12.5px]">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{c.from ?? "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">{c.to ?? "—"}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {entry.reason && <p className="mt-2 text-[12.5px] text-foreground">Lý do: {entry.reason}</p>}
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          {entry.performedBy ? `Thực hiện: ${entry.performedBy}` : "Thực hiện: hệ thống"}
          {entry.createdAt ? ` · ghi nhận ${formatDate(entry.createdAt)}` : ""}
        </p>
      </div>
    </li>
  );
}

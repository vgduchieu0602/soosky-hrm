import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, FileClock, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import type { ExpiryReminders, ReminderItem } from "@features/employee/types/employee.types";

interface Props {
  /** Locate an employee in the list (e.g. set the search box to their code). */
  onLocate: (employeeCode: string) => void;
}

function dueTone(daysLeft: number): "rose" | "amber" | "slate" {
  if (daysLeft <= 7) return "rose";
  if (daysLeft <= 15) return "amber";
  return "slate";
}

function dueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Quá hạn ${Math.abs(daysLeft)} ngày`;
  if (daysLeft === 0) return "Hết hạn hôm nay";
  return `Còn ${daysLeft} ngày`;
}

function Group({
  icon: Icon, title, items, onLocate,
}: { icon: typeof UserCog; title: string; items: ReminderItem[]; onLocate: (c: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.9} /> {title}
        <Badge variant="slate">{items.length}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((it) => (
          <button key={it.contractId} onClick={() => onLocate(it.employeeCode)}
            className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-muted/50">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-foreground">{it.fullName}</span>
              <span className="text-muted-foreground"> · <span className="font-mono">{it.employeeCode}</span>{it.departmentName ? ` · ${it.departmentName}` : ""}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{it.endDate.slice(0, 10)}</span>
            <Badge variant={dueTone(it.daysLeft)}>{dueLabel(it.daysLeft)}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContractRemindersCard({ onLocate }: Props) {
  const [data, setData] = useState<ExpiryReminders | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    employeeService.reminders(30)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData({ probation: [], contract: [] }); });
    return () => { cancelled = true; };
  }, []);

  const total = data ? data.probation.length + data.contract.length : 0;
  if (!data || total === 0) return null; // nothing to nag about

  return (
    <Card className="overflow-hidden border-amber-200">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><CalendarClock className="size-5" strokeWidth={1.9} /></span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-foreground">Sắp đến hạn (30 ngày)</div>
          <div className="text-[12px] text-muted-foreground">{data.probation.length} thử việc/thực tập · {data.contract.length} hợp đồng cần xử lý</div>
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t px-4 py-3">
          <Group icon={UserCog} title="Thử việc / thực tập sắp kết thúc" items={data.probation} onLocate={onLocate} />
          <Group icon={FileClock} title="Hợp đồng sắp hết hạn" items={data.contract} onLocate={onLocate} />
        </div>
      )}
    </Card>
  );
}

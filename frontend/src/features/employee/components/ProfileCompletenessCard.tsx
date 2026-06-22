import { useEffect, useState } from "react";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import type { ProfileCompleteness } from "@features/employee/types/employee.types";

interface Props {
  employeeId: string;
  /** Bump to refetch after the record changes. */
  refreshKey?: number;
}

export function ProfileCompletenessCard({ employeeId, refreshKey = 0 }: Props) {
  const [data, setData] = useState<ProfileCompleteness | null>(null);

  useEffect(() => {
    let cancelled = false;
    employeeService.completeness(employeeId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [employeeId, refreshKey]);

  if (!data) return null;

  const tone = data.percent >= 100 ? "emerald" : data.percent >= 60 ? "amber" : "rose";
  const barColor = tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="mb-5 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-foreground">Độ hoàn thiện hồ sơ</div>
        <div className={cn("text-[15px] font-bold tabular-nums",
          tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-rose-600")}>
          {data.percent}%
        </div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-300", barColor)} style={{ width: `${data.percent}%` }} />
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {data.items.map((it) => (
          <li key={it.key} className="flex items-center gap-2 text-[12.5px]">
            {it.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            ) : it.required ? (
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground/40" />
            )}
            <span className={cn(it.done ? "text-foreground" : "text-muted-foreground")}>
              {it.label}{!it.done && it.required && <span className="ml-1 text-[11px] text-rose-500">(cần bổ sung)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

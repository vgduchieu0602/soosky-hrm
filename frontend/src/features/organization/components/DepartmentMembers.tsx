import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import type {
  EmployeeRecord,
  EmployeeStatus,
  PositionRef,
} from "@features/employee/types/employee.types";
import { initials } from "@features/organization/utils/org.utils";

interface Props {
  departmentId: string;
}

const STATUS_META: Record<EmployeeStatus, { label: string; chip: string }> = {
  active: { label: "Đang làm", chip: "emerald" },
  onboarding: { label: "Onboarding", chip: "cyan" },
  on_leave: { label: "Nghỉ phép", chip: "amber" },
  terminated: { label: "Đã nghỉ", chip: "rose" },
};

function positionTitle(p: PositionRef | string | undefined): string {
  if (!p || typeof p === "string") return "—";
  return p.title;
}

function memberName(e: EmployeeRecord): string {
  const n = [e.profile?.lastName, e.profile?.firstName].filter(Boolean).join(" ").trim();
  return n || e.employeeCode;
}

export function DepartmentMembers({ departmentId }: Props) {
  const [members, setMembers] = useState<EmployeeRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Promise-chain load; state only touched inside callbacks (no sync setState).
  useEffect(() => {
    let cancelled = false;
    employeeService
      .list({ departmentId, limit: 200, sort: "-created_at" })
      .then((res) => {
        if (!cancelled) {
          setMembers(res.items.filter((e) => e.status !== "terminated"));
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  if (!loaded) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/60" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center text-[12.5px] text-muted-foreground">
        <Users className="size-7 text-muted-foreground/50" />
        <span>Phòng ban chưa có nhân sự.</span>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {members.map((e) => {
        const meta = STATUS_META[e.status];
        return (
          <li key={e._id} className="flex items-center gap-3 rounded-xl border p-2.5 text-[12.5px]">
            <Avatar className="size-9">
              {e.profile?.avatarUrl ? (
                <img src={e.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <AvatarFallback className="text-[11px]">{initials(memberName(e))}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-foreground">{memberName(e)}</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                {positionTitle(e.positionId)} · {e.employeeCode}
              </div>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Badge variant={meta.chip as any} className={cn("text-[10px]")}>{meta.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

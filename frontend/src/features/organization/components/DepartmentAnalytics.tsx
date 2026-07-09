import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import type { DepartmentNode } from "@features/organization/types/organization.types";
import { chipFor } from "@features/organization/utils/org.utils";

interface Props {
  flat: DepartmentNode[];
  tree: DepartmentNode[];
}

export function DepartmentAnalytics({ flat }: Props) {
  const stats = useMemo(() => {
    const byHeadcount = [...flat]
      .filter((d) => d.headcount > 0)
      .sort((a, b) => b.headcount - a.headcount);
    const maxHead = byHeadcount[0]?.headcount ?? 1;
    return { byHeadcount, maxHead };
  }, [flat]);

  return (
    <div>
      <Card className="flex flex-col p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground">
            Phân bổ nhân sự theo phòng
          </h3>
          <span className="text-[11.5px] text-muted-foreground">{stats.byHeadcount.length} phòng</span>
        </div>
        {stats.byHeadcount.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-muted-foreground">
            Chưa có dữ liệu nhân sự.
          </p>
        ) : (
          <ul className="flex max-h-[340px] flex-col gap-2.5 overflow-y-auto pr-1.5">
            {stats.byHeadcount.map((d) => (
              <li key={d.id} className="flex items-center gap-3 text-[12px]">
                <span className="w-14 shrink-0 truncate font-mono text-muted-foreground" title={d.code}>{d.code}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(6, (d.headcount / stats.maxHead) * 100)}%`,
                      background: `var(--chip-${chipFor(d.code)}-ink)`,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-foreground">
                  {d.headcount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { iamService } from "@features/iam/services/iam.service";
import type { AuditLogEntry } from "@features/iam/types/iam.types";

const PAGE_SIZE = 15;

const ACTION_VARIANT: Record<string, string> = {
  create: "emerald",
  update: "blue",
  delete: "rose",
  login: "slate",
  "login-failed": "amber",
  "login-blocked": "rose",
  logout: "slate",
};

function actorName(e: AuditLogEntry): string {
  if (e.userId && typeof e.userId === "object") return e.userId.username;
  return "Hệ thống";
}

export function AuditLogSettings() {
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    iamService.listAuditLogs({ limit: 150 })
      .then((r) => { if (!cancelled) { setRows(r); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );

  return (
    <Card className="overflow-hidden">
      <div className="border-b p-5">
        <h3 className="text-[15px] font-semibold text-foreground">Nhật ký hệ thống</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">150 hoạt động gần nhất do người dùng thực hiện.</p>
      </div>
      {loading ? (
        <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-muted/50" /></div>
      ) : error ? (
        <p className="py-10 text-center text-[13px] text-destructive">Không tải được nhật ký.</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">Chưa có hoạt động nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Tài nguyên</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((e) => (
                <tr key={e._id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{new Date(e.timestamp).toLocaleString("vi-VN", { hour12: false })}</td>
                  <td className="px-4 py-2.5 text-foreground">{actorName(e)}</td>
                  <td className="px-4 py-2.5">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Badge variant={(ACTION_VARIANT[e.action] ?? "slate") as any}>{e.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-foreground/80">{e.resource}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px] text-muted-foreground">
            <span>
              Trang <b className="text-foreground tabular-nums">{page}</b>/{totalPages} · {rows.length} hoạt động
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Trang trước">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Trang sau">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

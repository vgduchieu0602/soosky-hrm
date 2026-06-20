import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  /** Noun shown after the count, e.g. "tài khoản". */
  unit: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sizes?: number[];
}

/** Shared list paginator — matches the evaluation table footer style. */
export function Pagination({ page, pageSize, total, unit, onPageChange, onPageSizeChange, sizes = [10, 20, 50] }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-[12.5px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Hiển thị</span>
        <select
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="h-8 rounded-lg border border-input bg-card px-2 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>/ trang · {total} {unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => onPageChange(Math.max(1, safePage - 1))} className="h-8 rounded-lg">Trước</Button>
        <span className="tabular-nums">Trang {safePage}/{totalPages}</span>
        <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} className="h-8 rounded-lg">Sau</Button>
      </div>
    </div>
  );
}

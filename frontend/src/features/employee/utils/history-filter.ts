import type { EmployeeHistoryRecord } from "@features/employee/types/employee.types";

export interface HistoryFilter {
  /**
   * Mốc thời gian (ms) — bỏ mọi bản ghi cũ hơn mốc này. `null` = không giới hạn.
   *
   * Là ĐẦU VÀO chứ không tự tính từ `Date.now()`: mốc phải được chốt lúc người
   * dùng chọn khoảng thời gian. Tính trong lúc render là hàm không thuần — mỗi
   * lần re-render ra một mốc khác nên danh sách đổi mà không có tương tác nào
   * (eslint `react-hooks/purity`).
   */
  cutoff: number | null;
  /** `"all"` = mọi loại thao tác. */
  action: string;
  /** `"all"` = mọi trường dữ liệu; ngược lại chỉ giữ bản ghi có chạm trường đó. */
  dataCat: string;
}

/** Các trường dữ liệu bị chạm trong một bản ghi lịch sử (hợp của before + after). */
export function historyTouchedKeys(record: EmployeeHistoryRecord): string[] {
  return [...Object.keys(record.fromValue ?? {}), ...Object.keys(record.toValue ?? {})];
}

/** Lọc lịch sử thao tác theo thời gian, loại thao tác và trường dữ liệu. */
export function filterHistory(
  items: EmployeeHistoryRecord[],
  { cutoff, action, dataCat }: HistoryFilter,
): EmployeeHistoryRecord[] {
  return items.filter((record) => {
    if (cutoff != null && new Date(record.effectiveDate).getTime() < cutoff) return false;
    if (action !== "all" && record.eventType !== action) return false;
    if (dataCat !== "all" && !historyTouchedKeys(record).includes(dataCat)) return false;
    return true;
  });
}

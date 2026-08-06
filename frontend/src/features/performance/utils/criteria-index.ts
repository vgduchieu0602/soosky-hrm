import type { Criterion, CriteriaSet } from "@features/performance/types/performance.types";

/**
 * Tra tiêu chí theo (bộ tiêu chí, PHIÊN BẢN) — không phải theo "bản mới nhất".
 *
 * Phiếu đánh giá giữ số phiên bản của riêng nó, nên giao diện phải hiển thị đúng
 * bộ tiêu chí lúc chấm. Lấy bản mới nhất sẽ khiến phiếu cũ hiện tên/trọng số của
 * tiêu chí hiện tại — tức là đọc sai lịch sử.
 */
export function buildCriteriaIndex(criteriaSets: CriteriaSet[]): (criteriaSetId: string, version: number) => Criterion[] {
  const byKey = new Map<string, Criterion[]>();
  for (const set of criteriaSets) {
    for (const v of set.versions) byKey.set(`${set.id}:${v.version}`, v.criteria);
  }
  return (criteriaSetId, version) => byKey.get(`${criteriaSetId}:${version}`) ?? [];
}

export const KIND_LABEL: Record<string, string> = {
  kpi: "KPI",
  goal: "Mục tiêu",
  performance: "Hiệu suất",
};

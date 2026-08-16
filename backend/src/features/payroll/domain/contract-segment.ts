/**
 * Chia một kỳ lương thành các ĐOẠN LƯƠNG theo hợp đồng — thuần, không I/O.
 *
 * Một kỳ lương có thể chồng lên nhiều hợp đồng (thử việc → chính thức, đổi mức
 * lương giữa tháng). Trước đây payroll lấy đúng MỘT hợp đồng đang hiệu lực rồi
 * áp cho cả tháng, nên nhân viên chuyển trạng thái giữa kỳ bị tính sai toàn bộ.
 *
 *   Kỳ:        01/08 ────────────────────────────── 31/08
 *   HĐ A:  01/01 ─────────── 10/08
 *   HĐ B:                    11/08 ──────────────────────▶ (null)
 *   Đoạn:      01/08─10/08 (A)  ·  11/08─31/08 (B)
 *
 * Ngày biên KHÔNG được đếm hai lần: A tính hết 10/08, B tính từ 11/08.
 *
 * Trạng thái hợp đồng (`active`/`expired`) KHÔNG được dùng để chọn hợp đồng —
 * một hợp đồng đã `expired` vẫn là dữ liệu đúng cho đoạn quá khứ của kỳ. Chỉ
 * `startDate`/`endDate` mới quyết định.
 */

/** Một hợp đồng ứng viên, đã lấy về từ tầng dữ liệu. */
export interface ContractInput {
  contractId: string;
  startDate: Date;
  /** `null` = hợp đồng không thời hạn. */
  endDate: Date | null;
  employmentStatus: string;
  baseSalary: number;
}

/** Một đoạn lương: khoảng thời gian trong kỳ do đúng một hợp đồng phụ trách. */
export interface ContractSegment {
  contractId: string;
  from: Date;
  to: Date;
  employmentStatus: string;
  baseSalary: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface OverlapIssue {
  /** Hai hợp đồng cùng phủ một khoảng ngày. */
  first: ContractSegment;
  second: ContractSegment;
  range: DateRange;
}

export interface SegmentResult {
  segments: ContractSegment[];
  /** Khoảng bị hai hợp đồng cùng phủ — payroll phải từ chối, không tự chọn. */
  overlaps: OverlapIssue[];
  /**
   * Khoảng TRỐNG NẰM GIỮA hai hợp đồng. Người gọi phải hỏi lịch làm việc xem
   * khoảng đó có ngày công thật không rồi mới quyết định chặn.
   */
  gaps: DateRange[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mốc 00:00 UTC của ngày chứa `d` — so sánh theo NGÀY, bỏ phần giờ. */
export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const addDays = (d: Date, days: number): Date => new Date(startOfDay(d).getTime() + days * DAY_MS);

/**
 * Cắt các hợp đồng chồng lên kỳ thành các đoạn lương.
 *
 * `contracts` KHÔNG cần sắp xếp sẵn — hàm tự sắp theo `startDate` tăng dần.
 * Mọi mốc được kẹp vào biên của kỳ:
 *
 *   from = max(hợp đồng.startDate, kỳ.startDate)
 *   to   = min(hợp đồng.endDate ?? kỳ.endDate, kỳ.endDate)
 *
 * Khoảng trống ở ĐẦU hoặc CUỐI kỳ không bị coi là lỗi: nó chỉ có nghĩa là người
 * này vào làm giữa kỳ hoặc nghỉ giữa kỳ — chuyện bình thường. Chỉ khoảng trống
 * KẸP GIỮA hai hợp đồng mới đáng ngờ, vì nghĩa là dữ liệu hợp đồng bị thủng.
 */
export function buildContractSegments(
  contracts: readonly ContractInput[],
  period: { startDate: Date; endDate: Date },
): SegmentResult {
  const periodStart = startOfDay(period.startDate);
  const periodEnd = startOfDay(period.endDate);

  const segments: ContractSegment[] = [];
  for (const contract of contracts) {
    const rawFrom = startOfDay(contract.startDate);
    const rawTo = contract.endDate ? startOfDay(contract.endDate) : periodEnd;

    const from = rawFrom > periodStart ? rawFrom : periodStart;
    const to = rawTo < periodEnd ? rawTo : periodEnd;

    // Hợp đồng nằm hoàn toàn ngoài kỳ (dữ liệu thừa từ truy vấn) — bỏ qua.
    if (from > to) continue;

    segments.push({
      contractId: contract.contractId,
      from,
      to,
      employmentStatus: contract.employmentStatus,
      baseSalary: contract.baseSalary,
    });
  }

  segments.sort((a, b) => a.from.getTime() - b.from.getTime());

  const overlaps: OverlapIssue[] = [];
  const gaps: DateRange[] = [];

  for (let i = 1; i < segments.length; i += 1) {
    const previous = segments[i - 1]!;
    const current = segments[i]!;

    if (current.from <= previous.to) {
      overlaps.push({
        first: previous,
        second: current,
        range: { from: current.from, to: previous.to < current.to ? previous.to : current.to },
      });
      continue;
    }

    // Liền kề (A hết 10, B bắt đầu 11) thì không có khoảng trống.
    const expectedNext = addDays(previous.to, 1);
    if (current.from > expectedNext) {
      gaps.push({ from: expectedNext, to: addDays(current.from, -1) });
    }
  }

  return { segments, overlaps, gaps };
}

/** `2026-08-10` — dùng trong thông báo lỗi cho HR đọc. */
export function dayLabel(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

/** Mô tả khoảng chồng lấn để HR biết phải sửa hợp đồng nào. */
export function describeOverlap(issue: OverlapIssue): string {
  return (
    `Hợp đồng ${issue.first.contractId} và ${issue.second.contractId} cùng phủ ` +
    `${dayLabel(issue.range.from)} → ${dayLabel(issue.range.to)}`
  );
}

/** Mô tả khoảng trống giữa hai hợp đồng. */
export function describeGap(gap: DateRange): string {
  return `Không có hợp đồng cho ${dayLabel(gap.from)} → ${dayLabel(gap.to)}`;
}

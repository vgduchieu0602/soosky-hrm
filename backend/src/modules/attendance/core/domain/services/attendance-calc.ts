/**
 * Logic tính toán chấm công thuần (không phụ thuộc hạ tầng) — port từ
 * `attendance-calc.ts` của bản cũ (feature-based). Mọi so sánh giờ diễn ra
 * theo giờ địa phương Việt Nam (Asia/Ho_Chi_Minh).
 */

export const TIMEZONE = "Asia/Ho_Chi_Minh";
export const GRACE_LATE_MIN = 5;
export const GRACE_EARLY_MIN = 5;
export const EARLY_LEAVE_TOLERANCE_MIN = 120;

export interface AttendancePolicy {
    timezone:               string;
    graceLateMin:           number;
    graceEarlyMin:          number;
    /** Ca bị rời sớm hơn ngưỡng này (phút) thì không tính công (đi trễ không bao giờ làm mất công, chỉ về sớm mới mất). */
    earlyLeaveToleranceMin: number;
}

export const DEFAULT_POLICY: AttendancePolicy = {
    timezone:               TIMEZONE,
    graceLateMin:           GRACE_LATE_MIN,
    graceEarlyMin:          GRACE_EARLY_MIN,
    earlyLeaveToleranceMin: EARLY_LEAVE_TOLERANCE_MIN,
};

export interface ShiftWindow {
    startTime:    string; // "HH:mm"
    endTime:      string; // "HH:mm"
    breakMinutes: number;
}

/** Số phút kể từ nửa đêm địa phương (theo tz), tính từ một thời điểm UTC. */
export function minutesOfDayVN(d: Date, tz: string = TIMEZONE): number {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone:  tz,
        hour:      "2-digit",
        minute:    "2-digit",
        hourCycle: "h23",
    }).formatToParts(d);
    const hh = Number(parts.find(p => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find(p => p.type === "minute")?.value ?? "0");
    return hh * 60 + mm;
}

function localYMD(d: Date, tz: string): { y: number; m: number; day: number } {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        year:     "numeric",
        month:    "2-digit",
        day:      "2-digit",
    }).formatToParts(d);
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? "0");
    return { y: get("year"), m: get("month"), day: get("day") };
}

/** Ngày lịch (00:00 UTC) theo giờ địa phương của một thời điểm — key thuần để lưu trữ/so sánh. */
export function vnDateKey(d: Date, tz: string = TIMEZONE): Date {
    const { y, m, day } = localYMD(d, tz);
    return new Date(Date.UTC(y, m - 1, day));
}

/** Liệt kê các date-key (00:00 UTC) từ start..end, bao gồm cả hai đầu. */
export function enumerateDays(start: Date, end: Date): Date[] {
    const out: Date[] = [];
    const s = vnDateKey(start);
    const e = vnDateKey(end);
    for (let t = s.getTime(); t <= e.getTime(); t += 86_400_000) {
        out.push(new Date(t));
    }
    return out;
}

/** Thứ 7 hoặc Chủ nhật (tính theo UTC vì date-key lưu ở 00:00 UTC). */
export function isWeekend(dateKey: Date): boolean {
    const dow = dateKey.getUTCDay(); // 0 = CN, 6 = T7
    return dow === 0 || dow === 6;
}

/** "MM-DD" của một date-key UTC — dùng để khớp ngày lễ lặp lại hàng năm. */
export function mmddKey(dateKey: Date): string {
    const mm = String(dateKey.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dateKey.getUTCDate()).padStart(2, "0");
    return `${mm}-${dd}`;
}

function parseHHmm(v: string): number {
    const [h, m] = v.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Một ca đã cấu hình, ở dạng thuật toán ghép ca cần. */
export interface ShiftDef {
    id:           string;
    startTime:    string; // "HH:mm"
    endTime:      string; // "HH:mm"
    breakMinutes: number;
}

export interface MatchedShift {
    shiftId:      string;
    /** Công ca này đóng góp khi được tính = 1 / (số ca cấu hình trong ngày), để cả ngày làm hết các ca = 1.0 công. */
    congWeight:   number;
    counted:      boolean; // true → được tính công
    status:       string;  // present | late | early_leave | absent
    workHours:    number;
    lateMinutes:  number;
    earlyMinutes: number;
}

export interface MatchDayResult {
    shifts:    MatchedShift[];
    /** Tổng trọng số công của các ca được tính — công trong ngày. */
    totalCong: number;
}

/**
 * Phân bổ một cặp [checkIn, checkOut] cho các ca cấu hình trong ngày.
 *
 * Một ca được tính đủ công khi khoảng thời gian thực sự chồng lấn ca đó và
 * nhân viên không rời sớm hơn ngưỡng cho phép:
 *   - đến trước khi ca kết thúc (checkIn < caEnd)
 *   - rời sau khi ca bắt đầu    (checkOut > caStart)
 *   - về sớm ≤ policy.earlyLeaveToleranceMin
 * Đi trễ không bao giờ làm mất công (chỉ ghi nhận). Ca không được tính trả về
 * status 'absent' và trọng số công 0.
 */
export function matchShifts(
    shiftDefs: ShiftDef[],
    checkIn:   Date | null | undefined,
    checkOut:  Date | null | undefined,
    policy:    AttendancePolicy = DEFAULT_POLICY,
): MatchDayResult {
    // Công được chia đều cho các ca CẤU HÌNH trong ngày: mỗi ca được tính có giá
    // trị 1/N ngày công, nên làm hết cả N ca = 1.0 công, làm 1/2 ca = 0.5 công.
    const dayShare = shiftDefs.length > 0 ? 1 / shiftDefs.length : 1;

    const shifts: MatchedShift[] = shiftDefs.map(s => {
        const start = parseHHmm(s.startTime);
        const end   = parseHHmm(s.endTime);
        const brk   = s.breakMinutes ?? 0;

        const base = (extra: Partial<MatchedShift> = {}): MatchedShift => ({
            shiftId:      s.id,
            congWeight:   dayShare,
            counted:      false,
            status:       "absent",
            workHours:    0,
            lateMinutes:  0,
            earlyMinutes: 0,
            ...extra,
        });

        if (!checkIn || !checkOut) return base();

        const inMin  = minutesOfDayVN(checkIn, policy.timezone);
        const outMin = minutesOfDayVN(checkOut, policy.timezone);

        // Không chồng lấn ca này chút nào → vắng ở ca này.
        if (inMin >= end || outMin <= start) return base();

        const effIn  = Math.max(inMin, start);
        const effOut = Math.min(outMin, end);
        const worked = Math.max(0, effOut - effIn - brk);

        const lateRaw  = Math.max(0, inMin - start);
        const earlyRaw = Math.max(0, end - outMin);
        const lateMinutes  = lateRaw  > policy.graceLateMin  ? lateRaw  : 0;
        const earlyMinutes = earlyRaw > policy.graceEarlyMin ? earlyRaw : 0;

        // Về sớm vượt ngưỡng làm mất công của ca; đi trễ thì không.
        const counted = earlyRaw <= policy.earlyLeaveToleranceMin;
        if (!counted) {
            return base({ status: "early_leave", workHours: round2(worked / 60), lateMinutes, earlyMinutes });
        }

        const status = lateMinutes > 0 ? "late" : earlyMinutes > 0 ? "early_leave" : "present";
        return base({ counted: true, status, workHours: round2(worked / 60), lateMinutes, earlyMinutes });
    });

    const totalCong = round2(
        shifts.reduce((sum, s) => (s.counted ? sum + s.congWeight : sum), 0),
    );

    return { shifts, totalCong };
}

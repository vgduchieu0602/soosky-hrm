/**
 * Cắt ngày theo TIMEZONE CÔNG TY.
 *
 * Bảng điều khiển nói "hôm nay", "7 ngày qua" — phải theo giờ doanh nghiệp, không
 * theo giờ máy chủ (container thường chạy UTC, nên 07:00 giờ VN đã là "hôm qua").
 *
 * Dùng `Intl` của chuẩn JS, KHÔNG thêm thư viện ngày tháng: chỗ này chỉ cần đổi
 * qua lại giữa mốc UTC và ngày địa phương.
 */

/** `YYYY-MM-DD` của một mốc thời gian, theo timezone đã cho. */
export function companyDayKey(instant: Date, timeZone: string): string {
    // `en-CA` cho ra đúng dạng YYYY-MM-DD, không phụ thuộc locale của máy chủ.
    return new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(instant);
}

/**
 * Lệch múi giờ (ms) của một timezone tại một mốc cụ thể.
 *
 * Tính tại mốc chứ không dùng hằng số: timezone có DST thì lệch đổi theo thời
 * điểm (VN không có DST, nhưng công thức phải đúng cho mọi cấu hình công ty).
 */
function offsetMs(instant: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(instant);

    const value = (type: string): number => Number(parts.find(part => part.type === type)?.value ?? "0");
    // `hour` có thể là 24 khi hour12:false ở một số runtime — chuẩn hoá về 0.
    const hour = value("hour") % 24;

    const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
    return asUtc - instant.getTime();
}

/** Mốc UTC ứng với 00:00:00 của một ngày địa phương (`YYYY-MM-DD`). */
export function startOfCompanyDay(dayKey: string, timeZone: string): Date {
    const naive = new Date(`${dayKey}T00:00:00.000Z`);
    return new Date(naive.getTime() - offsetMs(naive, timeZone));
}

/** Mốc UTC ứng với 23:59:59.999 của một ngày địa phương. */
export function endOfCompanyDay(dayKey: string, timeZone: string): Date {
    return new Date(startOfCompanyDay(dayKey, timeZone).getTime() + 86_400_000 - 1);
}

/**
 * `count` ngày địa phương liên tiếp, KẾT THÚC ở ngày của `now` (gồm cả ngày đó).
 *
 * Trả cả danh sách khoá ngày (để dựng chuỗi biểu đồ không bị khuyết ngày) và
 * khoảng UTC để truy vấn — truy vấn LUÔN có biên, không quét toàn collection.
 */
export function lastCompanyDays(now: Date, timeZone: string, count: number): {
    dayKeys: string[];
    range:   { from: Date; to: Date };
} {
    const todayKey = companyDayKey(now, timeZone);
    const todayStart = startOfCompanyDay(todayKey, timeZone);

    const dayKeys: string[] = [];
    for (let back = count - 1; back >= 0; back -= 1) {
        // Lùi từ 12:00 trưa để phép trừ ngày không bị nhảy sai khi có DST.
        const noon = new Date(todayStart.getTime() + 43_200_000 - back * 86_400_000);
        dayKeys.push(companyDayKey(noon, timeZone));
    }

    const firstKey = dayKeys[0] ?? todayKey;
    return {
        dayKeys,
        range: { from: startOfCompanyDay(firstKey, timeZone), to: endOfCompanyDay(todayKey, timeZone) },
    };
}

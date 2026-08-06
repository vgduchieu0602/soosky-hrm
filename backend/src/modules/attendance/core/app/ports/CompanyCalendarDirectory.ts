/**
 * Cổng đọc cấu hình công ty mà việc tính công cần, do module Setting sở hữu.
 *
 * Chỉ timezone: mọi so sánh giờ vào/ra với giờ ca đều phải diễn ra theo giờ
 * doanh nghiệp, không phải giờ của máy chủ. Máy chủ chạy UTC (Docker) nên nếu
 * lấy giờ hệ thống thì 08:00 giờ Việt Nam thành 01:00 và toàn bộ tính trễ/sớm
 * sai lệch 7 tiếng.
 *
 * Composition root (infra) lắp hiện thực dựa trên `createCompanyCalendar` của
 * module Setting.
 */
export default interface CompanyCalendarDirectory {
    /** Timezone IANA của doanh nghiệp, vd `Asia/Ho_Chi_Minh`. */
    timezone(): Promise<string>;
}

import { MongoPayrollPeriodRepo, MongoPayslipRepo } from "@modules/payroll/adapters/driven/persistence/mongodb";
import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import { Db as MongoDb } from "mongodb";

/** Kỳ công đã chốt đang phủ một ngày cụ thể. */
export interface LockedPeriod {
    periodId: string;
    name:     string;
}

/**
 * Bề mặt tra cứu trạng thái chốt kỳ công mà module khác (Attendance) được phép
 * tiêu thụ, KHÔNG cần import repo Mongo nội bộ của Payroll.
 */
export interface PayrollPeriodLockDirectory {
    findLockedPeriodCovering(date: Date): Promise<LockedPeriod | undefined>;
}

/**
 * Lắp `PayrollPeriodLockDirectory` trên nền MongoDB — điểm nối để Attendance
 * chặn ghi bảng công sau khi kỳ đã chốt.
 *
 * Quét toàn bộ kỳ rồi lọc trong bộ nhớ: số kỳ lương là số tháng đã vận hành
 * (hàng chục, không phải hàng triệu), nên một truy vấn đơn giản dễ đọc hơn là
 * dựng index khoảng ngày cho một phép so sánh chạy vài lần mỗi request.
 */
export function createPayrollPeriodLockDirectory(mongoDb: MongoDb): PayrollPeriodLockDirectory {
    const periodRepo = new MongoPayrollPeriodRepo(mongoDb);

    return {
        findLockedPeriodCovering: async (date: Date) => {
            const periods = await periodRepo.listAll();

            const locked = periods.find(period =>
                period.attendanceLockedAt != null
                && period.startDate <= date
                && date <= period.endDate,
            );

            return locked == undefined ? undefined : { periodId: locked.id, name: locked.name.value };
        },
    };
}

/**
 * Bề mặt NHẬN bản chụp điểm đánh giá mà module Performance được phép tiêu thụ.
 *
 * Một chiều và chỉ có ghi: Performance đẩy điểm ĐÃ KHOÁ sang, Payroll lưu bản
 * chụp trong chính kỳ lương của mình. Nhờ vậy sau này sửa tiêu chí, chấm lại hay
 * phát hành phiên bản tiêu chí mới KHÔNG làm đổi lương đã tính — Payroll không
 * bao giờ đọc lại phiếu đánh giá.
 */
export interface PayrollEvaluationSnapshotSink {
    snapshotEvaluation(input: {
        payrollPeriodId:  string;
        employeeId:       string;
        performanceScore: number;
        goalScore:        number;
        updatedBy:        string;
    }): Promise<void>;
}

/**
 * Lắp bộ nhận bản chụp điểm trên nền MongoDB.
 *
 * Từ chối nhận khi kỳ ĐÃ CHỐT ĐÁNH GIÁ: sau mốc đó bảng lương có thể đã tính
 * xong, thêm bản chụp mới nghĩa là số liệu đầu vào đổi sau khi đã chốt. Muốn đổi
 * thì mở khoá kỳ — luồng có quyền và có nhật ký.
 */
export function createPayrollEvaluationSink(mongoDb: MongoDb): PayrollEvaluationSnapshotSink {
    const periodRepo = new MongoPayrollPeriodRepo(mongoDb);

    return {
        snapshotEvaluation: async input => {
            const period = await periodRepo.getById(input.payrollPeriodId);
            if (period == undefined) throw new PayrollPeriodNotFoundError();

            if (period.evaluationLockedAt != null) {
                throw new PayrollPeriodLockedError(
                    `Period ${period.name.value} already locked evaluations; unlock it before snapshotting new scores`,
                );
            }

            period.upsertEvaluation({
                employeeId:       input.employeeId,
                performanceScore: input.performanceScore,
                goalScore:        input.goalScore,
                updatedBy:        input.updatedBy,
            });

            await periodRepo.save(period);
        },
    };
}

/** Tổng hợp kỳ lương gần nhất cho read model (module Dashboard). */
export interface PayrollPeriodSnapshot {
    periodId:       string;
    name:           string;
    stage:          string;
    status:         string;
    payDate:        Date;
    headcount:      number;
    gross:          number;
    net:            number;
    /** Số phiếu đã `approved` hoặc `paid`. */
    finalizedCount: number;
}

/**
 * Bề mặt đọc tổng hợp lương cho READ MODEL.
 *
 * Chỉ số TỔNG của kỳ và phiếu của ĐÚNG MỘT nhân viên — không có cách nào lấy
 * danh sách phiếu của người khác qua đây. Ai được thấy tổng lương do use-case
 * của Dashboard quyết định theo quyền `payroll:*`.
 */
export interface PayrollReportDirectory {
    latestPeriodSnapshot(): Promise<PayrollPeriodSnapshot | undefined>;
    latestPayslipOf(employeeId: string): Promise<{ periodName: string; status: string; netSalary: number } | undefined>;
}

export function createPayrollReportDirectory(mongoDb: MongoDb): PayrollReportDirectory {
    const periodRepo  = new MongoPayrollPeriodRepo(mongoDb);
    const payslipRepo = new MongoPayslipRepo(mongoDb);

    return {
        latestPeriodSnapshot: async () => {
            const periods = await periodRepo.listAll();
            // `listAll` sắp theo ngày bắt đầu giảm dần (xem repo); kỳ đầu là gần nhất.
            const period = periods[0];
            if (period == undefined) return undefined;

            const totals = await payslipRepo.totalsForPeriod(period.id);
            const sum = (pick: (row: { count: number; gross: number; net: number }) => number): number =>
                totals.reduce((acc: number, row) => acc + pick(row), 0);

            return {
                periodId:  period.id,
                name:      period.name.value,
                stage:     period.stage,
                status:    period.status,
                payDate:   period.payDate,
                headcount: sum(row => row.count),
                gross:     sum(row => row.gross),
                net:       sum(row => row.net),
                finalizedCount: totals
                    .filter(row => row.status === "approved" || row.status === "paid")
                    .reduce((acc: number, row) => acc + row.count, 0),
            };
        },

        latestPayslipOf: async (employeeId: string) => {
            const payslips = await payslipRepo.listFinalizedByEmployee(employeeId);
            const payslip = payslips[0];
            if (payslip == undefined) return undefined;

            const period = await periodRepo.getById(payslip.payrollPeriodId);
            return {
                periodName: period?.name.value ?? "—",
                status:     payslip.status,
                netSalary:  payslip.netSalary,
            };
        },
    };
}

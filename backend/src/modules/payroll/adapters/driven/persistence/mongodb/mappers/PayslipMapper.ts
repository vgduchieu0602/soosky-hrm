import { PayslipInputs } from "@modules/payroll/core/domain/entities/Payslip";
import PayslipDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayslipDocument";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";

/**
 * Bản chụp đầu vào cho phiếu lương tính TRƯỚC khi có tính năng truy vết. Nêu rõ
 * "không rõ" thay vì bịa id — phiếu cũ vẫn đọc được, và ai xem cũng thấy ngay là
 * không truy được nguồn.
 */
const LEGACY_INPUTS: PayslipInputs = {
    engineVersion:  "legacy",
    salaryPolicyId: "unknown",
    taxProfileId:   null,
    allowanceIds:   [],
    bonusIds:       [],
    deductionIds:   [],
    contractIds:    [],
    retroIds:       [],
    computedBy:     "unknown",
    recomputeCount: 0,
};

const PayslipMapper = {
    toDocument(payslip: Payslip): PayslipDocument {
        return {
            _id:              payslip.id,
            payrollPeriodId:  payslip.payrollPeriodId,
            employeeId:       payslip.employeeId,
            workdays:         payslip.workdays,
            attendanceRatio:  payslip.attendanceRatio,
            performanceRatio: payslip.performanceRatio,
            goalRatio:        payslip.goalRatio,
            breakdown:        payslip.breakdown,
            segments:         [...payslip.segments],
            inputs:           payslip.inputs,
            status:           payslip.status,
            approvedBy:       payslip.approvedBy,
            paidAt:           payslip.paidAt,
            computedAt:       payslip.computedAt,
            createdAt:        payslip.createdAt,
        };
    },

    toDomain(document: PayslipDocument): Payslip {
        return Payslip.rehydrate({
            id:               document._id,
            payrollPeriodId:  document.payrollPeriodId,
            employeeId:       document.employeeId,
            workdays:         document.workdays,
            attendanceRatio:  document.attendanceRatio,
            performanceRatio: document.performanceRatio,
            goalRatio:        document.goalRatio,
            breakdown:        document.breakdown,
            segments:         document.segments ?? [],
            inputs:           document.inputs ?? LEGACY_INPUTS,
            status:           document.status,
            approvedBy:       document.approvedBy,
            paidAt:           document.paidAt,
            computedAt:       document.computedAt,
            createdAt:        document.createdAt,
        });
    },
};

export default PayslipMapper;

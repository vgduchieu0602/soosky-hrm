import PayslipDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayslipDocument";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";

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
            status:           document.status,
            approvedBy:       document.approvedBy,
            paidAt:           document.paidAt,
            computedAt:       document.computedAt,
            createdAt:        document.createdAt,
        });
    },
};

export default PayslipMapper;

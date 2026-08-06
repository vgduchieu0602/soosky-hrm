import PayrollVarianceDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayrollVarianceDocument";
import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";
import { PayrollEngineVersion } from "@modules/payroll/core/domain/services/salary-calc";

const PayrollVarianceMapper = {
    toDocument(variance: PayrollVariance): PayrollVarianceDocument {
        return {
            _id:             variance.id,
            payrollPeriodId: variance.payrollPeriodId,
            employeeId:      variance.employeeId,
            baselineEngine:  variance.baselineEngine,
            targetEngine:    variance.targetEngine,
            baselineNet:     variance.baselineNet,
            targetNet:       variance.targetNet,
            fields:          [...variance.fields],
            detectedAt:      variance.detectedAt,
            detectedBy:      variance.detectedBy,
            signedBy:        variance.signedBy,
            signedAt:        variance.signedAt,
            explanation:     variance.explanation,
        };
    },

    toDomain(document: PayrollVarianceDocument): PayrollVariance {
        return PayrollVariance.rehydrate({
            id:              document._id,
            payrollPeriodId: document.payrollPeriodId,
            employeeId:      document.employeeId,
            baselineEngine:  document.baselineEngine as PayrollEngineVersion,
            targetEngine:    document.targetEngine as PayrollEngineVersion,
            baselineNet:     document.baselineNet,
            targetNet:       document.targetNet,
            fields:          document.fields,
            detectedAt:      document.detectedAt,
            detectedBy:      document.detectedBy,
            signedBy:        document.signedBy,
            signedAt:        document.signedAt,
            explanation:     document.explanation,
        });
    },
};

export default PayrollVarianceMapper;

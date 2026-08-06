import { createEmployeeDirectory } from "@modules/employee";
import { createIamAccessControl, createIamAuditTrail } from "@modules/iam";
import { MongoAppraisalCycleRepo, MongoCriteriaSetRepo, MongoPerformanceReviewRepo } from "@modules/performance/adapters/driven/persistence/mongodb";
import { PerformanceHttpUseCases } from "@modules/performance/adapters/driver/http";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import CreateCriteriaSetUseCase from "@modules/performance/core/app/use-cases/criteria/CreateCriteriaSetUseCase";
import ListCriteriaSetsUseCase from "@modules/performance/core/app/use-cases/criteria/ListCriteriaSetsUseCase";
import PublishCriteriaVersionUseCase from "@modules/performance/core/app/use-cases/criteria/PublishCriteriaVersionUseCase";
import ActivateAppraisalCycleUseCase from "@modules/performance/core/app/use-cases/cycle/ActivateAppraisalCycleUseCase";
import CloseAppraisalCycleUseCase from "@modules/performance/core/app/use-cases/cycle/CloseAppraisalCycleUseCase";
import CreateAppraisalCycleUseCase from "@modules/performance/core/app/use-cases/cycle/CreateAppraisalCycleUseCase";
import GetCycleReadinessUseCase from "@modules/performance/core/app/use-cases/cycle/GetCycleReadinessUseCase";
import ListAppraisalCyclesUseCase from "@modules/performance/core/app/use-cases/cycle/ListAppraisalCyclesUseCase";
import AcknowledgeReviewUseCase from "@modules/performance/core/app/use-cases/review/AcknowledgeReviewUseCase";
import AppealReviewUseCase from "@modules/performance/core/app/use-cases/review/AppealReviewUseCase";
import ApproveReviewUseCase from "@modules/performance/core/app/use-cases/review/ApproveReviewUseCase";
import AssignReviewerUseCase from "@modules/performance/core/app/use-cases/review/AssignReviewerUseCase";
import GetReviewUseCase from "@modules/performance/core/app/use-cases/review/GetReviewUseCase";
import ListReviewsUseCase from "@modules/performance/core/app/use-cases/review/ListReviewsUseCase";
import LockReviewUseCase from "@modules/performance/core/app/use-cases/review/LockReviewUseCase";
import RequestReviewChangesUseCase from "@modules/performance/core/app/use-cases/review/RequestReviewChangesUseCase";
import ResolveReviewAppealUseCase from "@modules/performance/core/app/use-cases/review/ResolveReviewAppealUseCase";
import ScoreReviewUseCase from "@modules/performance/core/app/use-cases/review/ScoreReviewUseCase";
import { createPayrollEvaluationSink } from "@modules/payroll";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp use-case của module Performance trên nền MongoDB.
 *
 * Ba cổng liên-module được nối tại đây:
 *  - IAM  → kiểm quyền và ghi nhật ký;
 *  - Employee → danh bạ nhân viên + chuỗi quản lý (phân công người chấm);
 *  - Payroll  → nơi NHẬN bản chụp điểm khi khoá.
 *
 * Chiều phụ thuộc một hướng: Performance biết Payroll (để đẩy bản chụp), Payroll
 * KHÔNG biết Performance khi tính lương — nó chỉ đọc bản chụp trong kỳ của mình.
 */
export default function createPerformanceHttpUseCases(mongoDb: MongoDb): PerformanceHttpUseCases {
    const criteriaSetRepo = new MongoCriteriaSetRepo(mongoDb);
    const cycleRepo       = new MongoAppraisalCycleRepo(mongoDb);
    const reviewRepo      = new MongoPerformanceReviewRepo(mongoDb);

    const permissionCheck   = createIamAccessControl(mongoDb);
    const auditTrail        = createIamAuditTrail(mongoDb);
    const employeeDirectory = createEmployeeDirectory(mongoDb);
    const payrollSink       = createPayrollEvaluationSink(mongoDb);

    const accessScope = new PerformanceAccessScope(permissionCheck, employeeDirectory);

    return {
        // Bộ tiêu chí (có phiên bản)
        createCriteriaSet:      new CreateCriteriaSetUseCase(accessScope, criteriaSetRepo, auditTrail),
        publishCriteriaVersion: new PublishCriteriaVersionUseCase(accessScope, criteriaSetRepo, auditTrail),
        listCriteriaSets:       new ListCriteriaSetsUseCase(permissionCheck, criteriaSetRepo, accessScope),

        // Chu kỳ đánh giá
        createAppraisalCycle:   new CreateAppraisalCycleUseCase(accessScope, cycleRepo, criteriaSetRepo, auditTrail),
        activateAppraisalCycle: new ActivateAppraisalCycleUseCase(accessScope, cycleRepo, reviewRepo, employeeDirectory, auditTrail),
        closeAppraisalCycle:    new CloseAppraisalCycleUseCase(accessScope, cycleRepo, reviewRepo, employeeDirectory, auditTrail),
        getCycleReadiness:      new GetCycleReadinessUseCase(accessScope, cycleRepo, reviewRepo, employeeDirectory),
        listAppraisalCycles:    new ListAppraisalCyclesUseCase(permissionCheck, cycleRepo),

        // Phiếu đánh giá
        scoreReview:          new ScoreReviewUseCase(accessScope, reviewRepo, cycleRepo, criteriaSetRepo, auditTrail),
        approveReview:        new ApproveReviewUseCase(accessScope, reviewRepo, auditTrail),
        requestReviewChanges: new RequestReviewChangesUseCase(accessScope, reviewRepo, auditTrail),
        acknowledgeReview:    new AcknowledgeReviewUseCase(accessScope, reviewRepo, auditTrail),
        appealReview:         new AppealReviewUseCase(accessScope, reviewRepo, auditTrail),
        resolveReviewAppeal:  new ResolveReviewAppealUseCase(accessScope, reviewRepo, auditTrail),
        lockReview:           new LockReviewUseCase(accessScope, reviewRepo, cycleRepo, payrollSink, auditTrail),
        assignReviewer:       new AssignReviewerUseCase(accessScope, reviewRepo, auditTrail),
        listReviews:          new ListReviewsUseCase(accessScope, reviewRepo),
        getReview:            new GetReviewUseCase(accessScope, reviewRepo),
    };
}

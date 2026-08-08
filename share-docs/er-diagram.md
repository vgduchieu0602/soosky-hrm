# Soosky HRM — ER Diagram

> Sơ đồ dữ liệu theo **module hexagonal** (giống dự án soosky-workspace-api). Mỗi module là một `namespace`.
> ID là **UUID v7 (string)**; collection đặt tiền tố theo module (`org_*`). Module đầu tiên đã chuẩn hoá: **Organization**.

```mermaid
classDiagram
    direction LR

    namespace Organization {
        class DEPARTMENT {
            id uuid PK
            code string UK
            name string
            description string
            parentDepartmentId uuid FK nullable
            managerId string nullable
            status enum active/archived
            createdAt datetime
        }
        class POSITION {
            id uuid PK
            code string UK
            title string
            departmentId uuid FK
            level int 1..10
            description string
            status enum active/archived
            createdAt datetime
        }
    }

    %% --- Cây phòng ban (tự tham chiếu) ---
    DEPARTMENT "0..1" --> "0..*" DEPARTMENT : parent → children

    %% --- Phòng ban chứa vị trí ---
    DEPARTMENT "1" --> "0..*" POSITION : contains

    %% --- Seam liên-module (dự kiến, chưa có ở pilot) ---
    %% DEPARTMENT.managerId ..> EMPLOYEE.id  (module Employee, eventual qua EventBus)
    %% POSITION.id ..> EMPLOYEE.positionId   (module Employee)

namespace IAM {
    class USER {
        id objectId PK
        username string UK
        email string UK
        password string hidden
        status enum active/disabled/locked
        employeeId objectId FK nullable UK
        mustChangePassword boolean
        lastLoginAt datetime nullable
        failedLoginAttempts int
        created_at datetime
        updated_at datetime
    }
    class ROLE {
        id objectId PK
        name string UK
        description string
        isSystem boolean
        created_at datetime
        updated_at datetime
    }
    class PERMISSION {
        id objectId PK
        key string UK
        resource string
        action enum create/read/update/delete/approve
        description string
        created_at datetime
        updated_at datetime
    }
    class USER_ROLE {
        id objectId PK
        userId objectId FK
        roleId objectId FK
        assignedAt datetime
        expiresAt datetime nullable
        created_at datetime
        updated_at datetime
    }
    class ROLE_PERMISSION {
        id objectId PK
        roleId objectId FK
        permissionId objectId FK
        created_at datetime
        updated_at datetime
    }
    class SESSION {
        id objectId PK
        userId objectId FK
        refreshTokenHash string
        userAgent string
        ip string
        expiresAt datetime TTL
        revokedAt datetime nullable
        created_at datetime
        updated_at datetime
    }
    class AUDIT_LOG {
        id objectId PK
        userId objectId FK nullable
        resource string
        action string
        resourceId objectId nullable
        changes mixed
        timestamp datetime
        created_at datetime
        updated_at datetime
    }
    class PASSWORD_SETUP_TOKEN {
        id objectId PK
        userId objectId FK
        tokenHash string
        purpose enum setup/reset
        expiresAt datetime TTL
        usedAt datetime nullable
        created_at datetime
        updated_at datetime
    }
}

%% --- User sở hữu vai trò qua bảng nối ---
USER "1" --> "0..*" USER_ROLE : has
ROLE "1" --> "0..*" USER_ROLE : assigned via

%% --- Vai trò sở hữu quyền qua bảng nối ---
ROLE "1" --> "0..*" ROLE_PERMISSION : has
PERMISSION "1" --> "0..*" ROLE_PERMISSION : granted via

%% --- Session & password-setup-token thuộc về user ---
USER "1" --> "0..*" SESSION : owns
USER "1" --> "0..*" PASSWORD_SETUP_TOKEN : owns

%% --- Audit log tham chiếu tuỳ chọn tới user thực hiện hành động ---
USER "0..1" --> "0..*" AUDIT_LOG : performs

%% --- Seam liên-module (đã có ở pilot) ---
%% USER.employeeId ..> EMPLOYEE.id  (module Employee, 1-1 khi được cấp tài khoản)

namespace Employee {
    class EMPLOYEE {
        id objectId PK
        employeeCode string UK
        fingerprintId string UK nullable
        userId objectId FK nullable
        departmentId objectId FK
        positionId objectId FK
        managerId objectId FK nullable
        shiftId objectId FK nullable
        hireDate datetime
        terminationDate datetime nullable
        employeeType enum full_time/part_time/contract/intern
        status enum onboarding/active/on_leave/terminated
        salaryZone enum zone1/zone2/zone3/zone4 nullable
        created_at datetime
    }
    class EMPLOYEE_PROFILE {
        id objectId PK
        employeeId objectId FK UK
        firstName string
        middleName string nullable
        lastName string
        dateOfBirth datetime nullable
        gender enum male/female/other/undisclosed
        nationality string
        maritalStatus enum single/married/divorced/widowed
        avatarUrl string nullable
        avatarId string nullable
        email string nullable
        workEmail string nullable
        phone string nullable
        address string nullable
        socialInsuranceNo string nullable
        taxCode string nullable
        vehiclePlate string nullable
    }
    class EMPLOYEE_CONTACT {
        id objectId PK
        employeeId objectId FK
        name string
        relationship enum spouse/parent/sibling/other
        phone string nullable
        email string nullable
        address string nullable
        isPrimary boolean
    }
    class EMPLOYEE_BANK_ACCOUNT {
        id objectId PK
        employeeId objectId FK
        bankName string
        branch string nullable
        accountNumber string
        accountHolder string
        isPrimary boolean
    }
    class EMPLOYEE_DOCUMENT {
        id objectId PK
        employeeId objectId FK
        documentType enum id_card/passport/degree/certificate/visa/other
        documentNumber string
        fileUrl string nullable
        issuedDate datetime nullable
        expiryDate datetime nullable
        issuedBy string nullable
    }
    class EMPLOYEE_CONTRACT {
        id objectId PK
        employeeId objectId FK
        contractType enum fixed_term/indefinite
        employmentStatus enum probation/official/internship
        contractNumber string UK
        startDate datetime
        endDate datetime nullable
        baseSalary decimal128
        currency string
        fileUrl string nullable
        status enum active/expired/terminated
    }
    class EMPLOYEE_ASSET {
        id objectId PK
        employeeId objectId FK
        assetName string
        assetCode string UK
        assignedDate datetime
        returnedDate datetime nullable
        condition enum new/good/fair/damaged
        note string nullable
    }
    class EMPLOYEE_HISTORY {
        id objectId PK
        employeeId objectId FK
        eventType enum hired/promotion/transfer/salary_change/contract_renew/info_update/terminated
        fromValue json nullable
        toValue json nullable
        effectiveDate datetime
        note string nullable
        createdBy objectId FK nullable
    }
}

%% --- Nhân viên có đúng một profile ---
EMPLOYEE "1" --> "1" EMPLOYEE_PROFILE : has

%% --- Nhân viên có nhiều liên hệ / tài khoản NH / tài liệu / hợp đồng / tài sản / lịch sử ---
EMPLOYEE "1" --> "0..*" EMPLOYEE_CONTACT : has
EMPLOYEE "1" --> "0..*" EMPLOYEE_BANK_ACCOUNT : has
EMPLOYEE "1" --> "0..*" EMPLOYEE_DOCUMENT : has
EMPLOYEE "1" --> "0..*" EMPLOYEE_CONTRACT : has
EMPLOYEE "1" --> "0..*" EMPLOYEE_ASSET : has
EMPLOYEE "1" --> "0..*" EMPLOYEE_HISTORY : has

%% --- Tự tham chiếu quản lý trực tiếp ---
EMPLOYEE "0..1" --> "0..*" EMPLOYEE : manager → reports

%% --- Seam liên-module ---
%% EMPLOYEE.userId ..> IAM.User.id           (module iam)
%% EMPLOYEE.departmentId ..> Organization.DEPARTMENT.id
%% EMPLOYEE.positionId ..> Organization.POSITION.id
%% EMPLOYEE.shiftId ..> Attendance.SHIFT.id  (module attendance, chưa port)

namespace Attendance {
    class SHIFT {
        id objectId PK
        name string
        type enum morning/afternoon/full_day
        startTime string HH:mm
        endTime string HH:mm
        breakMinutes int
        weight float 0..1
        workingDays int[] ISO 1..7
        effectiveFrom datetime nullable
        effectiveTo datetime nullable
        status enum active/archived
        createdAt datetime
    }
    class HOLIDAY {
        id objectId PK
        name string
        date datetime
        isRecurring boolean
        country string ISO code or *
        description string nullable
        createdAt datetime
    }
    class ATTENDANCE_SYMBOL {
        id objectId PK
        code string UK
        label string
        paidStatus enum paid/unpaid/neutral
        affectsPayroll boolean
        leaveType string nullable
        color string nullable
        appliesTo enum AttendanceStatus nullable
        createdAt datetime
    }
    class ATTENDANCE {
        id objectId PK
        employeeId objectId FK
        date datetime VN calendar day 00:00 UTC
        session enum morning/afternoon/full_day
        shiftId objectId FK nullable
        checkIn datetime nullable
        checkOut datetime nullable
        status enum present/late/early_leave/incomplete/absent/leave_paid/leave_unpaid/holiday
        workHours float nullable
        congWeight float nullable
        lateMinutes int
        earlyMinutes int
        leaveRequestId objectId FK nullable
        source string manual/self/leave
        note string nullable
        createdBy objectId FK nullable
        adjustedBy objectId FK nullable
        adjustedAt datetime nullable
        createdAt datetime
    }
    class LEAVE_REQUEST {
        id objectId PK
        employeeId objectId FK
        leaveType enum annual/sick/personal/unpaid/maternity/paternity
        startDate datetime
        endDate datetime
        days float
        halfDaySession enum morning/afternoon nullable
        reason string nullable
        status enum pending/approved/rejected/cancelled
        approverId objectId FK nullable
        approvedAt datetime nullable
        rejectionReason string nullable
        createdBy objectId FK nullable
        createdAt datetime
    }
    class LEAVE_BALANCE {
        id objectId PK
        employeeId objectId FK
        leaveType enum annual/sick/personal/unpaid/maternity/paternity
        year int
        entitled float 0 = unlimited (unpaid)
        used float
        createdAt datetime
    }
}

%% --- Ca làm áp dụng cho bản ghi chấm công ---
SHIFT "0..1" --> "0..*" ATTENDANCE : defines window for

%% --- Mỗi nhân viên có N bản ghi chấm công / N đơn nghỉ / N quỹ phép ---
EMPLOYEE "1" --> "0..*" ATTENDANCE : has
EMPLOYEE "1" --> "0..*" LEAVE_REQUEST : submits
EMPLOYEE "1" --> "0..*" LEAVE_BALANCE : has (per type/year)

%% --- Đơn nghỉ đã duyệt sinh ra bản ghi chấm công tương ứng (idempotent theo leaveRequestId) ---
LEAVE_REQUEST "1" --> "0..*" ATTENDANCE : generates (source='leave')

%% --- Ký hiệu chấm công là bảng tra cứu hiển thị, không FK trực tiếp tới ATTENDANCE.status ---
ATTENDANCE_SYMBOL "0..*" ..> ATTENDANCE : renders (by appliesTo = status)

%% --- Ngày lễ dùng để loại trừ khi tính ngày làm việc / ngày nghỉ ---
HOLIDAY "0..*" ..> LEAVE_REQUEST : excluded from day count

%% --- Seam liên-module (dự kiến, chưa có ở pilot) ---
%% ATTENDANCE.employeeId / LEAVE_REQUEST.employeeId / LEAVE_BALANCE.employeeId ..> EMPLOYEE.id (module Employee)
%% LEAVE_REQUEST (approved/rejected/revoked) --emit--> leave.decided --> Payroll (dự kiến, điều chỉnh ngày công tính lương)

## Ghi chú

- **`ATTENDANCE`** — một bản ghi mỗi `(employeeId, date, shiftId)`; unique index partial (bỏ qua khi `shiftId` null). Mỗi ngày có N ca (theo `SHIFT.workingDays` + `effectiveFrom/To`), mỗi ca đóng góp `congWeight = 1/N` để tổng công một ngày luôn là 1.0 dù có bao nhiêu ca.
- **`ATTENDANCE.source`** — `'self'` (nhân viên tự check-in/out), `'manual'` (HR nhập/sửa), `'leave'` (sinh tự động từ đơn nghỉ đã duyệt). Bản ghi `source:'leave'` không bao giờ bị `UpsertDay`/`Adjust` ghi đè hoặc xoá ngoài luồng nghỉ phép.
- **`LEAVE_REQUEST.days`** — số ngày làm việc (loại trừ cuối tuần + `HOLIDAY`); nghỉ nửa ngày (`halfDaySession`) = 0.5 và chỉ áp dụng cho khoảng 1 ngày.
- **`LEAVE_BALANCE`** — khoá duy nhất `(employeeId, leaveType, year)`. Phép năm (`annual`) dùng cơ chế **pooled carry-over**: cộng dồn `entitled - used` trong cửa sổ 3 năm gần nhất (năm hiện tại + 2 năm trước) khi tính "còn lại".
- **Collection**: `shifts`, `holidays`, `attendanceSymbols`, `attendances`, `leaveRequests`, `leaveBalances`.
- **Index**: `attendances { employeeId:1, date:1, shiftId:1 }` unique (partial khi `shiftId` là ObjectId), `{ date:1 }`; `leaveRequests { employeeId:1, status:1 }`; `leaveBalances { employeeId:1, leaveType:1, year:1 }` unique; `attendanceSymbols { code:1 }` unique.

## Module chờ port

`iam`, `employee`, `payroll`, `performance` — sẽ bổ sung namespace tương ứng khi được viết lại theo cùng khuôn.

namespace Payroll {
    class PAYROLL_PERIOD {
        id uuid PK
        name string UK "YYYY-MM"
        startDate datetime
        endDate datetime
        payDate datetime
        standardWorkDays int
        status enum open/processing/closed/paid
        closedAt datetime nullable
        closedBy uuid FK nullable
        attendanceLockedAt datetime nullable
        attendanceLockedBy uuid FK nullable
        evaluationLockedAt datetime nullable
        evaluationLockedBy uuid FK nullable
        createdBy uuid FK nullable
        createdAt datetime
    }
    class PAYROLL {
        id uuid PK
        payrollPeriodId uuid FK
        employeeId uuid FK
        contractId uuid FK nullable
        policyConfigId uuid FK nullable
        monthlyEvaluationId uuid FK nullable
        standardWorkDays int
        actualWorkDays int
        unpaidLeaveDays int
        workDays int
        attendanceRatio float
        performanceRatio float
        goalRatio float
        attendanceComponent money "Decimal128"
        performanceComponent money "Decimal128"
        goalComponent money "Decimal128"
        baseSalary money "Decimal128"
        proRatedBaseSalary money "Decimal128"
        totalTaxableAllowances money "Decimal128"
        totalNonTaxableAllowances money "Decimal128"
        totalAllowances money "Decimal128"
        overtimePay money "Decimal128"
        totalBonuses money "Decimal128"
        grossSalary money "Decimal128"
        insuranceBase money "Decimal128"
        unemploymentInsuranceBase money "Decimal128"
        socialInsurance money "Decimal128"
        healthInsurance money "Decimal128"
        unemploymentInsurance money "Decimal128"
        insurance money "Decimal128"
        employerSocialInsurance money "Decimal128"
        employerHealthInsurance money "Decimal128"
        employerUnemploymentInsurance money "Decimal128"
        employerOccupationalInsurance money "Decimal128"
        taxableIncome money "Decimal128"
        personalDeduction money "Decimal128"
        dependentDeduction money "Decimal128"
        dependentsCount int
        taxableIncomeAfterDeduction money "Decimal128"
        tax money "Decimal128"
        unionFee money "Decimal128"
        otherDeductions money "Decimal128"
        totalDeductions money "Decimal128"
        netSalary money "Decimal128"
        leaveDays int
        status enum draft/approved/paid
        approvedBy uuid FK nullable
        paidAt datetime nullable
        computedAt datetime nullable
        createdAt datetime
    }
    class ALLOWANCE {
        id uuid PK
        employeeId uuid FK
        name string
        category enum position/responsibility/transport/meal/housing/phone/other
        type enum fixed/percentage
        amount money "Decimal128 — VND hoặc % lương cơ bản theo type"
        isTaxable boolean
        isInsuranceBase boolean
        effectiveDate datetime
        endDate datetime nullable
        note string nullable
        createdBy uuid FK nullable
        createdAt datetime
    }
    class BONUS {
        id uuid PK
        employeeId uuid FK
        payrollPeriodId uuid FK
        name string
        amount money "Decimal128"
        isTaxable boolean
        reason string nullable
        approvedBy uuid FK nullable
        createdBy uuid FK nullable
        createdAt datetime
    }
    class DEDUCTION {
        id uuid PK
        employeeId uuid FK
        payrollPeriodId uuid FK nullable "null = lặp lại mỗi kỳ"
        name string
        type enum fixed/percentage
        amount money "Decimal128 — VND hoặc % lương gộp theo type"
        reason string nullable
        effectiveDate datetime
        endDate datetime nullable
        createdBy uuid FK nullable
        createdAt datetime
    }
    class EMPLOYEE_TAX_PROFILE {
        id uuid PK
        employeeId uuid FK
        taxCode string UK nullable "MST, sparse unique"
        isResident boolean
        dependentsCount int
        insuranceAmount float nullable "mức đóng BHXH cố định, VND"
        effectiveDate datetime
        endDate datetime nullable
        note string nullable
        createdBy uuid FK nullable
        createdAt datetime
    }

    %% --- Kỳ lương chứa các dòng lương đã tính ---
    PAYROLL_PERIOD "1" --> "0..*" PAYROLL : computed for

    %% --- Bonus gắn với đúng một kỳ lương ---
    PAYROLL_PERIOD "1" --> "0..*" BONUS : one-off in

    %% --- Deduction có thể gắn một kỳ cụ thể (one-off) hoặc lặp lại (payrollPeriodId null) ---
    PAYROLL_PERIOD "0..1" --> "0..*" DEDUCTION : applies once to

    %% --- Seam liên-module (EMPLOYEE, CONTRACT, SALARY_POLICY_CONFIG, MONTHLY_EVALUATION thuộc module khác) ---
    %% PAYROLL.employeeId ..> EMPLOYEE.id           (module Employee)
    %% PAYROLL.contractId ..> EMPLOYEE_CONTRACT.id   (module Employee)
    %% PAYROLL.policyConfigId ..> SALARY_POLICY_CONFIG.id (shared/models, chưa port sang namespace riêng)
    %% PAYROLL.monthlyEvaluationId ..> MONTHLY_EVALUATION.id (module Performance)
    %% ALLOWANCE.employeeId / BONUS.employeeId / DEDUCTION.employeeId / EMPLOYEE_TAX_PROFILE.employeeId ..> EMPLOYEE.id (module Employee)
}

## Ghi chú (Payroll)

- **Money fields** (`Decimal128`) — mọi trường tiền trong `PAYROLL`, `ALLOWANCE.amount`, `BONUS.amount`, `DEDUCTION.amount` dùng `Schema.Types.Decimal128` (không phải `Number`), theo quy ước tiền tệ của dự án.
- **`PAYROLL` là dòng theo (kỳ, nhân viên, hợp đồng)** — unique index `{ payrollPeriodId, employeeId, contractId }`; một nhân viên đổi hợp đồng giữa kỳ (vd. thực tập → thử việc) sinh nhiều dòng lương trong cùng kỳ, mỗi dòng ứng với một hợp đồng (`contractId = null` cho dữ liệu cũ một-hợp-đồng).
- **Không có model riêng cho "Compensation" hay "Workday"** — "Compensation" là nhóm nghiệp vụ gộp `ALLOWANCE` + `BONUS` + `DEDUCTION` + `EMPLOYEE_TAX_PROFILE`; "ngày công" (workday) không phải một collection riêng mà là các trường `standardWorkDays/actualWorkDays/unpaidLeaveDays/workDays` được snapshot trực tiếp vào `PAYROLL` từ tổng hợp chấm công (module Attendance) tại thời điểm chạy lương.
- **`EMPLOYEE_TAX_PROFILE` và `ALLOWANCE`/`DEDUCTION` là versioned theo `effectiveDate`** — thêm bản ghi mới (append-only) thay vì sửa đè, để payroll snapshot đúng giá trị hiệu lực tại thời điểm tính lương và giữ lịch sử thay đổi.
- **Collection**: `payrollPeriods`, `payrolls`, `allowances`, `bonuses`, `deductions`, `employeeTaxProfiles`.
- **Index**: `payrollPeriods { name:1 } unique`, `{ status:1 }`; `payrolls { payrollPeriodId:1, employeeId:1, contractId:1 } unique`, `{ payrollPeriodId:1 }`, `{ employeeId:1 }`, `{ status:1 }`; `allowances { employeeId:1, effectiveDate:-1 }`; `bonuses { employeeId:1, payrollPeriodId:1 }`; `deductions { employeeId:1, payrollPeriodId:1 }`; `employeeTaxProfiles { taxCode:1 } unique sparse`, `{ employeeId:1, effectiveDate:-1 }`.

namespace Performance {
    class MONTHLY_EVALUATION {
        id string PK
        employeeId string FK
        payrollPeriodId string FK
        managerScores CriterionScore[]
        managerId string FK nullable
        managerNote string nullable
        managerSubmittedAt datetime nullable
        criteriaScores CriterionScore[]
        performanceRatio number 0..100
        goalResult number 0..100
        goalRatio number 0..100
        evaluatedBy string FK nullable
        status enum draft/approved/acknowledged
        approvedAt datetime nullable
        strengths string nullable
        improvements string nullable
        developmentPlan string nullable
        acknowledgedAt datetime nullable
        acknowledgedBy string FK nullable
        disputeNote string nullable
        note string
        createdAt datetime
    }
    class PERFORMANCE_CRITERION {
        id string PK
        key string UK
        label string
        description string
        type enum performance/goal
        order int
        status enum active/archived
        createdAt datetime
    }
}

Relations:
- MONTHLY_EVALUATION.employeeId --> employee.EMPLOYEE.id (1 nhân viên có nhiều đánh giá theo kỳ; unique theo employeeId+payrollPeriodId)
- MONTHLY_EVALUATION.payrollPeriodId --> payroll.PAYROLL_PERIOD.id (mỗi kỳ lương gom nhiều đánh giá; payroll đọc performanceRatio/goalRatio khi tính lương)
- MONTHLY_EVALUATION.managerId --> employee.EMPLOYEE.id (quản lý trực tiếp chấm managerScores, tuỳ chọn)
- MONTHLY_EVALUATION.evaluatedBy --> iam.USER.id (HR/admin đã chốt đánh giá)
- MONTHLY_EVALUATION.acknowledgedBy --> iam.USER.id (thường trùng user của employeeId — người xác nhận)
- MONTHLY_EVALUATION.criteriaScores[].criterionId --> PERFORMANCE_CRITERION.id (điểm từng chỉ tiêu tham chiếu chỉ tiêu đang hoạt động)
- PERFORMANCE_CRITERION.type — phân nhóm chỉ tiêu để tính hai ratio độc lập: performance (nhóm Hiệu suất, feeds 60% lương) và goal (nhóm Mục tiêu, feeds 20% lương)

Ghi chú:
- Collection: `monthlyEvaluations`, `performanceCriteria`.
- Index: `monthlyEvaluations { employeeId:1, payrollPeriodId:1 } unique`; `{ employeeId:1 }`; `{ payrollPeriodId:1 }`; `{ status:1 }`. `performanceCriteria { key:1 } unique`; `{ type:1 }`; `{ status:1 }`.
- `performanceRatio`/`goalRatio` là trung bình cộng đơn giản (không trọng số) của điểm các chỉ tiêu active thuộc mỗi nhóm — payroll tiêu thụ hai giá trị này khi đánh giá ở trạng thái `approved` trở lên.
- Kỳ lương có thể "chốt đánh giá" (`evaluationLockedAt` trên PayrollPeriod, thuộc module payroll) — khi đã chốt, không thể chấm/sửa/mở lại đánh giá của kỳ đó.
```

## Ghi chú

- **`DEPARTMENT.parentDepartmentId`** — tự tham chiếu tạo cây phòng ban toàn công ty. Reparent chặn chu trình (không cho cha mới nằm trong cây con).
- **`DEPARTMENT.managerId`** — id trưởng phòng, hiện là **string mờ** (chưa ràng buộc). Khi có module Employee, đây là FK tới `EMPLOYEE.id`, đồng bộ eventual qua EventBus (`employee.employee.terminated` → gỡ head).
- **`POSITION.code`, `DEPARTMENT.code`** — unique index; chuẩn hoá trim + in hoa ở tầng domain (VO).
- **Collection**: `org_departments`, `org_positions`.
- **Index**: `org_departments { code:1 } unique`, `{ parentDepartmentId:1 }`; `org_positions { code:1 } unique`, `{ departmentId:1 }`.

## Module chờ port

`iam`, `employee`, `attendance`, `payroll`, `performance` — sẽ bổ sung namespace tương ứng khi được viết lại theo cùng khuôn.

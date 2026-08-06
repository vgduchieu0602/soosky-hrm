# Backend: Soosky HRM

## Kiến trúc

Hexagonal / Ports-and-Adapters + DDD, **modular monolith** — dựng theo đúng khuôn dự án `soosky-workspace-api`. Mỗi module tách được thành service riêng.

## Tech Stack

- Language: TypeScript (strict)
- Framework: Express 5
- Database: MongoDB qua **raw `mongodb` driver v7** (KHÔNG Mongoose)
- ID: **UUID v7** (string)
- Validation: `bodySchema`/`field` thủ công (`@shared/adapters/driver/http/validation`) — KHÔNG Zod
- Logging: `console` — KHÔNG Pino
- Test: Vitest (+ vitest-mock-extended, supertest).
  - Unit ở `tests/**/*.test.ts` — chạy offline, không cần hạ tầng.
  - Integration ở `tests-integration/**/*.test.ts` — chạy trên MongoDB replica set thật (`vitest.integration.config.ts`).
- Package manager: **pnpm** (bắt buộc — `preinstall` chặn npm/yarn)

## Cấu trúc

```
src/
├── server.ts            # entry HTTP (composition root)
├── cli.ts               # entry CLI (bootstrap super admin, ...)
├── infra/               # config, db, di (factory thủ công), events, server
├── shared/              # kernel: core/domain (Entity/AggregateRoot/DomainEvent/EventBus),
│                        #         core/app/errors, adapters/driver/http (validation, ActorContext,
│                        #         authenticate, errorHandler), ports
└── modules/
    ├── auth/            # TÁI DÙNG NGUYÊN từ soosky-workspace-api — account + session
    ├── iam/             # RBAC: roles, permissions, user-role, audit; consume auth events → user projection
    ├── department/      # phòng ban (cây) + vị trí
    ├── employee/        # hồ sơ nhân viên + hợp đồng/tài liệu/...
    ├── attendance/      # ca, chấm công, nghỉ phép
    ├── payroll/         # kỳ lương, tính lương, phiếu lương
    └── setting/         # cấu hình công ty/hệ thống
```

## Anatomy 1 module (theo auth/task-mgmt)

```
modules/<m>/
  index.ts                       # barrel công khai (chỉ export ở đây mới cross-module)
  core/
    domain/  entities/ value-objects/ errors/ events/
    app/     use-cases/ (1 class/use-case, execute()) ports/ errors/ services/
  adapters/
    driver/  http/ (controllers/ presenters/ index.ts=router) cli/ events/
    driven/  persistence/mongodb/ (repositories/ mappers/ documents/ MongoRepository MongoUnitOfWork collections.ts index.ts) security/ mail/
```

## Quy ước (BẮT BUỘC theo dự án gốc)

- 1 class / use-case, `execute(input)`, Input/Output đồng vị trí, JSDoc `@throws` tiếng Việt.
- Lỗi 3 tầng: `DomainError` (422/409) / `ApplicationError` (404/403) / `HttpRequestError` (400/401) → envelope `{ code, message }`. Success KHÔNG bọc envelope.
- Mapper + Document + `rehydrate`; id UUIDv7; collection tiền tố module (`iam_`, `org_`/`dept_`, `pay_`, `att_`, `emp_`, `set_`).
- `MongoRepository` base + `MongoUnitOfWork` cho multi-write.
- Liên-module qua port cục bộ do host application nối ở composition root, hoặc qua `EventBus` khi cần bất đồng bộ; KHÔNG import chéo module.
- File = tên export (PascalCase); private prefix `_`; format căn cột; mô tả tiếng Việt, identifier tiếng Anh.
- Path aliases: `@modules/*`, `@shared/*`, `@infra/*`, `@tests/*`.
- Mỗi repo có `static ensureIndexes(db)`, gom trong `infra/db/ensureMongoIndexes.ts`.
- Thêm module: tạo `modules/<m>/`, export router + `<M>HttpUseCases` từ `index.ts`, thêm DI factory `infra/di/`, mount trong `createExpressServer.ts` + `server.ts`, thêm ensureIndexes.

## Phân quyền (BẮT BUỘC nhớ khi thêm use-case)

- Use-case GHI: `permissions.assertPermission(actorUserId, "<resource>:<action>")`.
- Use-case ĐỌC dữ liệu theo người: `permissions.resolveScope(...)` → `all|team|self`, rồi tự thu hẹp dữ liệu.
  Employee dùng `EmployeeAccessScope`; Attendance dùng `LeaveAccessScope` (nộp/huỷ/xem đơn nghỉ,
  số dư phép) và `LeaveDecisionAuthorizer` (duyệt/từ chối). Mỗi nhóm hành động một khoá gốc riêng.
- Quy ước khoá: `shared/core/app/authorization/PermissionScope.ts`. Hậu tố `:team`/`:self`
  là bản thu hẹp; `<resource>:manage` bao trùm mọi action của resource.
- Tự phục vụ: `employeeId` bỏ trống ở endpoint đọc/nộp nghĩa là "chính actor", suy ra qua
  `EmployeeDirectory.findEmployeeIdByUserId` — client không tự gửi id để tránh mạo danh.
  `SubjectScope` (attendance) là chỗ DUY NHẤT phân giải chuyện này; `LeaveAccessScope` và
  `AttendanceAccessScope` chỉ là lớp đặt tên mỏng trên nó.
- GHI chấm công CHỈ `attendance:manage` (HR/Admin) — không có `attendance:*:self`. ĐỌC có phạm vi.
- MỌI đường ghi bảng công phải đi qua `AttendanceDayWriter` (HR nhập tay + chỉnh công được duyệt):
  nó lo timezone công ty, ngày lễ, thiếu giờ ra, và CHẶN khi kỳ công đã chốt. Thêm đường ghi mới
  mà không qua đây = chốt kỳ mất hiệu lực.
- Duyệt (`*:approve`) KHÔNG được dùng `SubjectScope.assertInScope`: quy tắc "chính mình thì được"
  của nó đúng cho gửi/xem nhưng SAI cho duyệt (Manager tự duyệt yêu cầu của mình). Xem
  `AttendanceAccessScope.assertCanDecideCorrection` và `LeaveDecisionAuthorizer`.
- Đánh giá: `PerformanceAccessScope.assertCanScore` cũng KHÔNG cho "chính mình thì được" — tự chấm
  điểm cho bản thân là xung đột lợi ích. Duyệt/khoá điểm chỉ `performance:manage` (HR).

## Lương: quy trình 7 bước (BẤT BIẾN, đừng phá)

- `PayrollPeriod` có HAI trường trạng thái: `status` (4 giá trị cũ — hợp đồng FE đang đọc) và
  `stage` (7 bước thật). Mọi chuyển bước phải đi qua method của entity; `status` được entity tự
  giữ đồng bộ. Đừng set `status` trực tiếp ở use-case.
- Thứ tự: `open` → `reconciling` (chốt công) → `trial` (đã tính lương) → `hr_reviewed`
  (`markHrReviewed`) → `approved` (`markApproved`) → `paid` (`markPaid`) → `closed` (`close`).
  Sai thứ tự = `PayrollStageInvalidError` (409 `PAYROLL_STAGE_INVALID`).
- Kiểm bước TRƯỚC khi ghi dữ liệu: `ApprovePayrollUseCase` gọi `period.markApproved()` trước vòng
  lặp duyệt phiếu. Đặt sau vòng lặp thì một lần bấm sớm vẫn kịp chuyển phiếu sang `approved` rồi
  mới báo lỗi (repo in-memory của test không rollback như transaction Mongo).
- Đổi đầu vào là xoá xác nhận: `markPrepared` (tính lại) lùi về `trial`, `unlockAttendance`/
  `unlockEvaluations` lùi về `reconciling`, `reopen` lùi về `trial` — tất cả xoá `hrReviewedBy/At`.
- Document cũ không có `stage`: mapper suy ra từ `status` (`processing` → `approved`). Không cần
  migration; đừng đổi hàm `stageFromStatus` thành mặc định `reconciling`.

## Lương: file chuyển khoản (BẤT BIẾN, đừng phá)

- Định dạng file ngân hàng KHÔNG hard-code. `BankTransferProfile` (module Setting) mô tả cột/dấu
  phân cách/định dạng; Payroll đọc qua port `BankTransferProfileDirectory` và chỉ biết mô tả cột.
  Thêm `source` mới vào `BANK_COLUMN_SOURCES` thì PHẢI xử lý nó trong
  `ExportBankTransferFileUseCase.cellValue`, nếu không cột ra rỗng.
- `source` lạ ra ô RỖNG, không throw — hồ sơ cấu hình bởi bản mới hơn không được làm chết cả lệnh chi.
- Xuất file là quyền `payroll:approve` (lệnh chi, không phải báo cáo). Đừng đổi sang `prepare`.
- Chỉ phiếu `approved`/`paid` vào file. Mọi trường hợp bị loại (draft, chưa có tài khoản ngân hàng,
  net = 0) PHẢI nằm trong `skipped` — endpoint trả JSON chứ không phải file thuần chính là vì thế.
- Đúng MỘT hồ sơ `isActive`; `ActivateBankTransferProfileUseCase` tự tắt hồ sơ cũ. Hồ sơ đang bật
  không xoá được.

## Lương: chạy song song hai engine (BẤT BIẾN, đừng phá)

- `PAYROLL_ENGINE_VERSION = "v2"`. `computePayroll(input, engineVersion)` — nhánh `v1` BỎ `segments` và
  BỎ hồi tố để tái hiện đúng hành vi cũ. Đừng "dọn" nhánh này: không có nó thì bảng đối soát so hai
  thứ chưa ai từng chạy.
- Đối soát chạy `RunPayrollForEmployeeUseCase` với `dryRun: true` — không lưu phiếu, không
  `markPrepared`, không tăng `recomputeCount`. Thêm đường ghi nào vào use-case đó thì phải bọc trong
  `if (!dryRun)`.
- Chữ ký gắn với CON SỐ: `PayrollVariance.redetect` xoá chữ ký khi số đổi, giữ khi số y nguyên.
- Chỉ so sáu chỉ tiêu (`COMPARED_FIELDS`), không so cả `breakdown` — một lệch gốc kéo theo hàng chục
  ô phái sinh.
- Cổng chặn nằm ở `MarkPayrollHrReviewedUseCase` (`countUnsigned > 0` -> 409
  `PAYROLL_VARIANCE_UNSIGNED`). Kỳ chưa đối soát không có bản ghi nên không bị chặn — đó là chủ ý,
  đừng đổi thành "bắt buộc đối soát mọi kỳ" mà không migrate dữ liệu cũ.
- Ký nhận CẢ `payroll:prepare` và `payroll:approve` (yêu cầu nghiệp vụ: HR/Admin ký). Bốn mắt vẫn
  nằm ở bước duyệt kỳ — đừng thêm rào "người ký phải khác người lập" ở đây.

## Lương: bốn mắt + truy vết + đoạn hợp đồng (BẤT BIẾN, đừng phá)

- Quyền TÁCH: `payroll:prepare` (lập/tính/tính lại/hoàn tác) vs `payroll:approve` (duyệt/mark
  paid/chốt/mở lại kỳ). `hr` chỉ có `prepare`. Ngoài tách quyền còn có rào ở use-case:
  `period.preparedBy === approver` -> 403 `PAYROLL_SELF_APPROVAL_FORBIDDEN`. Rào này CHẶN cả
  admin giữ `*` — đừng bỏ nó khi thấy "đã tách quyền rồi".
- `preparedBy` ghi ở MỖI lần chạy tính lương (người chịu trách nhiệm số đang chờ duyệt), không
  phải người tạo kỳ.
- Payslip lưu `inputs` (bản chụp: engineVersion, salaryPolicyId, taxProfileId, ids
  allowance/bonus/deduction, contractIds, computedBy, recomputeCount). Thêm đầu vào mới vào công
  thức thì PHẢI thêm id của nó vào bản chụp, nếu không phép tính không tái lập được.
- `recomputeCount` do `Payslip.recompute` tự cộng dồn; caller truyền `recomputeCount: 0`.
- `PAYROLL_ENGINE_VERSION` trong `salary-calc.ts`: đổi bất cứ thứ gì làm cùng đầu vào ra số khác
  thì PHẢI tăng version.
- Đổi hợp đồng giữa kỳ: `computePayroll({ segments })`. Mỗi đoạn cần CẢ HAI tỷ lệ —
  `attendanceRatio` (ngày công thực tế/ngày công kỳ) cho phần chuyên cần, và `periodShare`
  (ngày lịch của đoạn/ngày lịch kỳ) cho phần hiệu suất+mục tiêu. Thiếu `periodShare` thì hai
  đoạn nửa tháng trả 180% lương (đã có test chặn: `salary-calc-segments.test.ts`).
- Bảo hiểm và THUẾ tính MỘT LẦN trên tổng tháng, không cộng theo đoạn — thuế luỹ tiến và trần BH
  là quy tắc tháng.
- Hai hợp đồng active phủ cùng ngày bị `ContractOverlapError` chặn ở lúc tạo, nên `contractSegments`
  không bao giờ trả về đoạn chồng nhau.
- Hồi tố (`RetroAdjustment`): truy lĩnh cộng vào GROSS kỳ chi trả và chịu thuế ở kỳ đó; truy thu
  khấu trừ SAU thuế. Đừng "gọn hơn" bằng cách trừ truy thu trước thuế — kỳ gốc đã nộp thuế trên
  số tiền đó, trừ trước thuế lần nữa là giảm thuế hai lần. `taxable` chỉ có nghĩa với `claim`.
- Hồi tố KHÔNG mở lại kỳ gốc: `originPeriodId` chỉ để truy vết, kỳ gốc vẫn `closed`. Kỳ CHI TRẢ
  mới phải còn mở. Cùng kỳ gốc = kỳ chi trả thì đó là bonus/deduction, không phải hồi tố (chặn ở
  `RetroAdjustment.rehydrate`).
- Huỷ hồi tố = đánh dấu `cancelled` + người huỷ + lý do, KHÔNG xoá; và chỉ khi phiếu kỳ chi trả còn
  `draft`. Phiếu đã duyệt/đã chi thì phải tạo khoản hồi tố NGƯỢC ở kỳ sau.

## Đánh giá → Lương (BẤT BIẾN, đừng phá)

- Bộ tiêu chí: phiên bản BẤT BIẾN sau khi phát hành. Sửa tiêu chí = `publishVersion` (bản mới).
  Phiếu giữ `criteriaSetId` + `criteriaVersion` của riêng nó và `ScoreReviewUseCase` đọc tiêu chí
  theo số phiên bản TRÊN PHIẾU — không đọc "bản mới nhất". Đây là thứ giữ cho lịch sử đánh giá
  không tự đổi nghĩa.
- Điểm sang lương CHỈ qua `PayrollEvaluationSink.snapshotEvaluation` lúc KHOÁ phiếu. Payroll lưu bản
  chụp trong `PayrollPeriod.evaluations` và KHÔNG đọc lại phiếu khi tính lương. Đừng thêm đường nào
  cho Payroll query sang Performance để lấy điểm — làm vậy là phá yêu cầu "lương đã tính không đổi
  khi tiêu chí bị sửa".
- `EvaluationDirectory` (Payroll → Performance) chỉ trả TIẾN ĐỘ (ai đã khoá), không trả điểm.
- Điểm tổng hợp do backend tính (`computeReviewTotals`), không nhận từ client: nếu tin client thì ba
  con số vào lương có thể không khớp điểm chi tiết và không cách nào kiểm lại.
- Catalog quyền + 4 role hệ thống (`admin`/`hr`/`manager`/`employee`) ở `infra/db/seedIam.ts`.
  Thêm quyền mới = thêm vào catalog + gán vào role, KHÔNG hard-code trong use-case.
- Audit: module khai port `AuditTrail` (hình dạng `shared/core/app/audit/AuditEntry.ts`),
  composition root nối vào `createIamAuditTrail` — tất cả module ghi vào MỘT sổ (`iam_audit_logs`).
  Ghi audit không được làm thất bại nghiệp vụ chính (adapter tự nuốt lỗi + log).
- Mật khẩu tạm: `Account.mustChangePassword` → nhúng vào claim access token →
  `authenticate` CHẶN MẶC ĐỊNH mọi endpoint (403 `PASSWORD_CHANGE_REQUIRED`);
  mở ngoại lệ bằng `authenticate(verifier, { allowPendingPasswordChange: true })`.

## Hợp đồng với frontend (BẤT BIẾN, đừng phá)

- `tests/infra/route-manifest.test.ts` sinh `share-docs/api-routes.json` từ chính file router.
  Frontend có test đối chiếu mọi URL nó gọi với bản kê đó. Thêm/đổi route thì chạy lại test
  này (nó tự ghi file) và sửa frontend trong CÙNG lát cắt.
- Thành công KHÔNG bọc envelope. Đừng "chuẩn hoá" thành `{ data: ... }` — frontend đọc thẳng
  và test hợp đồng không bắt được kiểu lệch này.
- Bảng công nhiều người: `GET /attendance/records/visible` (phạm vi actor quyết định tập nhân
  viên). `GET /attendance/records` bỏ trống `employeeId` vẫn là "của CHÍNH tôi" — đừng đổi
  ngữ nghĩa đó, giao diện tự phục vụ dựa vào nó.
- Route tĩnh phải đăng ký TRƯỚC route có tham số cùng tiền tố (`/records/visible` trước
  `/records/:attendanceId`), nếu không Express bắt chuỗi tĩnh làm id.

## Tài liệu

- `../share-docs/{API-SPEC.md, DATABASE.md, BACKEND-CODE-STANDARD.md, MODULE-PORTABILITY.md}` — hợp đồng canonical hiện hành.

## Scripts

`pnpm dev` · `pnpm run build` (tsc && tsc-alias) · `pnpm start` · `pnpm test` (unit) ·
`pnpm run test:integration` (cần `docker compose -f ../docker-compose.test.yml up -d`) ·
`pnpm run typecheck` · `pnpm run cli`

## Lưu ý build

- `tsconfig.json` PHẢI giữ `"baseUrl": "."`. Thiếu nó, `tsc-alias` không đổi được
  `@infra/...` trong `dist/` thành đường dẫn tương đối khi build trên Linux → image
  Docker chết ngay lúc khởi động (`Cannot find module '@infra/...'`).
- Mọi router mount dưới `API_PREFIX` (`/api/v1`) trong `createExpressServer.ts`;
  đổi prefix thì phải đổi đồng bộ `frontend/nginx.conf` và build-arg
  `VITE_API_BASE_URL`.

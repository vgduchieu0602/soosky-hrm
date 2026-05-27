# KẾ HOẠCH DỰ ÁN: Soosky HRM — 50 Nhân viên

**Ngày lập:** 26/05/2026
**Người lập:** Claude AI (plan-builder skill)
**Version:** 1.0

---

## 📋 Tóm tắt dự án

- **Mục tiêu:** Triển khai hoàn toàn HRM system quản lý 50 nhân viên nội bộ với 6 features chính (IAM, Organization, Employee, Attendance, Payroll, Performance)
- **Thời gian:** 26/05/2026 → 01/07/2026 (6 tuần = 36 ngày)
- **Ngân sách:** 100 triệu VND
- **Nhân sự:** 4 người
  - 1 Backend dev (Mid-level)
  - 1 Frontend dev (Mid-level)
  - 1 DevOps (Senior)
  - 1 Product Owner / PM (Full-time)
- **Công nghệ:** Node.js, React 19, MongoDB, Express.js, TypeScript, pnpm
- **CI/CD:** GitHub Actions (sẵn có)
- **Database:** MongoDB self-hosted, replica set (required for transactions)
- **Loại dự án:** Phần mềm (Enterprise HRM)

---

## 1. 🧭 Hướng tiếp cận đề xuất

**Lựa chọn:** **Phased Parallel Development** (Giai đoạn song song)

**Lý do:**

1. **Timeline tight (6 tuần), 2 dev core (BE + FE):**
   - Không thể tuần-by-tuần từ từ → phải song song BE & FE từ sớm
   - Payroll là bottleneck (tính toán lương phức tạp, cần transaction) → phải tập trung 2 tuần mid-project

2. **6 features, phức tạp khác nhau:**
   - IAM & Organization = foundation (tuần 1) — mở đường cho các feature khác
   - Employee, Attendance = medium (tuần 2-3) — song song BE & FE
   - Payroll = blocking (tuần 3-4) — một vài feature khác phải chờ completion để test integration
   - Performance = lowest priority (tuần 4-5) — có thể finalize cuối

3. **Database-first approach:**
   - Schema finalized tuần 1 → Backend & DevOps configure MongoDB
   - API ready before FE integration → reduce surprises

4. **Testing & refinement built-in (tuần 5):**
   - Unit test + API test all tuần while building
   - Integration test + UAT tuần 5
   - Buffer for fixes + go-live prep tuần cuối

**Khuyến nghị đặc biệt:**

- **Daily standup (15 min, 9:30 AM)** — report blockers ngay, giảm integration risk
- **Feature flags** cho những tính năng phức tạp (payroll approval flow, performance review multi-source feedback) — enable/disable runtime nếu chưa kịp test
- **API-first testing** — BE phải ready API trước 2-3 ngày so với FE integration
- **Contingency: 1.5 dev-week buffer** in week 5-6 for bug fixes, refinement, UAT issues
- **DevOps tasks interleaved** — infrastructure setup week 1-2, CI/CD pipeline week 2, monitoring setup week 4-5

---

## 2. 📍 Các giai đoạn chính

| Giai đoạn | Mục tiêu | Đầu ra | Thời gian | Người chịu trách nhiệm |
|-----------|---------|--------|----------|----------------------|
| **Phase 1: Foundation & Setup** | Schema design finalized; IAM & Organization CRUD ready; CI/CD pipeline live | Database schema approved; IAM API (login/register/role mgmt) + routes; Organization API; GitHub Actions CI passing | Week 1 (26/5-1/6) | PO + Backend + DevOps |
| **Phase 2: Core Employee & Attendance** | Employee module fully functional; Attendance shift + check-in/out ready; Leave request flow drafted | Employee API (CRUD + profile + documents); Attendance API (shifts, daily records); LeaveRequest API; Frontend views for employee mgmt & attendance tracking | Week 2-3 (2/6-15/6) | PO + Backend + Frontend |
| **Phase 3: Payroll (Complex Logic)** | Payroll computation engine ready; Allowances, deductions, tax/insurance, payslip generation working | Payroll API (compute, approve, mark-paid); Salary structures, allowances, deductions CRUD; Payslip generator (PDF) + send; Treasury report ready | Week 3-4 (9/6-22/6) | PO + Backend (priority) |
| **Phase 4: Performance & Integration** | Performance management module ready; All 6 features integrated end-to-end; Comprehensive testing | Performance API (appraisal cycles, goals, KPIs, reviews, feedback); Full integration testing (all features + workflows); UAT checklist passed | Week 4-5 (16/6-29/6) | PO + Frontend + Backend |
| **Phase 5: Polish, Testing & Go-live** | 100% functionality verified; Performance optimized; Deployment ready; Documentation complete | All API tests pass (80%+ coverage); All UI happy paths + edge cases tested; Deployment checklist signed off; Runbook + post-launch support plan | Week 5-6 (23/6-1/7) | PO + Frontend + Backend + DevOps |

---

## 3. 📅 Phân chia công việc chi tiết

### **Tuần 1: Foundation & Setup (26/5 - 1/6)**

#### Database & Infrastructure
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Design + validate MongoDB schema (all 6 features) | Backend + PO | Schema document approved | 100% |
| Setup MongoDB replica set locally + Docker Compose | DevOps | Replica set running, connection string ready | 100% |
| Configure GitHub Actions CI pipeline (lint, test, build) | DevOps | PR validation working, tests run on push | 100% |
| Setup .env.example, config loader (Zod), database connection | Backend | Database connected, config validated at boot | 100% |

#### IAM Feature (Backend)
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create User, Role, Permission, UserRole, RolePermission, Session, AuditLog Mongoose models | Backend | Models exported, indexes defined | 100% |
| Implement User & Auth service (bcrypt hashing, JWT issue/refresh) | Backend | Login/refresh working via curl/Postman | 100% |
| Wire auth routes + controllers (POST /auth/login, POST /auth/refresh, POST /auth/logout) | Backend | Auth routes tested in Postman | 100% |
| Implement authenticate + requireRoles middleware | Backend | Routes protected, role-guard working | 100% |
| Create Role & Permission CRUD (admin only) | Backend | Roles/permissions can be created/read/updated | 100% |

#### Organization Feature (Backend)
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create Department, Position Mongoose models | Backend | Models with parent-child dept support, indexes | 100% |
| Implement Department & Position service + repository | Backend | Dept tree query working | 100% |
| Wire organization routes (CRUD for depts & positions) | Backend | Postman tests passing | 100% |

#### Frontend Setup
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Setup React 19 + Vite project, TypeScript, pnpm workspace | Frontend | Dev server running, build succeeds | 100% |
| Create auth layout, login page, JWT token persistence | Frontend | Login page renders, form submits to mock API | 100% |
| Integrate auth API (login/refresh/logout) | Frontend | Real login working, token stored, refresh working | 100% |
| Create layout shell + navigation placeholder | Frontend | App shell with sidebar navigation ready | 100% |

---

### **Tuần 2: Employee Module (2/6 - 8/6)**

#### Employee Feature (Backend)
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create Employee, EmployeeProfile, EmployeeDocument, EmployeeContact, EmployeeBankAccount, EmployeeContract, EmployeeHistory, EmployeeAsset models | Backend | All models created, relationships validated | 100% |
| Implement Employee service (CRUD + soft delete via status) | Backend | Employee create/read/update working | 95% |
| Implement account provisioning (grant-login: atomic transaction) | Backend | User created + Employee linked + UserRole assigned in single transaction | 90% |
| Implement EmployeeProfile, EmployeeDocument, EmployeeContact, EmployeeBankAccount services | Backend | All sub-entity services + repositories ready | 85% |
| Wire employee routes (POST, GET, PUT) + auth guards | Backend | All endpoints tested in Postman | 85% |
| Write unit tests for Employee service (80%+ coverage) | Backend | Tests passing, coverage report ready | 80% |

#### Attendance Feature (Backend) - Start
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create Shift, Attendance, LeaveRequest, LeaveBalance, Holiday models | Backend | Models with compound indexes, timestamps | 100% |
| Implement Shift service + repository | Backend | Shift CRUD working | 100% |
| Design attendance check-in/out logic (workHours, overtimeHours calculation) | Backend | Logic doc ready, formulas validated | 100% |
| Implement Attendance service (partial: create + read, check-in/out stub) | Backend | Basic CRUD working, check-in endpoint ready | 70% |

#### Frontend - Employee Module
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create Employee CRUD pages (list, detail, create/edit form) | Frontend | Employee list renders, can add/edit employees | 90% |
| Create Employee profile sub-form (name, DOB, contact) | Frontend | Profile section renders with API sync | 80% |
| Integrate employee API (fetch, create, update) | Frontend | Live API calls working, data displays | 85% |
| Create Organization views (dept tree, position list) | Frontend | Org structure rendered from API | 100% |

**% hoàn thành mục tiêu tuần:** ~85%

---

### **Tuần 3: Attendance & Payroll Foundation (9/6 - 15/6)**

#### Attendance Feature (Backend) - Complete
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Complete Attendance service (check-in/out + daily record generation) | Backend | Check-in/out working, daily records computed | 100% |
| Implement LeaveRequest service (create, approve, reject with status flow) | Backend | Leave request CRUD, approval workflow ready | 95% |
| Implement LeaveBalance service (calculate entitled/used/remaining) | Backend | Balance queries working, linked to approvals | 90% |
| Wire attendance routes (POST check-in/out, GET daily records, POST leave-request) | Backend | All endpoints tested | 95% |
| Implement leave approval flow (manager can approve/reject) + audit log | Backend | Approval changes status + balance + creates audit entry | 90% |
| Write unit tests for Attendance (80%+ coverage) | Backend | Tests passing | 80% |

#### Payroll Feature (Backend) - Start (Complex, needs focus)
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create SalaryPolicyConfig, EmployeeTaxProfile, PayrollPeriod, SalaryStructure, Allowance, Deduction, Bonus, Payroll, Payslip models | Backend | Models created, Decimal128 for money fields | 100% |
| Implement SalaryStructure, Allowance, Deduction, Bonus services (CRUD) | Backend | All entity CRUD working | 95% |
| Design payroll computation engine (gross → tax/insurance → net logic) | Backend | Computation doc with formulas, validated with PO | 100% |
| Implement payroll computation (step 1: aggregate salary + allowances + overtime) | Backend | Gross salary calculation working | 70% |
| Setup PayrollPeriod service (define periods, mark open/processing/closed) | Backend | Period CRUD working | 100% |

#### Frontend - Attendance & Payroll Setup
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create Attendance tracking page (daily check-in/out interface) | Frontend | Clock in/out buttons, daily log visible | 90% |
| Create Leave request form + list (my leaves + manager approvals) | Frontend | Leave form submits, list shows status | 85% |
| Integrate attendance API | Frontend | Live check-in/out, daily records fetch | 85% |
| Create Payroll period management page (view, create periods) | Frontend | Periods listed, can create new ones | 80% |
| Create Salary structure page (view employee base salary) | Frontend | Salary structure visible | 70% |

**% hoàn thành mục tiêu tuần:** ~85%

---

### **Tuần 4: Payroll Complete & Performance Start (16/6 - 22/6)**

#### Payroll Feature (Backend) - Complete
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Complete payroll computation (tax + insurance + deductions calculation) | Backend | Full payroll computed with all deductions, tax logic validated | 100% |
| Implement payroll approval flow (HR approves, marks paid) | Backend | Approval chain working, status transitions correct | 95% |
| Implement payslip generation (PDF) + upload to S3 | Backend | Payslips generated as PDF, sent to employee | 90% |
| Implement payroll data export (CSV for accounting) | Backend | Export working, file format correct | 100% |
| Wire payroll routes (compute, list, approve, mark-paid, payslip-send) | Backend | All endpoints tested | 100% |
| Write unit tests for payroll (80%+ coverage) + integration tests | Backend | Tests passing, coverage high | 85% |

#### Performance Feature (Backend) - Start
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create AppraisalCycle, Goal, Kpi, PerformanceReview, ReviewFeedback models | Backend | Models created | 100% |
| Implement AppraisalCycle service (create, manage cycles) | Backend | Cycle CRUD working | 100% |
| Implement Goal & Kpi services (CRUD) | Backend | Goal/KPI CRUD, progress tracking | 95% |
| Design performance review flow (manager reviews, multi-source feedback) | Backend | Review flow doc approved | 100% |
| Implement PerformanceReview service (partial: create review + add feedback) | Backend | Review creation working, feedback collection ready | 80% |

#### Frontend - Payroll & Performance Setup
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create Payroll dashboard (periods, compute status, export) | Frontend | Payroll list, compute button, status visible | 90% |
| Create Allowance/Deduction management page (admin view) | Frontend | Allowances/deductions listed, can CRUD | 85% |
| Integrate payroll API (list, compute, approve, export) | Frontend | Live API calls, payroll data displays | 85% |
| Create Performance appraisal cycle page | Frontend | Cycles listed, create cycle form ready | 80% |
| Create Performance review interface (manager can review + add feedback) | Frontend | Review form mockup ready, API integration started | 60% |

**% hoàn thành mục tiêu tuần:** ~85%

---

### **Tuần 5: Performance Complete & Full Integration Testing (23/6 - 29/6)**

#### Performance Feature (Backend) - Complete
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Complete PerformanceReview service (submit, acknowledge, calculate score) | Backend | Review workflow end-to-end working | 100% |
| Implement ReviewFeedback service (multi-source: self, peer, manager, subordinate) | Backend | Feedback collection + aggregation working | 95% |
| Wire performance routes (appraisal, goals, reviews, feedback) | Backend | All endpoints tested | 100% |
| Write unit tests for performance (80%+ coverage) | Backend | Tests passing | 85% |

#### Frontend - Performance Complete
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Create goal tracking page (employee view goals + progress) | Frontend | Goals listed, progress visible | 100% |
| Create KPI dashboard (goals + KPIs tracked) | Frontend | KPI cards, progress bars visible | 90% |
| Create performance review form (manager + employee views) | Frontend | Review form submits, feedback collectable | 90% |
| Integrate performance API fully | Frontend | Live API calls, full review workflow works | 90% |

#### Integration Testing & QA
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tuần |
|---------|--------------|-----------------|--------------------------|
| End-to-end workflow testing (employee onboarding → payroll → review) | PO + Backend + Frontend | Test scenarios doc, all happy paths pass | 95% |
| API integration testing (all endpoints, error cases) | Backend | API test suite (Jest + Supertest) 80%+ coverage | 85% |
| Frontend UI testing (responsive, cross-browser, edge cases) | Frontend | Chrome/Firefox/Edge tested, mobile responsive | 90% |
| Performance testing (load testing, query optimization) | Backend + DevOps | Response times <200ms (95th percentile), no N+1 queries | 80% |
| Security check (OWASP top 10: XSS, SQL injection, CSRF, auth bypass) | Backend + DevOps | Security review doc, vulnerabilities fixed | 85% |

#### UAT & Documentation
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| User acceptance test (50 employee org test) | PO + all | UAT checklist passed (all 6 features, all workflows) | 95% |
| API documentation (Postman collection + OpenAPI) | Backend | Documentation complete, examples working | 100% |
| User guide (screenshots, how-to for 50 employees) | PO + Frontend | Basic user guide ready | 80% |
| Admin guide (setup, configuration, troubleshooting) | DevOps + Backend | Admin runbook ready | 80% |

**% hoàn thành mục tiêu tuần:** ~90%

---

### **Tuần 6: Polish, Fixes & Go-live (30/6 - 1/7)**

#### Bug Fixes & Refinement
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Fix UAT issues (critical bugs) | Backend + Frontend | All Sev-1/Sev-2 bugs resolved | 100% |
| Performance optimization (slow queries, frontend render) | Backend + Frontend | Page load <2s, API response <200ms | 95% |
| Browser compatibility fixes | Frontend | Chrome, Firefox, Edge, Safari all pass | 100% |
| Mobile responsiveness final pass | Frontend | Mobile views tested, responsive confirmed | 100% |

#### Deployment & Monitoring
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Setup production MongoDB replica set | DevOps | Production DB ready, backups configured | 100% |
| Deploy backend to production (Docker + reverse proxy) | DevOps | Backend live, health check passing | 100% |
| Deploy frontend to production (static hosting) | DevOps | Frontend live, CDN configured | 100% |
| Setup monitoring & alerting (CPU, memory, API latency, error rates) | DevOps | Monitoring dashboard live, alerts configured | 100% |
| Setup logging aggregation (centralized logs) | DevOps | Logs accessible, searchable | 100% |

#### Final Checklist & Knowledge Transfer
| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
|---------|--------------|-----------------|--------------------------|
| Go-live readiness checklist (all items signed off) | PO + all | Checklist 100% complete | 100% |
| Post-launch support plan (on-call rotation, escalation) | PO + DevOps | On-call schedule ready | 100% |
| Knowledge transfer to ops/support team | PO + Backend + DevOps | Training session done, runbook shared | 100% |
| Launch announcement (release notes, changelog) | PO | Release notes published | 100% |

**% hoàn thành mục tiêu tuần:** **100% GO-LIVE 1/7** ✅

---

## 4. ⚠️ Dự trù rủi ro và kế hoạch dự phòng

| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu (làm trước) | Dự phòng (nếu xảy ra) |
|--------|---------|----------|----------------------|----------------------|
| **Payroll computation complexity** — tax/insurance formulas chưa validated, edge cases phát hiện muộn | Medium (60%) | **High** — payroll là critical path, delay = push back go-live | (1) Validate all tax/insurance formulas with accounting team **tuần 1**; (2) Write comprehensive unit tests (tax brackets, deductions, special cases) **tuần 3**; (3) Use feature flag to disable payroll approval if not ready, manual approval via Google Sheets backup | If formulas are wrong: (1) Quick hotfix tuần 5; (2) Extended UAT for payroll only; (3) Launch without payroll approval (HR computes offline) — full approval ready week 1 post-launch |
| **Frontend-Backend integration delays** — API contract mismatch, response format surprises | Medium (50%) | Medium — features block each other | (1) Define API contract early (**week 1**, OpenAPI spec); (2) Mock APIs in Frontend week 1-2; (3) API-first development (BE delivers 2 days before FE integration) | If integration stalls: (1) Sync meeting same day to resolve; (2) Extend integration testing into week 5 buffer; (3) Temporarily decouple features (each feature goes live independently if needed) |
| **Database schema changes** — mid-project discover schema flaw (e.g., missing fields, wrong types) | Low (30%) | **High** — late schema migration = data inconsistency, re-testing | (1) Finalize schema **tuần 1** with full review; (2) Use Mongoose schema versioning for safe migrations; (3) Peer review all schema PRs | If schema change needed: (1) Write migration script immediately; (2) Test migration on production-like data; (3) Add extra day to testing schedule |
| **Mid-level dev knowledge gaps** — Backend/Frontend dev hits unknown (e.g., Decimal128 handling, JWT refresh, complex Mongoose queries) | Medium (55%) | Medium — productivity loss 2-3 days per issue | (1) Pair programming week 1 (PO + dev on complex payroll logic); (2) Document patterns in CLAUDE.md; (3) Senior DevOps available for architecture questions | If blocker: (1) Async support from PO; (2) Simplify feature scope (defer low-priority sub-features); (3) Use open-source libraries/NPM packages to reduce custom complexity |
| **Test coverage shortfall** — unit tests lag, UAT finds integration bugs late | Medium (50%) | Medium — bugs in production, need hotfix post-launch | (1) Test-driven dev for payroll (write tests before code); (2) Daily test coverage report (must stay >80%); (3) Automated API test suite running in CI | If coverage drops: (1) Extend UAT week 5 (reduce refinement time); (2) Launch with feature flags (disable untested features); (3) Accept higher bug-fix rate post-launch (on-call rotation ready) |
| **50-employee test data prep** — realistic test data (varied employee types, payroll scenarios) not ready for UAT | Low (40%) | Medium — UAT validation weak, production data surprises | (1) Create test data generator script week 1-2 (50 diverse employees, various contracts, salary structures); (2) PO prepares UAT test scenarios week 3; (3) Seed DB with test data before UAT | If data prep late: (1) Simplified UAT (core paths only); (2) Extended post-launch monitoring (catch data issues live) |
| **Team communication / context loss** — daily standups miss blockers, knowledge scattered, context loss | Medium (45%) | Low-Medium — productivity loss 1-2 days | (1) Daily 15-min standup (fixed time); (2) Shared CLAUDE.md, PLAN, progress doc; (3) Decision log for architectural choices | If communication breakdown: (1) Escalate to PO same day; (2) Pair programming to re-sync; (3) Async written status (detailed PR descriptions, commit messages) |
| **DevOps/Infrastructure issues** — CI/CD pipeline fails, DB connection drops, GitHub Actions quota exceeded | Low (25%) | **High** — blocks all testing/deployment | (1) DevOps owns full setup week 1-2 (no blockers); (2) Test CI/CD with dummy projects week 1; (3) Backup manual deployment script | If infra fails: (1) Manual deployment via scripts (pre-prepared); (2) Local testing continues (DB/API run locally); (3) Escalate to DevOps SME (Senior level, should resolve quickly) |
| **Scope creep / new requirements** — PO adds features mid-project, timelines slip | Medium (50%) | **High** — push back go-live | (1) Freeze feature list **now** — scope locked; (2) Any new request goes to Phase 2 post-launch; (3) Weekly scope review (PO checks: do we have X, is X essential?) | If new requirement: (1) **Strict decision:** defer to post-launch or cut lower-priority feature; (2) Update timeline accordingly; (3) Risk escalation to stakeholders |

**Contingency strategy:**
- **Feature flags** for uncertain features (payroll approval, complex performance feedback) — toggle at runtime
- **MVP + Phase 2** mindset — if any feature <70% confident by week 5 → launch without it, add week 1-2 post-launch
- **On-call rotation** — week 1-2 post-launch: dev + DevOps available for hotfixes (bugs caught in production by real 50 employees)

---

## 5. 📊 KPIs theo từng giai đoạn

| Giai đoạn | Chỉ số KPI | Cách đo | Ngưỡng thành công |
|-----------|-----------|--------|------------------|
| **Phase 1 (Week 1)** | Schema Approval Rate | % components with final schema | ≥ 95% (all 6 features schema approved) |
| | IAM & Org API Ready | % endpoints tested + documented | ≥ 100% (login, CRUD routes passing) |
| | CI/CD Pipeline Status | Build + test success rate | ≥ 95% (GitHub Actions passing on all PRs) |
| **Phase 2 (Week 2-3)** | Employee & Attendance API Coverage | % of planned endpoints completed | ≥ 90% (CRUD, check-in/out, leave request working) |
| | Unit Test Coverage | % of service code covered | ≥ 80% (Employee, Attendance services) |
| | Frontend Component Completion | % of required pages built | ≥ 90% (Employee CRUD pages, leave form, org views done) |
| **Phase 3 (Week 3-4)** | Payroll Computation Accuracy | % of payroll test cases passing | ≥ 100% (all tax/insurance/deduction formulas correct) |
| | API Integration Test Pass Rate | % of end-to-end workflows passing | ≥ 95% (Employee onboarding → payroll flow works) |
| | Performance Feature Completion | % of review + feedback flows ready | ≥ 85% (AppraisalCycle, Goal, Review working) |
| **Phase 4 (Week 4-5)** | UAT Issue Resolution | % of UAT bugs fixed (Sev-1/Sev-2) | ≥ 100% (critical bugs resolved) |
| | API Response Time (95th percentile) | ms | < 200ms (all endpoints) |
| | Frontend Load Time (First Contentful Paint) | seconds | < 2s (on 3G-like network) |
| | Security Scan Pass Rate | % of OWASP checks passed | ≥ 100% (no critical vulns) |
| **Phase 5 (Week 5-6)** | Go-live Readiness Checklist | % items checked off | ≥ 100% (all 50+ items signed off) |
| | Production Deployment Success | deployment scripts run without manual intervention | ✅ 1st attempt success (zero hotfixes during deploy) |
| | Post-Launch Support Plan | % team trained on runbook | ≥ 100% (all team knows escalation, on-call rotation) |
| **Overall KPI** | Feature Completeness | # of features fully operational | ≥ 6/6 (all 6 features live + tested) |
| | Go-live Deadline Met | launch date | 01/07/2026 ✅ |
| | Employee Productivity (Post-launch) | # of employees using system day 1 | ≥ 50/50 (100% adoption on day 1) |

---

## 6. 🗓️ Lịch họp và điểm kiểm tra

| Thời điểm | Loại họp | Người tham gia | Đầu ra kỳ vọng | Thời lượng |
|-----------|---------|---------------|---------------|-----------|
| **26/5 (Mon, 9:00 AM)** | **Kickoff** | PO, Backend, Frontend, DevOps, Company stakeholder | Scope confirmed, timeline, team roles, communication channels (Slack/Zalo), first sprint breakdown | 1.5h |
| **Daily 9:30 AM (Mon-Fri)** | **Standup (15 min)** | PO, Backend, Frontend, DevOps | Blockers reported same-day, quick decisions, task updates | 15 min |
| **31/5 (Sat, 4:00 PM)** | **Week 1 Checkpoint** | PO, Backend, DevOps | Schema finalized ✅, CI/CD passing ✅, IAM API ready ✅, org API ready ✅ → green light for week 2 | 45 min |
| **8/6 (Sat, 4:00 PM)** | **Phase 2 Review** | PO, Backend, Frontend | Employee API 90%+ done ✅, FE integration started ✅, Attendance API drafted ✅ | 1h |
| **15/6 (Sat, 4:00 PM)** | **Phase 3 Review** | PO, Backend, Frontend | Attendance complete ✅, Payroll computation logic validated ✅, performance feature drafted ✅ | 1h |
| **22/6 (Sat, 4:00 PM)** | **Phase 4 Review + UAT Readiness** | PO, Backend, Frontend, DevOps | All 6 features API done ✅, integration tests 95%+ pass ✅, UAT environment ready ✅ | 1h |
| **27/6 (Thu, 3:00 PM)** | **UAT Issue Triage** | PO, Backend, Frontend, DevOps | Critical bugs only (Sev-1/Sev-2) — resolve in 4 days ✅ | 1h |
| **29/6 (Sat, 4:00 PM)** | **Pre-launch Final Check** | PO, Backend, Frontend, DevOps | Checklist 100% done, production env ready, runbook signed off, on-call rotation ready | 1h |
| **01/7 (Mon, 8:00 AM)** | **Go-live** | PO, Backend, DevOps | Deploy to production, health checks pass, 50 employees onboarded, post-launch monitoring active | — |
| **01/7 (Mon, 6:00 PM)** | **Post-launch Sync** | PO, Backend, Frontend, DevOps | Day 1 issues (if any) triaged, hotfix plan, team debrief | 30 min |

**Checkpoint Milestones:**

- **26/5:** Project Kickoff — Scope locked, team aligned
- **31/5:** Schema & IAM complete — Foundation ready
- **8/6:** Employee module 90% — Core data model working
- **15/6:** Attendance complete, Payroll logic validated — Workflows starting
- **22/6:** All features API done — Integration phase
- **29/6:** UAT pass, all bugs fixed — Ready to deploy
- **01/07:** 🚀 **GO-LIVE** — System live for 50 employees

---

## 7. ✅ Checklist xác nhận sẵn sàng

Trước khi bắt đầu (**26/5**), đảm bảo hoàn thành:

### **Infrastructure & Setup**
- [ ] MongoDB replica set configured locally (or Docker Compose) — `mongosh` can connect
- [ ] GitHub repository created, branch protection rules set (require 1 review)
- [ ] GitHub Actions CI configured (lint, test, build on every PR)
- [ ] `.env.example` template created (no secrets, template values only)
- [ ] Slack / Zalo channel created for team communication
- [ ] Postman workspace created & shared (for API testing)

### **Team Alignment**
- [ ] All team members have access to codebase + deployments
- [ ] CLAUDE.md finalized (coding standards, patterns, feature structure)
- [ ] DATABASE.md reviewed & approved by Backend + PO
- [ ] BE-PROJECT-RULES.md understood by all (naming, error codes, auth middleware)
- [ ] Git workflow explained (branch naming, commit format, PR process)
- [ ] Daily standup time confirmed (9:30 AM UTC+7)

### **Development Setup**
- [ ] Node.js LTS installed locally (Backend, Frontend, DevOps)
- [ ] pnpm workspaces configured (monorepo structure ready)
- [ ] TypeScript strictest settings enabled
- [ ] ESLint + Prettier config applied to both backend & frontend
- [ ] Test framework (Jest) configured, first test run successful
- [ ] IDE plugins installed (Prettier, ESLint, Mongoose schema validator)

### **Project Governance**
- [ ] Scope document finalized (6 features, 50 employees, no Phase 2 scope creep)
- [ ] Budget allocated & approved (100M VND)
- [ ] Success criteria documented (6 features live, 100% UAT pass, 1/7 deadline)
- [ ] Risk register reviewed & mitigation plans assigned
- [ ] Post-launch support plan drafted (on-call rotation, escalation path)
- [ ] Knowledge transfer plan (runbook, user guides, training schedule)

### **Phase 1 Ready (Week 1)**
- [ ] All team members have write access to MongoDB, GitHub, Slack
- [ ] Database schema (all 6 features) reviewed & approved
- [ ] IAM feature structure designed (models, services, repositories, routes)
- [ ] Organization feature structure designed
- [ ] API contract defined (Postman collection skeleton)
- [ ] First iteration timeline (daily tasks) ready

### **Go-Live Prerequisites (1/7)**
- [ ] Production MongoDB replica set running (backups configured)
- [ ] Backend & Frontend deployable to production (scripts tested)
- [ ] All 6 features API + UI tested (unit + integration + UAT)
- [ ] Performance acceptable (API <200ms, page load <2s)
- [ ] Security audit passed (OWASP checks)
- [ ] 50 test employee accounts created, assigned to org structure
- [ ] Monitoring & alerting live (CPU, memory, error rates, API latency)
- [ ] Post-launch runbook & on-call rotation ready
- [ ] Team trained on support procedures

---

## 📎 Phụ lục

### A. Giả định khi lập kế hoạch

1. **Team commitment:** 4 người dedicated full-time (no context switching to other projects)
2. **No scope creep:** Feature list locked (6 features, no new requirements mid-project)
3. **No blocker absences:** Team member absence would delay timeline (no backups)
4. **Database infrastructure ready:** MongoDB replica set available by week 1
5. **GitHub Actions CI working:** No platform blockers (quota, access issues)
6. **50-employee test data:** PO provides employee list + org structure by week 1
7. **API-first development:** Backend delivers 2-3 days before Frontend integration (agreed)
8. **Email service assumed:** Basic SMTP or SendGrid for temp passwords, payslips (minimal config)
9. **No data migration:** Fresh system, no legacy data import complexity
10. **No external integrations:** System standalone (no HR software sync, SSO, etc. — phase 2 if needed)

### B. Các quyết định cần được đưa ra ngay (before 26/5)

| Quyết định | Người quyết định | Hạn chót | Ảnh hưởng |
|-----------|----------------|---------|---------|
| **Scope finalization** — Exactly which sub-features in each of 6 features? (e.g., Performance: just appraisals, or include 360-degree feedback?) | PO | **NOW** | Scope creep risk if unclear |
| **Payroll formula approval** — HR team validates tax/insurance formulas (VN 2026), deductions, allowances | PO + Accounting | **25/5** | Payroll correctness, critical |
| **API contract** — OpenAPI spec stub for all 6 features (endpoint names, request/response format) | Backend + Frontend + PO | **26/5** | Integration sync, prevents rework |
| **Test data strategy** — How to generate 50 diverse employee scenarios (contracts, salary, leave, org structure)? | PO + Backend | **26/5** | UAT quality, realistic testing |
| **Feature flags list** — Which features/flows are uncertain & need flags? (e.g., payroll approval, performance feedback) | PO + Backend | **26/5** | Risk mitigation, launch flexibility |
| **Hosting & monitoring tools** — Production MongoDB, reverse proxy, monitoring platform, logging solution | DevOps | **25/5** | Go-live readiness |
| **On-call rotation** — Who is on-call week 1-2 post-launch? Escalation path? | PO + DevOps | **29/6** | Post-launch support coverage |

### C. Người liên hệ chính

| Vai trò | Tên (để trống nếu chưa xác định) | Liên hệ | Trách nhiệm |
|--------|---------------------------|---------|-----------|
| **Product Owner / PM** | — | — | Scope, decisions, stakeholder communication, UAT |
| **Backend Lead (Mid)** | — | — | API design, payroll computation, database schema, backend tests |
| **Frontend Lead (Mid)** | — | — | UI/UX, component library, integration tests, responsive design |
| **DevOps / Infrastructure (Senior)** | — | — | Database setup, CI/CD, monitoring, production deployment, on-call |
| **Company Stakeholder / HR** | — | — | Requirements, test data, UAT sign-off, post-launch training |

---

## 🎯 Delivery Timeline Summary

```
Tuần 1 (26/5-1/6):   📐 Foundation — Schema ✅ IAM API ✅ Org API ✅ CI/CD ✅
Tuần 2 (2/6-8/6):    👤 Employee — CRUD ✅ Profile ✅ FE integration 90% ✅
Tuần 3 (9/6-15/6):   📋 Attendance + Payroll Start — Shifts ✅ Leave ✅ Payroll 70% ✅
Tuần 4 (16/6-22/6):  💰 Payroll Complete + Performance — Payroll 100% ✅ Review ✅
Tuần 5 (23/6-29/6):  🧪 Integration & UAT — All 6 features tested ✅ bugs fixed ✅
Tuần 6 (30/6-1/7):   🚀 Go-live — Deploy ✅ monitoring ✅ 50 employees live ✅

**Target: 01/07/2026 — System fully operational for 50 employees** ✅
```

---

**Document Version:** 1.0  
**Last Updated:** 26/05/2026  
**Status:** Ready for Kickoff ✅

---

*Prepared by:* Claude AI (plan-builder skill)  
*For:* Soosky HRM Project  
*Timeline:* 26 May — 1 July 2026

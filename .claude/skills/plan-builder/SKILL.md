---
name: plan-builder
description: >
  Advanced adaptive project planning skill for software, product, marketing, operations, events, AI systems, research, startup MVPs, enterprise programs, and internal initiatives.
  Create strategic + execution-ready project plans with:
  - adaptive plainning modes
  - methodology-aware execution
  - Dependency mapping
  - Resource allocation
  - KPI framework
  - Risk scoring
  - Governance structure
  - Milestone roadmap
  - Stakeholder communication plan
  - Readiness validation
  Use when user says:
  - lập kế hoạch
  - build plan
  - create roadmap
  - project plan
  - roadmap dự án
  - chiến lược triển khai
  - execution plan
  - MVP roadmap
  - milestone planing 
  - delivery roadmap
  - operational rollout
  - implementation strategy
  - sprint planning 
  - timeline dự án
argument-hint: "[project-name]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# Comprehensive Project Plan Builder

Comprehensive adpative project planning framework

# Core principles

The generated plan MUST be:

- realistic
- measurable
- dependency-aware
- staffing-aware
- budget-aware
- methodology-aware
- adaptable to uncertainty
  Avoid:
- vague tasks
- generic deliverables
- unrealistic staffing
- impossible timelines
- duplicated meetings
- non-measureable KPIs
  Prefer:
- actionable deliverables
- owner-based accountability
- milestone-driven progress
- explicit dependencies
- contingency planning

**Scope:** Planning only. No code generation or implementation.

This skill creates production-ready project plans with:

- Recommended approach (phased, pilot-then-scale, or big-bang)
- Phase breakdown with owners and deliverables
- Weekly or sprint-level task breakdown
- Risk register with mitigation plans
- KPIs per phase with measurement methods
- Meeting schedule with checkpoints
- Readiness checklist before execution

**Output:** Markdown document with 7 mandatory sections + rationale comments.

## Pre-flight Checks

1. **Argument provided?** Must be a project name (e.g., "ecommerce-platform", "marketing-campaign-q4", "employee-training"). If missing, ask user: "What's your project name?"

2. **Information completeness check** — Before generating plan, verify these 7 inputs exist. Ask for missing ones in a single message:
   - [ ] Mục tiêu cuối cùng (SMART): specific, measurable, achievable, relevant, time-bound
   - [ ] Thời gian triển khai & deadline: start date + end date or total duration
   - [ ] Nhân sự: roles, count, experience level (junior/senior/lead)
   - [ ] Ngân sách: total amount + currency + unit (million VND, USD, etc.)
   - [ ] Công cụ hiện có & cần bổ sung: separate lists
   - [ ] Ràng buộc: technical, legal, organizational, internal politics, compliance, etc.
   - [ ] Loại dự án: (sản phẩm/sự kiện/phần mềm/marketing/nghiên cứu/khác)

3. **Smart prompting template** — Ask in this format:
   Để lập kế hoạch cho dự án "[project-name]", tôi cần thêm thông tin:

📌 Mục tiêu SMART (cụ thể + đo lường được + thời hạn): ...
📅 Thời gian: từ ngày nào đến ngày nào? (hoặc tổng bao nhiêu tuần/tháng)
👥 Nhân sự: số lượng, vai trò, level (Junior/Senior/Lead)
💰 Ngân sách: con số + đơn vị (VD: 50 triệu VND)
🛠️ Công cụ: đang có: ... | cần thêm: ...
⛓️ Ràng buộc: (VD: không thuê ngoài, phải dùng công nghệ X, compliance Y)
🏷️ Loại dự án: sản phẩm | sự kiện | phần mềm | marketing | nghiên cứu | khác

Hãy điền hoặc bỏ qua nếu đã có.

text

4. **Existing plan check** — Check if `PLAN_[project-name].md` already exists in current directory. If yes, ask:
   - Overwrite?
   - Append as new version?
   - Cancel?

5. **Reference documents check** — Optionally check for existing strategy docs:
   - `PROJECT_GOALS.md`, `TIMELINE.md`, `RESOURCES.md`
   - If missing, warn but proceed.

## Plan Generation Logic

### For Each Project Type, Prioritize Different Approaches:

| Project Type        | Default Approach     | Reason                               |
| ------------------- | -------------------- | ------------------------------------ |
| Phần mềm / sản phẩm | Thử nghiệm → Mở rộng | High uncertainty, need user feedback |
| Sự kiện             | Triển khai đồng loạt | Fixed date, no room for iteration    |
| Marketing campaign  | Theo giai đoạn       | Can test channels, scale winners     |
| Nghiên cứu          | Thử nghiệm → Mở rộng | Hypothesis-driven                    |
| Nội bộ / Ops        | Theo giai đoạn       | Multiple departments involved        |

### Phase Breakdown Rules:

- **Total duration ≤ 4 weeks** → 2-3 phases
- **5-12 weeks** → 3-4 phases
- **13-26 weeks** → 4-5 phases
- **>26 weeks** → 5-6 phases + milestones every 4 weeks

### Weekly Task Density:

- Each week: 3-7 tasks maximum
- Each task: assignable to 1 person (if team ≥2)
- Include % completion expectation per week (0-100%)

### Risk Register Format (always include):

| Risk | Likelihood   | Impact       | Mitigation    | Contingency  |
| ---- | ------------ | ------------ | ------------- | ------------ |
| ...  | Low/Med/High | Low/Med/High | Action before | Action after |

Minimum 3 risks, maximum 7.

### KPIs by Phase Template:

| Phase   | KPI | Measurement    | Target                     |
| ------- | --- | -------------- | -------------------------- |
| Phase 1 | ... | How to measure | Specific number/percentage |

Each phase must have 1-3 KPIs.

### Meeting Schedule Rules:

- Weekly: 30-min sync (all team)
- Bi-weekly: 1-hour review (stakeholders if available)
- Phase start/end: 1-hour planning/retrospective
- First meeting: Kickoff (2 hours if team >5 people)

## Output Format

Generate a single markdown document with this exact structure:

```markdown
# KẾ HOẠCH DỰ ÁN: [Project Name]

**Ngày lập:** [today]
**Người lập:** Claude AI (plan-builder skill)
**Version:** 1.0

## 📋 Tóm tắt dự án

- Mục tiêu: [restate SMART goal]
- Thời gian: [start] → [end] (tổng X tuần)
- Ngân sách: [amount]
- Nhân sự: [count] người ([roles])
- Loại dự án: [type]

---

## 1. 🧭 Hướng tiếp cận đề xuất

**Lựa chọn:** [Phased rollout / Pilot → Scale / Big-bang]

**Lý do:**

- [Reason 1 based on risk, resources, time]
- [Reason 2 based on constraints]
- [Reason 3 based on project type]

**Khuyến nghị đặc biệt:** [optional]

---

## 2. 📍 Các giai đoạn chính

| Giai đoạn | Mục tiêu | Đầu ra | Thời gian  | Người chịu trách nhiệm |
| --------- | -------- | ------ | ---------- | ---------------------- |
| 1. [name] | ...      | ...    | [week X-Y] | [role/person]          |
| 2. [name] | ...      | ...    | [week X-Y] | [role/person]          |
| ...       | ...      | ...    | ...        | ...                    |

---

## 3. 📅 Phân chia công việc chi tiết

### Tuần 1: [Phase name]

| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
| -------- | --------------- | ---------------- | -------------------------- |
| ...      | ...             | ...              | ...%                       |

### Tuần 2: [Phase name]

| Nhiệm vụ | Người phụ trách | Tiến độ mong đợi | % hoàn thành mục tiêu tuần |
| -------- | --------------- | ---------------- | -------------------------- |
| ...      | ...             | ...              | ...%                       |

[Continue for all weeks]

---

## 4. ⚠️ Dự trù rủi ro và kế hoạch dự phòng

| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu (làm trước) | Dự phòng (nếu xảy ra) |
| ------ | -------- | --------- | ---------------------- | --------------------- |
| 1. ... | ...      | ...       | ...                    | ...                   |
| 2. ... | ...      | ...       | ...                    | ...                   |
| 3. ... | ...      | ...       | ...                    | ...                   |

---

## 5. 📊 KPIs theo từng giai đoạn

| Giai đoạn | Chỉ số KPI | Cách đo | Ngưỡng thành công |
| --------- | ---------- | ------- | ----------------- |
| Phase 1   | ...        | ...     | ≥ ...             |
| Phase 2   | ...        | ...     | ≥ ...             |
| ...       | ...        | ...     | ...               |

**KPI tổng thể dự án:**

- [Final success metric 1]
- [Final success metric 2]

---

## 6. 🗓️ Lịch họp và điểm kiểm tra

| Thời điểm            | Loại họp          | Người tham gia          | Đầu ra kỳ vọng                       |
| -------------------- | ----------------- | ----------------------- | ------------------------------------ |
| Tuần 0 (trước start) | Kickoff           | All team + stakeholders | Thống nhất mục tiêu, lịch, giao tiếp |
| Cuối tuần 1          | Daily/Weekly sync | Core team               | Tracking update                      |
| Cuối mỗi phase       | Phase review      | Team + sponsor          | Decision: go/no-go                   |
| ...                  | ...               | ...                     | ...                                  |

**Checkpoint mốc quan trọng:**

- [Date]: [Decision milestone]
- [Date]: [Deliverable signoff]

---

## 7. ✅ Checklist xác nhận sẵn sàng

Trước khi bắt đầu, hãy đảm bảo:

- [ ] Mục tiêu dự án đã được phê duyệt bởi stakeholders
- [ ] Ngân sách đã được duyệt và sẵn sàng giải ngân
- [ ] Nhân sự đã được phân công và cam kết thời gian
- [ ] Công cụ cần thiết đã sẵn sàng (hiện có: [list], cần bổ sung: [list])
- [ ] Các rủi ro chính đã có kế hoạch giảm thiểu
- [ ] KPIs đã được đồng thuận với tất cả bên liên quan
- [ ] Lịch họp định kỳ đã được gửi và chấp thuận
- [ ] Kênh giao tiếp chính thức đã được thiết lập (Slack/Zalo/Teams/Email)
- [ ] Template báo cáo tiến độ đã được tạo
- [ ] Deadline lần đầu (milestone 1) đã được đánh dấu trên lịch team

---

## 📎 Phụ lục

### A. Giả định khi lập kế hoạch

- [Assumption 1]
- [Assumption 2]

### B. Các quyết định cần được đưa ra ngay

- [Decision 1] - cần trước ngày [date]
- [Decision 2] - cần trước ngày [date]

### C. Người liên hệ chính

| Vai trò              | Tên (để trống nếu chưa có) | Liên hệ |
| -------------------- | -------------------------- | ------- |
| Chủ đầu tư / Sponsor | ...                        | ...     |
| Project Lead         | ...                        | ...     |
| Technical Lead       | ...                        | ...     |
| QA/Reviewer          | ...                        | ...     |
```

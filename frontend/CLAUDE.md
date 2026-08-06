# Frontend: Soosky HRM

## Tech Stack

- React 19 + Vite: fast dev server, modern React features
- TypeScript: type safety, better DX, catch errors early
- TanStack Query: server state management, caching, auto-refetch
- Zustand: minimal global state (auth, cart only)
- Tailwind CSS: utility-first, fast styling, consistent design
- Axios: interceptors for auth, error handling
- React Router v7: modern routing, type-safe routes, improved data loading

## Documentation

### Must Read

- @docs/FE-PROJECT-RULES.md - Conventions, patterns, MUST/MUST NOT
- @docs/FE-ARCHITECTURE.md - Folder structure, components, state

### Reference

- @../01-share-docs/API_SPEC.md - API contract to consume

## Hợp đồng với backend (BẤT BIẾN, đừng phá)

- **Không có envelope khi thành công**: đọc thẳng `data`, KHÔNG `data.data`. Lỗi mới có
  `{ code, message }` — dùng `apiErrorMessage` / `apiErrorCode` (`@shared/utils/apiError`),
  đừng tự bóc `response.data.error.message`.
- **Không có tiền tố `/admin` hay `/settings`**: phân quyền do backend kiểm theo khoá quyền,
  không theo đường dẫn. Danh mục theo đúng module sở hữu: hồ sơ công ty `/setting/*`, ca/ngày
  lễ/ký hiệu `/attendance/*`, chính sách lương `/payroll/policies`.
- **Test hợp đồng** `src/core/http/api-contract.test.ts` quét mọi lời gọi `api.*` và đối chiếu
  với `share-docs/api-routes.json` (bản kê do backend sinh). URL phải viết TĨNH đủ để đối
  chiếu: `` `/auth/accounts/${id}/deactivation` `` được, `` `${id}/${action}` `` thì không.
- **Vai trò UI suy từ QUYỀN, không từ role của Auth**: `/auth/me` trả `owner|admin|member`
  (tầng Auth), còn role nghiệp vụ là `admin/hr/manager/employee`. `auth.service` gọi
  `/iam/me/permissions` rồi suy ra vai trò UI — đừng gating menu bằng `account.role`.

## Tính năng KHÔNG có ở backend (đừng dựng lại UI cho chúng)

- **Nhân viên tự check-in/check-out**: bỏ theo yêu cầu nghiệp vụ — chấm công hoàn toàn do HR
  nhập. Sai giờ thì nhân viên gửi **yêu cầu chỉnh công** (`/attendance/correction-requests`),
  HR/quản lý duyệt mới áp vào bảng công.
- **Chấm công hàng loạt theo trạng thái**: không có đường ghi nào nhận `status`; nghỉ phép sinh
  từ đơn đã duyệt, nghỉ lễ từ danh mục ngày lễ, vắng = không có bản ghi.
- **Tải tệp lên (`/uploads/*`)**: backend chỉ lưu `fileUrl`/`avatarUrl` dạng CHUỖI tham chiếu →
  UI nhận đường dẫn, không giả vờ upload.
- **Thông báo (`/notifications/*`)** và **danh mục ngân hàng (`/settings/banks`)**: không tồn tại.
  Mẫu file chuyển lương là `/setting/bank-profiles`.

## Design System (UI/UX Pro Max)

Before building or refactoring any UI, read **@design-system/soosky-hrm/MASTER.md** (global source of truth: style, colors, typography, effects, anti-patterns).
When working on a specific page, first check `design-system/soosky-hrm/pages/<page>.md` — if it exists, its rules override MASTER.md; otherwise use MASTER.md.

/**
 * Phạm vi dữ liệu mà một actor được phép chạm tới cho một hành động.
 *
 * `all`  — toàn bộ dữ liệu (Admin, HR).
 * `team` — chính mình + cấp dưới theo chuỗi quản lý trực tiếp (Manager).
 * `self` — chỉ chính mình (Employee).
 */
export type PermissionScope = "all" | "team" | "self";

/**
 * Quy ước đặt tên khoá quyền hạn để suy ra phạm vi từ tập quyền của actor.
 * Với khoá gốc `<resource>:<action>` (vd `employee:read`):
 *
 *   all   ← `*` hoặc `<resource>:manage` hoặc chính `<resource>:<action>`
 *   team  ← `<resource>:<action>:team`
 *   self  ← `<resource>:<action>:self`
 *
 * Nhờ quy ước này, thêm một hành động mới chỉ cần thêm khoá vào catalog, không
 * phải sửa logic phân giải phạm vi.
 */
export const WILDCARD_PERMISSION_KEY = "*";

/**
 * Suy ra phạm vi cao nhất mà tập quyền `effectivePermissions` cho phép trên
 * khoá gốc `baseKey`. Trả `undefined` khi actor không có quyền nào — caller
 * ném {@link AccessDeniedError}.
 */
export function resolvePermissionScope(effectivePermissions: readonly string[], baseKey: string): PermissionScope | undefined {
    const resource  = baseKey.split(":")[0] ?? baseKey;
    const manageKey = `${resource}:manage`;

    const has = (key: string): boolean => effectivePermissions.includes(key);

    if (has(WILDCARD_PERMISSION_KEY) || has(manageKey) || has(baseKey)) return "all";
    if (has(`${baseKey}:team`)) return "team";
    if (has(`${baseKey}:self`)) return "self";
    return undefined;
}

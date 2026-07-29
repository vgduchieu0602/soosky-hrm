/**
 * Cổng tra cứu sự tồn tại của phòng ban/vị trí mà module Department sở hữu.
 * Module Employee chỉ cần biết id có tồn tại hay không khi tạo/cập nhật nhân
 * viên — composition root (infra) lắp hiện thực dựa trên
 * `createDepartmentDirectory` của module Department.
 */
export default interface OrgDirectory {
    departmentExists(departmentId: string): Promise<boolean>;
    positionExists(positionId: string): Promise<boolean>;
}

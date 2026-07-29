import Entity from "@shared/core/domain/Entity";

export interface RolePermissionProps {
    id:           string;
    roleId:       string;
    permissionId: string;
}

/**
 * Một quyền hạn thuộc về một role. Không phải aggregate root — cả bộ quyền
 * hạn của một role được thay thế nguyên khối bởi `SetRolePermissionsUseCase`.
 */
export default class RolePermission extends Entity<string> {
    private constructor(
        public readonly id: string,
        public readonly roleId: string,
        public readonly permissionId: string,
    ) {
        super();
    }

    static create(id: string, roleId: string, permissionId: string): RolePermission {
        return new RolePermission(id, roleId, permissionId);
    }

    static rehydrate(props: RolePermissionProps): RolePermission {
        return new RolePermission(props.id, props.roleId, props.permissionId);
    }
}

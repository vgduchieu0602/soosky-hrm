import RolePermissionDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/RolePermissionDocument";
import RolePermission from "@modules/iam/core/domain/entities/RolePermission";

const RolePermissionMapper = {
    toDocument(rolePermission: RolePermission): RolePermissionDocument {
        return {
            _id:          rolePermission.id,
            roleId:       rolePermission.roleId,
            permissionId: rolePermission.permissionId,
        };
    },

    toDomain(document: RolePermissionDocument): RolePermission {
        return RolePermission.rehydrate({
            id:           document._id,
            roleId:       document.roleId,
            permissionId: document.permissionId,
        });
    },
};

export default RolePermissionMapper;

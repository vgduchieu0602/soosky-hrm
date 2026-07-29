import UserRoleDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/UserRoleDocument";
import UserRole from "@modules/iam/core/domain/entities/UserRole";

const UserRoleMapper = {
    toDocument(userRole: UserRole): UserRoleDocument {
        return {
            _id:        userRole.id,
            userId:     userRole.userId,
            roleId:     userRole.roleId,
            assignedAt: userRole.assignedAt,
        };
    },

    toDomain(document: UserRoleDocument): UserRole {
        return UserRole.rehydrate({
            id:         document._id,
            userId:     document.userId,
            roleId:     document.roleId,
            assignedAt: document.assignedAt,
        });
    },
};

export default UserRoleMapper;

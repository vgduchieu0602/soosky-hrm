import UserRole from "@modules/iam/core/domain/entities/UserRole";

export interface UserRoleDTO {
    id:         string;
    userId:     string;
    roleId:     string;
    assignedAt: string;
}

const UserRolePresenter = {
    toDTO(userRole: UserRole): UserRoleDTO {
        return {
            id:         userRole.id,
            userId:     userRole.userId,
            roleId:     userRole.roleId,
            assignedAt: userRole.assignedAt.toISOString(),
        };
    },
};

export default UserRolePresenter;

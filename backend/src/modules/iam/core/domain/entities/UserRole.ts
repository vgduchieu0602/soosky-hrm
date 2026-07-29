import Entity from "@shared/core/domain/Entity";

export interface UserRoleProps {
    id:         string;
    userId:     string;
    roleId:     string;
    assignedAt: Date;
}

/**
 * Một lượt gán role cho user. Không phải aggregate root — vòng đời của nó
 * gắn với `AssignRoleToUserUseCase`/`RevokeRoleFromUserUseCase`.
 */
export default class UserRole extends Entity<string> {
    private constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly roleId: string,
        public readonly assignedAt: Date,
    ) {
        super();
    }

    static create(id: string, userId: string, roleId: string): UserRole {
        return new UserRole(id, userId, roleId, new Date());
    }

    static rehydrate(props: UserRoleProps): UserRole {
        return new UserRole(props.id, props.userId, props.roleId, props.assignedAt);
    }
}

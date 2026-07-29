import Role from "@modules/iam/core/domain/entities/Role";

export interface RoleDTO {
    id:          string;
    key:         string;
    name:        string;
    description: string;
    isSystem:    boolean;
    createdAt:   string;
}

const RolePresenter = {
    toDTO(role: Role): RoleDTO {
        return {
            id:          role.id,
            key:         role.key.value,
            name:        role.name.value,
            description: role.description,
            isSystem:    role.isSystem,
            createdAt:   role.createdAt.toISOString(),
        };
    },
};

export default RolePresenter;

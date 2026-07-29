import Permission from "@modules/iam/core/domain/entities/Permission";

export interface PermissionDTO {
    id:          string;
    key:         string;
    resource:    string;
    action:      string;
    description: string;
    createdAt:   string;
}

const PermissionPresenter = {
    toDTO(permission: Permission): PermissionDTO {
        return {
            id:          permission.id,
            key:         permission.key.value,
            resource:    permission.resource,
            action:      permission.action,
            description: permission.description,
            createdAt:   permission.createdAt.toISOString(),
        };
    },
};

export default PermissionPresenter;

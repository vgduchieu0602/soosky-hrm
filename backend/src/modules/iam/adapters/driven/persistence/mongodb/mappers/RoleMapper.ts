import RoleDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/RoleDocument";
import Role from "@modules/iam/core/domain/entities/Role";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import RoleName from "@modules/iam/core/domain/value-objects/RoleName";

const RoleMapper = {
    toDocument(role: Role): RoleDocument {
        return {
            _id:         role.id,
            key:         role.key.value,
            name:        role.name.value,
            description: role.description,
            isSystem:    role.isSystem,
            createdAt:   role.createdAt,
        };
    },

    toDomain(document: RoleDocument): Role {
        return Role.rehydrate({
            id:          document._id,
            key:         RoleKey.create(document.key),
            name:        RoleName.create(document.name),
            description: document.description,
            isSystem:    document.isSystem,
            createdAt:   document.createdAt,
        });
    },
};

export default RoleMapper;

import PermissionDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/PermissionDocument";
import Permission from "@modules/iam/core/domain/entities/Permission";
import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";

const PermissionMapper = {
    toDocument(permission: Permission): PermissionDocument {
        return {
            _id:         permission.id,
            key:         permission.key.value,
            description: permission.description,
            createdAt:   permission.createdAt,
        };
    },

    toDomain(document: PermissionDocument): Permission {
        return Permission.rehydrate({
            id:          document._id,
            key:         PermissionKey.create(document.key),
            description: document.description,
            createdAt:   document.createdAt,
        });
    },
};

export default PermissionMapper;

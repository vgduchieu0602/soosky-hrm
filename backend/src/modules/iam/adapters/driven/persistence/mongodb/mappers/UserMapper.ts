import UserDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/UserDocument";
import User, { UserStatus } from "@modules/iam/core/domain/entities/User";

const UserMapper = {
    toDocument(user: User): UserDocument {
        return {
            _id:         user.id,
            displayName: user.displayName,
            email:       user.email,
            status:      user.status,
            createdAt:   user.createdAt,
        };
    },

    toDomain(document: UserDocument): User {
        return User.rehydrate({
            id:          document._id,
            displayName: document.displayName,
            email:       document.email,
            status:      document.status as UserStatus,
            createdAt:   document.createdAt,
        });
    },
};

export default UserMapper;

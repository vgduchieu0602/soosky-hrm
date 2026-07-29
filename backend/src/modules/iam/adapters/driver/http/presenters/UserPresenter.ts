import User from "@modules/iam/core/domain/entities/User";

export interface UserDTO {
    id:          string;
    displayName: string;
    email:       string;
    status:      string;
    createdAt:   string;
}

const UserPresenter = {
    toDTO(user: User): UserDTO {
        return {
            id:          user.id,
            displayName: user.displayName,
            email:       user.email,
            status:      user.status,
            createdAt:   user.createdAt.toISOString(),
        };
    },
};

export default UserPresenter;

import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface PermissionCreationInput {
    id:          string;
    key:         PermissionKey;
    description: string;
}

export interface PermissionProps {
    id:          string;
    key:         PermissionKey;
    description: string;
    createdAt:   Date;
}

/**
 * Một quyền hạn trong catalog hệ thống — bất biến sau khi tạo (resource/action
 * suy ra trực tiếp từ key), chỉ mô tả có thể được điều chỉnh.
 */
export default class Permission extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly key: PermissionKey,
        private _description: string,
    ) {
        super();
    }

    get description(): string {
        return this._description;
    }
    get resource(): string {
        return this.key.resource;
    }
    get action(): string {
        return this.key.action;
    }

    static create(input: PermissionCreationInput): Permission {
        return new Permission(input.id, new Date(), input.key, input.description);
    }

    static rehydrate(props: PermissionProps): Permission {
        return new Permission(props.id, props.createdAt, props.key, props.description);
    }
}

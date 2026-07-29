import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import RoleName from "@modules/iam/core/domain/value-objects/RoleName";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface RoleCreationInput {
    id:          string;
    key:         RoleKey;
    name:        RoleName;
    description: string;
    isSystem:    boolean;
}

export interface RoleProps {
    id:          string;
    key:         RoleKey;
    name:        RoleName;
    description: string;
    isSystem:    boolean;
    createdAt:   Date;
}

export default class Role extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly key: RoleKey,
        public readonly isSystem: boolean,
        private _name: RoleName,
        private _description: string,
    ) {
        super();
    }

    get name(): RoleName {
        return this._name;
    }
    get description(): string {
        return this._description;
    }

    static create(input: RoleCreationInput): Role {
        return new Role(input.id, new Date(), input.key, input.isSystem, input.name, input.description);
    }

    static rehydrate(props: RoleProps): Role {
        return new Role(props.id, props.createdAt, props.key, props.isSystem, props.name, props.description);
    }

    rename(name: RoleName): boolean {
        if (this._name.equals(name)) return false;
        this._name = name;
        return true;
    }

    changeDescription(description: string): boolean {
        if (this._description === description) return false;
        this._description = description;
        return true;
    }
}

export default interface RoleDocument {
    _id:         string;
    key:         string;
    name:        string;
    description: string;
    isSystem:    boolean;
    createdAt:   Date;
}

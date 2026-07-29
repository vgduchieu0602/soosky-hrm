export default interface UserRoleDocument {
    _id:        string;
    userId:     string;
    roleId:     string;
    assignedAt: Date;
}

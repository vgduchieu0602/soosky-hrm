// API công khai của module IAM.
// Chỉ những symbol được export ở đây mới truy cập được từ các module khác.

export { createIamHttpRouter } from "@modules/iam/adapters/driver/http";
export type { IamHttpUseCases } from "@modules/iam/adapters/driver/http";
export { subscribeIamEventConsumer } from "@modules/iam/adapters/driver/events";
export type { IamEventUseCases } from "@modules/iam/adapters/driver/events";
export { createIamAccessControl, createIamAuditTrail } from "@modules/iam/composition";
export type { IamAccessControlFacade, IamAuditTrailFacade } from "@modules/iam/composition";
export { createIamAuditReader } from "@modules/iam/composition";
export type { IamAuditReadFacade } from "@modules/iam/composition";

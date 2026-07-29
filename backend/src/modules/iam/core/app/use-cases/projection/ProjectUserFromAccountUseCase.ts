import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import User from "@modules/iam/core/domain/entities/User";
import UserRole from "@modules/iam/core/domain/entities/UserRole";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import { v7 as UUIDv7 } from "uuid";

const SYSTEM_ADMIN_ROLE_KEY = "admin";

export interface ProjectUserFromAccountInput {
    accountId:   string;
    displayName: string;
    email:       string;
}

/**
 * Tạo bản chiếu `User` khi nhận sự kiện `auth.account.verified` — được gọi từ
 * event handler, không qua kiểm tra quyền hạn (đây không phải thao tác do
 * người dùng chủ động thực hiện).
 *
 * Idempotent: user đã tồn tại (account được xác minh lại, hoặc sự kiện được
 * gửi lại) thì bỏ qua.
 *
 * Bootstrap: nếu chưa có user nào giữ role hệ thống "admin", user mới tạo
 * (chính là user đầu tiên của hệ thống trong trường hợp thông thường) được
 * tự động gán role đó — hệ thống luôn có ít nhất một admin để tự vận hành.
 */
export default class ProjectUserFromAccountUseCase {
    public constructor(
        private readonly _userRepo: UserRepo,
        private readonly _roleRepo: RoleRepo,
        private readonly _userRoleRepo: UserRoleRepo,
    ) {}

    /**
     * @param input.accountId   Id account bên module Auth — dùng làm id của User.
     * @param input.displayName Họ tên hiển thị lấy từ sự kiện `auth.account.verified`.
     * @param input.email       Email lấy từ sự kiện `auth.account.verified`.
     */
    public async execute(input: ProjectUserFromAccountInput): Promise<void> {
        if (await this._userRepo.existsById(input.accountId)) return;

        const user = User.create({
            id:          input.accountId,
            displayName: input.displayName,
            email:       input.email,
        });
        await this._userRepo.save(user);

        const adminRole = await this._roleRepo.getByKey(RoleKey.create(SYSTEM_ADMIN_ROLE_KEY));
        if (adminRole == undefined) return; // seed chưa chạy — bỏ qua, không chặn projection

        const hasAdmin = await this._userRoleRepo.existsByRoleId(adminRole.id);
        if (hasAdmin) return;

        await this._userRoleRepo.save(UserRole.create(UUIDv7(), user.id, adminRole.id));
    }
}

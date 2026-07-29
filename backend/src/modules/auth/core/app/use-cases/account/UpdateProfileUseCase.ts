import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import { EmailAlreadyInUseError } from "@modules/auth/core/app/errors/EmailAlreadyInUseError";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import { AccountProfileUpdatedEvent } from "@modules/auth/core/domain/events/AccountProfileUpdatedEvent";
import FullName from "@modules/auth/core/domain/value-objects/FullName";
import EventBus from "@shared/core/domain/EventBus";
import Email from "@shared/core/domain/value-objects/email/Email";

export interface UpdateProfileInput {
    accountId: string;
    email?:    string;
    fullName:  string;
}

/**
 * Cập nhật hồ sơ (email, họ tên) của chính chủ tài khoản và phát sự kiện
 * `auth.account.profile-updated` để các module khác làm mới bản chiếu user.
 *
 * Idempotent: hồ sơ không có gì thay đổi thì bỏ qua, không phát sự kiện.
 * Account chưa xác minh vẫn phát khi có thay đổi — consumer tự bỏ qua khi
 * bản chiếu chưa tồn tại.
 *
 * Bước kiểm tra email trùng không atomic với bước lưu; unique index trên email
 * ở tầng persistence là chốt chặn cuối cùng cho trường hợp cập nhật đua nhau.
 */
export default class UpdateProfileUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
        private readonly _eventBus: EventBus,
    ) {}

    /**
     * @param input.accountId Id account cần cập nhật (chính là actor).
     * @param input.email     Email mới — vắng mặt thì giữ nguyên email hiện tại.
     * @param input.fullName  Họ tên mới — giữ nguyên giá trị cũ nếu không đổi.
     *
     * @throws {AccountNotFoundError}    Account không tồn tại.
     * @throws {EmailInvalidError}       Email sai định dạng.
     * @throws {FullNameInvalidError}    Họ tên rỗng.
     * @throws {EmailAlreadyInUseError}  Email mới đã có account khác sử dụng.
     * @throws {AccountDeactivatedError} Account đã bị vô hiệu hoá.
     */
    public async execute(input: UpdateProfileInput): Promise<void> {
        const account = await this._accountRepo.getById(input.accountId);
        if (account == undefined) {
            throw new AccountNotFoundError();
        }

        const email        = input.email == undefined ? account.email : Email.create(input.email);
        const emailChanged = !account.email.equals(email);
        if (emailChanged && await this._accountRepo.existsByEmail(email)) {
            throw new EmailAlreadyInUseError();
        }

        const changed = account.updateProfile({
            email:    email,
            fullName: FullName.create(input.fullName),
        });
        if (!changed) return;

        await this._accountRepo.save(account);
        await this._eventBus.publish([new AccountProfileUpdatedEvent(account)]);
    }
}

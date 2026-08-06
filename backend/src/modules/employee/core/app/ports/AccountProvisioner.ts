export interface ProvisionAccountInput {
    /** Email đăng nhập — cũng là nơi nhận mật khẩu tạm và link kích hoạt. */
    email:    string;
    fullName: string;
    /** Account của người thực hiện (HR/Admin) — module Auth tự kiểm role. */
    actorAccountId: string;
}

export interface ProvisionedAccount {
    accountId: string;
    /** Địa chỉ đã nhận mail kích hoạt — trả lại để HR xác nhận đúng người. */
    email:     string;
}

/**
 * Cổng cấp tài khoản đăng nhập, do module Auth sở hữu nghiệp vụ. Module
 * Employee KHÔNG import Auth — composition root nối cổng này vào
 * `RegisterMemberAccountUseCase`.
 *
 * Hiện thực bên Auth chịu trách nhiệm: sinh mật khẩu tạm, đánh cờ buộc đổi mật
 * khẩu, phát hành token xác minh và GỬI MAIL kèm link kích hoạt. Employee chỉ
 * biết kết quả là một `accountId` để gắn vào hồ sơ.
 */
export default interface AccountProvisioner {
    provisionAccount(input: ProvisionAccountInput): Promise<ProvisionedAccount>;
}

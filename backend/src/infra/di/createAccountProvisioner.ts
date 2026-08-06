import AccountProvisioner from "@modules/employee/core/app/ports/AccountProvisioner";
import RegisterMemberAccountUseCase from "@modules/auth/core/app/use-cases/account/RegisterMemberAccountUseCase";

/**
 * Nối cổng `AccountProvisioner` của module Employee vào use-case
 * `RegisterMemberAccountUseCase` của module Auth — đây là chỗ DUY NHẤT hai
 * module gặp nhau, đúng vai composition root.
 *
 * Toàn bộ nghiệp vụ cấp tài khoản (sinh mật khẩu tạm, đánh cờ buộc đổi mật
 * khẩu, phát hành token xác minh, gửi mail kèm link kích hoạt) nằm bên Auth;
 * adapter này chỉ dịch hình dạng input/output.
 */
export default function createAccountProvisioner(
    registerMemberAccount: RegisterMemberAccountUseCase,
): AccountProvisioner {
    return {
        provisionAccount: async input => {
            const account = await registerMemberAccount.execute({
                email:          input.email,
                fullName:       input.fullName,
                actorAccountId: input.actorAccountId,
            });

            return { accountId: account.id, email: account.email.value };
        },
    };
}

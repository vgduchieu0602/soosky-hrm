import RegisterSuperAdminAccountUseCase, { RegisterSuperAdminAccountInput } from "@modules/auth/core/app/use-cases/account/RegisterSuperAdminAccountUseCase";
import { parseFlags } from "@shared/adapters/driver/cli/flags";

export interface RegisterSuperAdminAccountCommandUseCases {
    registerSuperAdminAccount: RegisterSuperAdminAccountUseCase;
}

const FLAG_SCHEMA = {
    email:    { flag: "--email" },
    password: { flag: "--password" },
    fullName: { flag: "--full-name" },
};

/**
 * Lệnh `register-super-admin`: parse tham số, gọi use-case tương ứng rồi in
 * kết quả — không chứa nghiệp vụ (tương ứng AccountController phía HTTP).
 *
 * Bước parse tách thành hàm static thuần để adapter kiểm tra tham số trước
 * khi composition root kết nối hạ tầng.
 */
export default class RegisterSuperAdminAccountCommand {
    static readonly COMMAND = "register-super-admin";
    static readonly USAGE   = [
        `${RegisterSuperAdminAccountCommand.COMMAND} --email <email> --password <password> --full-name <name>`,
        "",
        "Create the system's one and only super admin (owner) account.",
        "The account is activated immediately, no email verification needed.",
        "",
        "Options:",
        "  --email <email>          Login email",
        "  --password <password>    Raw password, hashed before storing",
        "  --full-name <name>       Account holder's full name",
    ].join("\n");

    public constructor(
        private readonly _useCases: RegisterSuperAdminAccountCommandUseCases,
    ) {}

    /**
     * @throws {CliUsageError} Flag thiếu, thiếu giá trị hoặc không nhận diện được.
     */
    public static parseInput(args: string[]): RegisterSuperAdminAccountInput {
        return parseFlags(args, FLAG_SCHEMA);
    }

    public async run(input: RegisterSuperAdminAccountInput): Promise<void> {
        const account = await this._useCases.registerSuperAdminAccount.execute(input);
        console.log(`Super admin account created: ${account.email.value} (id: ${account.id})`);
    }
}

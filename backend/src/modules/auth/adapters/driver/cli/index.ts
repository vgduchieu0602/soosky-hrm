import RegisterSuperAdminAccountCommand, { RegisterSuperAdminAccountCommandUseCases } from "@modules/auth/adapters/driver/cli/commands/RegisterSuperAdminAccountCommand";
import { CliUsageError } from "@shared/adapters/driver/cli/flags";
import ApplicationError from "@shared/core/app/errors/ApplicationError";
import DomainError from "@shared/core/domain/DomainError";

/**
 * Toàn bộ use-case mà driver adapter CLI cần để phục vụ các lệnh của module.
 */
export type AuthCliUseCases = RegisterSuperAdminAccountCommandUseCases;

export const AUTH_CLI_USAGE = [
    "Usage: npm run cli -- <command> [options]",
    "",
    "Commands:",
    ...RegisterSuperAdminAccountCommand.USAGE.split("\n").map(line => `  ${line}`),
].join("\n");

/**
 * Driver adapter CLI của module Auth — phục vụ các thao tác vận hành không mở
 * qua HTTP API (hiện chỉ có bootstrap super admin).
 *
 * Nhận factory lazy thay vì bộ use-case dựng sẵn: composition root chỉ kết
 * nối hạ tầng (MongoDB) sau khi lệnh và tham số đã hợp lệ — `--help` hay gõ
 * sai lệnh không cần chạm tới DB.
 *
 * Trả về exit code thay vì tự `process.exit` để composition root còn dọn tài
 * nguyên (đóng kết nối MongoDB) trước khi thoát. Lỗi nghiệp vụ (Application/
 * DomainError) được in theo dạng `CODE: message`; lỗi không nhận diện được
 * ném tiếp cho composition root.
 */
export async function runAuthCli(
    argv: string[],
    createUseCases: () => Promise<AuthCliUseCases>,
): Promise<number> {
    const [commandName, ...args] = argv;

    if (commandName == undefined || commandName === "--help" || commandName === "-h") {
        console.log(AUTH_CLI_USAGE);
        return commandName == undefined ? 1 : 0;
    }
    if (commandName !== RegisterSuperAdminAccountCommand.COMMAND) {
        console.error(`Unknown command: ${commandName}\n\n${AUTH_CLI_USAGE}`);
        return 1;
    }

    try {
        const input   = RegisterSuperAdminAccountCommand.parseInput(args);
        const command = new RegisterSuperAdminAccountCommand(await createUseCases());
        await command.run(input);
        return 0;
    } catch (error) {
        if (error instanceof CliUsageError) {
            console.error(`${error.message}\n\n${AUTH_CLI_USAGE}`);
            return 1;
        }
        if (error instanceof ApplicationError || error instanceof DomainError) {
            console.error(`${error.code}: ${error.message}`);
            return 1;
        }
        throw error;
    }
}

import loadAppConfig from "@infra/config";
import connectMongo from "@infra/db/connectMongo";
import createAuthCliUseCases from "@infra/di/createAuthCliUseCases";
import createIamEventUseCases from "@infra/di/createIamEventUseCases";
import InProcessEventBus from "@infra/events/InProcessEventBus";
import { runAuthCli } from "@modules/auth";
import { subscribeIamEventConsumer } from "@modules/iam";
import { MongoClient } from "mongodb";

/**
 * Điểm khởi động CLI vận hành (bootstrap super admin, ...).
 *
 * Hạ tầng chỉ được kết nối qua factory lazy — adapter CLI gọi tới khi lệnh
 * và tham số đã hợp lệ, nên `--help`/gõ sai lệnh không cần MongoDB. Chạy xong
 * đóng kết nối và thoát với exit code của lệnh.
 */
async function main(): Promise<number> {
    let mongoClient: MongoClient | undefined;

    try {
        return await runAuthCli(process.argv.slice(2), async () => {
            const config = loadAppConfig();

            const { mongoDb } = await connectMongo(config);

            // Bus sự kiện: auth publish sự kiện account khi bootstrap super admin;
            // iam đăng ký consumer tại đây để superadmin bootstrap qua CLI cũng
            // được chiếu sang User + trở thành admin (user đầu tiên → admin).
            const eventBus = new InProcessEventBus();
            subscribeIamEventConsumer(eventBus, createIamEventUseCases(mongoDb));

            return createAuthCliUseCases(mongoDb, eventBus);
        });
    } finally {
        await mongoClient?.close();
    }
}

main().then(
    exitCode => process.exit(exitCode),
    error => {
        console.error("CLI failed:", error);
        process.exit(1);
    },
);

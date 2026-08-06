import buildHttpApp from "@infra/bootstrap/buildHttpApp";
import loadAppConfig from "@infra/config";
import connectMongo from "@infra/db/connectMongo";
import { Server } from "http";
import { MongoClient } from "mongodb";

/**
 * Tạo handler cho tín hiệu dừng tiến trình, đóng HTTP server trước rồi mới
 * ngắt kết nối MongoDB.
 */
function createShutdownSignalHandler(server: Server, mongoClient: MongoClient): (signal: NodeJS.Signals) => void {
    return function(signal: NodeJS.Signals): void {
        console.log(`Received ${signal}, shutting down...`);
        server.close(() => {
            mongoClient.close()
                .catch(error => console.error("Error while closing MongoDB connection:", error))
                .finally(() => process.exit(0));
        });
    }
}

/**
 * Điểm khởi động ứng dụng: đọc cấu hình, kết nối MongoDB, lắp ráp ứng dụng
 * HTTP (`buildHttpApp` — dùng chung với test tích hợp), rồi lắng nghe cho tới
 * khi nhận tín hiệu dừng tiến trình.
 */
async function main(): Promise<void> {
    const config = loadAppConfig();

    const { mongoClient, mongoDb } = await connectMongo(config);
    console.log(`Connected to MongoDB at ${config.mongodb.uri} (db: ${config.mongodb.dbName})`);

    const expressServer = buildHttpApp(config, mongoClient, mongoDb);

    // Bind theo HTTP_HOST (docker đặt 0.0.0.0 để container ngoài gọi vào được;
    // dev mặc định localhost). Config luôn có giá trị mặc định nên chỉ cần
    // fallback cho kiểu optional.
    const host = config.http.host ?? "0.0.0.0";

    const server = expressServer.listen(config.http.port, host, () => {
        console.log(`Server listening on http://${host}:${config.http.port}`);
    });

    const shutdownSignalHandler = createShutdownSignalHandler(server, mongoClient);
    process.on("SIGINT", shutdownSignalHandler);
    process.on("SIGTERM", shutdownSignalHandler);
}

main().catch(error => {
    console.error("Failed to start server:", error);
    process.exit(1);
});

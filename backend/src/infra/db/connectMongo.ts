import { AppConfig } from "@infra/config";
import ensureMongoIndexes from "@infra/db/ensureMongoIndexes";
import seedIam from "@infra/db/seedIam";
import { MongoClient } from "mongodb";

/**
 * Kết nối MongoDB theo cấu hình, trả về instance của client và db.
 */
export default async function connectMongo(config: AppConfig) {
    const mongoClient = new MongoClient(config.mongodb.uri);
    await mongoClient.connect();
    const mongoDb = mongoClient.db(config.mongodb.dbName);

    // CLI bootstrap có thể chạy trên database trắng, trước cả lần
    // khởi động server đầu tiên — bảo đảm index như server làm.
    await ensureMongoIndexes(mongoDb);

    // Nạp catalog quyền hạn + role hệ thống "admin" — idempotent, chạy song
    // song với ensureMongoIndexes cho cả server lẫn CLI.
    await seedIam(mongoDb);

    return { mongoClient, mongoDb };
}

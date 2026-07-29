import UnauthorizedError from "@shared/adapters/driver/http/errors/UnauthorizedError";
import { Response } from "express";

const ACTOR_USER_ID_KEY = "actorUserId";

/**
 * Ghi/đọc danh tính actor đã xác thực trong phạm vi một request.
 *
 * Middleware `authenticate` ghi vào `res.locals`; các route handler đọc ra để
 * truyền `actorUserId` vào use-case (trường này không bao giờ lấy từ path/body).
 */
const ActorContext = {
    set(res: Response, userId: string): void {
        res.locals[ACTOR_USER_ID_KEY] = userId;
    },

    get(res: Response): string {
        const userId = res.locals[ACTOR_USER_ID_KEY];
        if (typeof userId !== "string") throw new UnauthorizedError();
        return userId;
    },
};

export default ActorContext;

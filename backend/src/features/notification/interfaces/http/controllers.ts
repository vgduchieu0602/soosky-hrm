import type { Request, Response, NextFunction } from 'express';
import { notificationService } from '@features/notification/container';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

export const notificationController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const unreadOnly = (req.query as { unread?: string }).unread === 'true';
      const limit = Number((req.query as { limit?: string }).limit) || undefined;
      res.json({ data: await notificationService.listMine(userId(req), { unreadOnly, limit }) });
    } catch (e) {
      next(e);
    }
  },
  async unreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: { count: await notificationService.unreadCount(userId(req)) } });
    } catch (e) {
      next(e);
    }
  },
  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await notificationService.markRead(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await notificationService.markAllRead(userId(req)) });
    } catch (e) {
      next(e);
    }
  },
};

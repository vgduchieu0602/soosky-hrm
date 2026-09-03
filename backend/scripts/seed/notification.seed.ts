/**
 * In-app notifications for the three demo accounts.
 *
 * Written directly rather than emitted through the event bus on purpose: the
 * listeners that would normally produce these are registered by `server.ts`
 * only, and one of them also sends a real email. Seeding the rows keeps the
 * notification bell populated with zero external side effects.
 */
import { Notification } from '@modules/hrm/adapters/persistence/mongoose/models/notification.model';
import { userRepository } from '@modules/iam';
import { NOTIFICATIONS } from './dataset';
import { line } from './common';

export async function seedNotifications(): Promise<number> {
  const emails = [...new Set(NOTIFICATIONS.map((n) => n.email))];
  const idByEmail = new Map<string, string>();
  for (const email of emails) {
    const user = await userRepository.findByIdentifier(email);
    if (user) idByEmail.set(email, user.id);
  }

  const userIds = [...idByEmail.values()];
  if (userIds.length === 0) return 0;
  await Notification.deleteMany({ userId: { $in: userIds } });

  let count = 0;
  for (const n of NOTIFICATIONS) {
    const userId = idByEmail.get(n.email);
    if (!userId) continue;
    await Notification.create({
      userId,
      type: n.type,
      severity: n.severity,
      title: n.title,
      message: n.message,
      link: n.link,
      read: n.read,
      readAt: n.read ? new Date() : null,
    });
    count += 1;
  }

  line('Notifications', count);
  return count;
}

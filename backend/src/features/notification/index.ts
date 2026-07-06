// Public surface of the notification feature (Clean Architecture).
export { default as notificationRouter } from '@features/notification/interfaces/http/notification.routes';
export { registerNotificationListeners } from '@features/notification/interfaces/listeners/notification.listener';
export { notificationService } from '@features/notification/container';

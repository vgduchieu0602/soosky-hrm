import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'notification';
const COLLECTION_NAME = 'notifications';

export const NOTIFICATION_TYPE = [
  'account',
  'security',
  'leave',
  'payroll',
  'performance',
  'employee',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

export const NOTIFICATION_SEVERITY = ['info', 'success', 'warning', 'critical'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITY)[number];

export interface INotification {
  userId: Types.ObjectId; // recipient
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null; // FE route to deep-link into the resource
  read: boolean;
  readAt?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export type NotificationDoc = HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPE, required: true, index: true },
    severity: { type: String, enum: NOTIFICATION_SEVERITY, default: 'info' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, created_at: -1 });

export const Notification = mongoose.model<INotification>(DB_NAME, notificationSchema);

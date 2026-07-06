/**
 * Composition root — the only place that knows about concrete adapters. Wires
 * infrastructure implementations into the notification use-cases.
 */
import { MongooseNotificationRepository } from '@features/notification/infrastructure/notification.repository.mongoose';
import {
  MongooseRoleGateway,
  MongooseEmployeeGateway,
  MongoosePayrollGateway,
  MongooseEvaluationGateway,
} from '@features/notification/infrastructure/gateways.mongoose';
import { PinoLogger } from '@features/notification/infrastructure/services';
import { NotificationUseCases } from '@features/notification/application/notification.usecases';
import { NotificationEventUseCases } from '@features/notification/application/notification-events.usecases';

// --- infrastructure ---
const notificationRepo = new MongooseNotificationRepository();
const roleGw = new MongooseRoleGateway();
const employeeGw = new MongooseEmployeeGateway();
const payrollGw = new MongoosePayrollGateway();
const evaluationGw = new MongooseEvaluationGateway();
export const notificationLogger = new PinoLogger();

// --- application ---
export const notificationService = new NotificationUseCases(notificationRepo, roleGw, notificationLogger);

export const notificationEventUseCases = new NotificationEventUseCases(
  notificationService,
  employeeGw,
  payrollGw,
  evaluationGw,
  notificationLogger,
);

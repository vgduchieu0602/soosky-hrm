/**
 * Composition root — the only place that knows about concrete adapters. Wires
 * infrastructure implementations into the notification use-cases.
 */
import { MongooseNotificationRepository } from '@modules/hrm/adapters/persistence/mongoose/notification/notification.repository';
import {
  MongooseRoleGateway,
  MongooseEmployeeGateway,
  MongoosePayrollGateway,
  MongooseEvaluationGateway,
} from '@modules/hrm/adapters/persistence/mongoose/notification/gateways';
import { PinoLogger } from '@modules/hrm/adapters/services/notification.services';
import { NotificationUseCases } from '@modules/hrm/core/notification/app/notification.usecases';
import { NotificationEventUseCases } from '@modules/hrm/core/notification/app/notification-events.usecases';

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

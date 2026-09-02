/**
 * Composition root — the only place that instantiates concrete adapters and
 * wires them into the dashboard use-cases.
 */
import { MongooseDashboardRepository } from '@modules/hrm/adapters/persistence/mongoose/dashboard/dashboard.repository';
import { SystemClock } from '@modules/hrm/adapters/services/dashboard.services';
import { DashboardUseCases } from '@modules/hrm/core/dashboard/app/dashboard.usecases';
import { periodGateway } from '@modules/hrm/adapters/container/period';

const dashboardRepo = new MongooseDashboardRepository(periodGateway);
const clock = new SystemClock();

export const dashboardUseCases = new DashboardUseCases(dashboardRepo, clock);

/**
 * Composition root — the only place that instantiates concrete adapters and
 * wires them into the dashboard use-cases.
 */
import { MongooseDashboardRepository } from '@features/dashboard/infrastructure/dashboard.repository.mongoose';
import { SystemClock } from '@features/dashboard/infrastructure/services';
import { DashboardUseCases } from '@features/dashboard/application/dashboard.usecases';
import { periodGateway } from '@features/period/container';

const dashboardRepo = new MongooseDashboardRepository(periodGateway);
const clock = new SystemClock();

export const dashboardUseCases = new DashboardUseCases(dashboardRepo, clock);

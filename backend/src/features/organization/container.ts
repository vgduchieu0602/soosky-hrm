/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases and
 * exposes them ready-to-use for the HTTP layer.
 */
import { MongooseDepartmentRepository } from '@features/organization/infrastructure/department.repository.mongoose';
import { MongoosePositionRepository } from '@features/organization/infrastructure/position.repository.mongoose';
import {
  MongooseEmployeeGateway,
  MongooseEmployeeHistoryGateway,
  MongoosePositionGateway,
  MongooseDepartmentRefGateway,
} from '@features/organization/infrastructure/gateways.mongoose';
import {
  SystemClock,
  ObjectIdValidator,
  AuditServiceAdapter,
  MongooseUnitOfWork,
} from '@features/organization/infrastructure/services';
import { DepartmentUseCases } from '@features/organization/application/department.usecases';
import { PositionUseCases } from '@features/organization/application/position.usecases';

// --- infrastructure ---
const departmentRepo = new MongooseDepartmentRepository();
const positionRepo = new MongoosePositionRepository();

const employeeGw = new MongooseEmployeeGateway();
const employeeHistoryGw = new MongooseEmployeeHistoryGateway();
const positionGw = new MongoosePositionGateway();
const departmentRefGw = new MongooseDepartmentRefGateway();

const clock = new SystemClock();
const ids = new ObjectIdValidator();
const audit = new AuditServiceAdapter();
const uow = new MongooseUnitOfWork();

// --- application ---
export const departmentUseCases = new DepartmentUseCases(
  departmentRepo,
  employeeGw,
  employeeHistoryGw,
  positionGw,
  audit,
  uow,
  clock,
  ids,
);

export const positionUseCases = new PositionUseCases(
  positionRepo,
  departmentRefGw,
  employeeGw,
  audit,
);

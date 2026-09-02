/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases and
 * exposes them ready-to-use for the HTTP layer.
 */
import { MongooseDepartmentRepository } from '@modules/hrm/adapters/persistence/mongoose/organization/department.repository';
import { MongoosePositionRepository } from '@modules/hrm/adapters/persistence/mongoose/organization/position.repository';
import {
  MongooseEmployeeGateway,
  MongooseEmployeeHistoryGateway,
  MongoosePositionGateway,
  MongooseDepartmentRefGateway,
} from '@modules/hrm/adapters/persistence/mongoose/organization/gateways';
import {
  SystemClock,
  ObjectIdValidator,
  AuditServiceAdapter,
  MongooseUnitOfWork,
} from '@modules/hrm/adapters/services/organization.services';
import { DepartmentUseCases } from '@modules/hrm/core/organization/app/department.usecases';
import { PositionUseCases } from '@modules/hrm/core/organization/app/position.usecases';

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

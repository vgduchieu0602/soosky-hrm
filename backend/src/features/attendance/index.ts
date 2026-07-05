// Public surface of the attendance feature (Clean Architecture).
export { default as attendanceRouter } from '@features/attendance/interfaces/http/attendance.routes';

// Catalog use-cases re-exported under their legacy service names for callers
// that only need list/create/update/remove.
export {
  shiftUseCases as shiftService,
  holidayUseCases as holidayService,
  symbolUseCases as symbolService,
  attendanceUseCases,
  leaveUseCases,
  leaveEntitlement,
} from '@features/attendance/container';

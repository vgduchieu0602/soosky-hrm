import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';
import { catalogController } from '@features/attendance/controllers/catalog.controller';
import { attendanceController } from '@features/attendance/controllers/attendance.controller';
import { leaveController } from '@features/attendance/controllers/leave.controller';
import {
  createShiftDto,
  updateShiftDto,
  createHolidayDto,
  updateHolidayDto,
  createSymbolDto,
  updateSymbolDto,
} from '@features/attendance/dto/catalog.dto';
import {
  upsertAttendanceDto,
  adjustAttendanceDto,
  bulkUpsertAttendanceDto,
} from '@features/attendance/dto/attendance.dto';
import { submitLeaveDto, rejectLeaveDto } from '@features/attendance/dto/leave.dto';

const router = Router();
const hrOrAdmin = requireRoles('admin', 'hr_manager');

// ---- Shifts ----
router.get('/shifts', authenticate, catalogController.listShifts);
router.post('/admin/shifts', authenticate, hrOrAdmin, validate(createShiftDto, 'body'), catalogController.createShift);
router.patch('/admin/shifts/:id', authenticate, hrOrAdmin, validate(updateShiftDto, 'body'), catalogController.updateShift);
router.delete('/admin/shifts/:id', authenticate, hrOrAdmin, catalogController.removeShift);

// ---- Holidays ----
router.get('/holidays', authenticate, catalogController.listHolidays);
router.post('/admin/holidays', authenticate, hrOrAdmin, validate(createHolidayDto, 'body'), catalogController.createHoliday);
router.patch('/admin/holidays/:id', authenticate, hrOrAdmin, validate(updateHolidayDto, 'body'), catalogController.updateHoliday);
router.delete('/admin/holidays/:id', authenticate, hrOrAdmin, catalogController.removeHoliday);

// ---- Attendance symbols ----
router.get('/attendance-symbols', authenticate, catalogController.listSymbols);
router.post('/admin/attendance-symbols', authenticate, hrOrAdmin, validate(createSymbolDto, 'body'), catalogController.createSymbol);
router.patch('/admin/attendance-symbols/:id', authenticate, hrOrAdmin, validate(updateSymbolDto, 'body'), catalogController.updateSymbol);

// ---- Attendance records ----
// Self (employee): only own records, derived from the token.
router.get('/attendances/me', authenticate, attendanceController.myMonth);
router.post('/attendances/check-in', authenticate, attendanceController.checkIn);
router.post('/attendances/check-out', authenticate, attendanceController.checkOut);
// Admin/HR: full grid + chấm/sửa.
router.get('/admin/attendances', authenticate, hrOrAdmin, attendanceController.adminGrid);
router.post('/admin/attendances', authenticate, hrOrAdmin, validate(upsertAttendanceDto, 'body'), attendanceController.upsert);
router.post('/admin/attendances/bulk', authenticate, hrOrAdmin, validate(bulkUpsertAttendanceDto, 'body'), attendanceController.bulkUpsert);
router.patch('/admin/attendances/:id', authenticate, hrOrAdmin, validate(adjustAttendanceDto, 'body'), attendanceController.adjust);
router.delete('/admin/attendances/:id', authenticate, hrOrAdmin, attendanceController.remove);

// ---- Leave requests ----
// Self (employee).
router.post('/leave-requests', authenticate, validate(submitLeaveDto, 'body'), leaveController.submit);
router.get('/leave-requests/me', authenticate, leaveController.mine);
router.patch('/leave-requests/:id/cancel', authenticate, leaveController.cancel);
router.get('/leave-balances/me', authenticate, leaveController.myBalances);
// Admin/HR.
router.get('/admin/leave-requests', authenticate, hrOrAdmin, leaveController.adminList);
router.post('/admin/leave-requests/:id/approve', authenticate, hrOrAdmin, leaveController.approve);
router.post('/admin/leave-requests/:id/reject', authenticate, hrOrAdmin, validate(rejectLeaveDto, 'body'), leaveController.reject);
router.get('/admin/leave-balances/:employeeId', authenticate, hrOrAdmin, leaveController.adminBalances);

export default router;

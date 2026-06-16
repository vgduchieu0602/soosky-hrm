import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';
import { catalogController } from '@features/attendance/controllers/catalog.controller';
import {
  createShiftDto,
  updateShiftDto,
  createHolidayDto,
  updateHolidayDto,
  createSymbolDto,
  updateSymbolDto,
} from '@features/attendance/dto/catalog.dto';

const router = Router();
const hrOrAdmin = requireRoles('admin', 'hr_manager');

// ---- Shifts ----
router.get('/shifts', authenticate, catalogController.listShifts);
router.post('/admin/shifts', authenticate, hrOrAdmin, validate(createShiftDto, 'body'), catalogController.createShift);
router.patch('/admin/shifts/:id', authenticate, hrOrAdmin, validate(updateShiftDto, 'body'), catalogController.updateShift);

// ---- Holidays ----
router.get('/holidays', authenticate, catalogController.listHolidays);
router.post('/admin/holidays', authenticate, hrOrAdmin, validate(createHolidayDto, 'body'), catalogController.createHoliday);
router.patch('/admin/holidays/:id', authenticate, hrOrAdmin, validate(updateHolidayDto, 'body'), catalogController.updateHoliday);
router.delete('/admin/holidays/:id', authenticate, hrOrAdmin, catalogController.removeHoliday);

// ---- Attendance symbols ----
router.get('/attendance-symbols', authenticate, catalogController.listSymbols);
router.post('/admin/attendance-symbols', authenticate, hrOrAdmin, validate(createSymbolDto, 'body'), catalogController.createSymbol);
router.patch('/admin/attendance-symbols/:id', authenticate, hrOrAdmin, validate(updateSymbolDto, 'body'), catalogController.updateSymbol);

export default router;

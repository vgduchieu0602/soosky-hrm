import { HttpError } from '@shared/errors/http-error';
import type { ShiftRepository, HolidayRepository, SymbolRepository, AuditPort } from '@modules/hrm/core/attendance/domain/ports';

const idOf = (d: Record<string, unknown>) => String(d._id);

export class ShiftUseCases {
  constructor(private readonly repo: ShiftRepository, private readonly audit: AuditPort) {}
  list() {
    return this.repo.list();
  }
  async create(input: Record<string, unknown>, userId: string) {
    const doc = await this.repo.create(input);
    await this.audit.record({ userId, resource: 'shift', action: 'create', resourceId: idOf(doc) });
    return doc;
  }
  async update(id: string, input: Record<string, unknown>, userId: string) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new HttpError(404, 'Shift not found', 'ATT_001');
    await this.audit.record({ userId, resource: 'shift', action: 'update', resourceId: id, changes: input });
    return updated;
  }
  // Soft-remove a ca (archive) — keeps it referenced by historical records.
  async remove(id: string, userId: string) {
    const updated = await this.repo.archive(id);
    if (!updated) throw new HttpError(404, 'Shift not found', 'ATT_001');
    await this.audit.record({ userId, resource: 'shift', action: 'delete', resourceId: id });
    return { id };
  }
}

export class HolidayUseCases {
  constructor(private readonly repo: HolidayRepository, private readonly audit: AuditPort) {}
  list() {
    return this.repo.list();
  }
  async create(input: Record<string, unknown>, userId: string) {
    const doc = await this.repo.create(input);
    await this.audit.record({ userId, resource: 'holiday', action: 'create', resourceId: idOf(doc) });
    return doc;
  }
  async update(id: string, input: Record<string, unknown>, userId: string) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new HttpError(404, 'Holiday not found', 'ATT_002');
    await this.audit.record({ userId, resource: 'holiday', action: 'update', resourceId: id, changes: input });
    return updated;
  }
  async remove(id: string, userId: string) {
    const ok = await this.repo.remove(id);
    if (!ok) throw new HttpError(404, 'Holiday not found', 'ATT_002');
    await this.audit.record({ userId, resource: 'holiday', action: 'delete', resourceId: id });
    return { id };
  }
}

export class SymbolUseCases {
  constructor(private readonly repo: SymbolRepository, private readonly audit: AuditPort) {}
  list() {
    return this.repo.list();
  }
  async create(input: { code: string } & Record<string, unknown>, userId: string) {
    const dup = await this.repo.findByCode(input.code);
    if (dup) throw new HttpError(409, 'Symbol code already exists', 'ATT_003');
    const doc = await this.repo.create(input);
    await this.audit.record({ userId, resource: 'attendanceSymbol', action: 'create', resourceId: idOf(doc) });
    return doc;
  }
  async update(id: string, input: Record<string, unknown>, userId: string) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new HttpError(404, 'Symbol not found', 'ATT_003');
    await this.audit.record({ userId, resource: 'attendanceSymbol', action: 'update', resourceId: id, changes: input });
    return updated;
  }
  async remove(id: string, userId: string) {
    const ok = await this.repo.remove(id);
    if (!ok) throw new HttpError(404, 'Symbol not found', 'ATT_003');
    await this.audit.record({ userId, resource: 'attendanceSymbol', action: 'delete', resourceId: id });
    return { id };
  }
}

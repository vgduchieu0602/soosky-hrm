import { z } from 'zod';
import { GENDER, MARITAL_STATUS } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';

export const updateProfileDto = z
  .object({
    firstName: z.string().min(1).max(120).trim().optional(),
    middleName: z.string().max(120).trim().optional(),
    lastName: z.string().min(1).max(120).trim().optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(GENDER).optional(),
    nationality: z.string().min(2).max(3).optional(),
    maritalStatus: z.enum(MARITAL_STATUS).optional(),
    // Object storage key (avatars/<id>/<uuid>-file.png), not a full URL.
    avatarUrl: z.string().min(1).max(1024).optional(),
    avatarId: z.string().optional(),
    email: z.string().email().optional(),
    workEmail: z.string().email().optional(),
    phone: z.string().min(6).max(40).optional(),
    address: z.string().max(255).optional(),
    socialInsuranceNo: z.string().max(40).trim().optional(),
    taxCode: z.string().max(40).trim().optional(),
    vehiclePlate: z.string().max(20).trim().optional(),
  })
  .strict();

export type UpdateProfileDto = z.infer<typeof updateProfileDto>;

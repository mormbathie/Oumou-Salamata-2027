import { BadRequestException } from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { StaffAttendanceService } from './staff-attendance.service';

describe('StaffAttendanceService', () => {
  const actor = { userId: 'controller-1', username: 'control', firstName: 'Awa', lastName: 'Sow', roles: ['CONTROLEUR_PRESENCE'] };
  const teacher = { id: 'teacher-1', firstName: 'Ali', lastName: 'Fall', email: 'ali@example.com', role: Role.ENSEIGNANT };
  const settings = { timeZone: 'Africa/Dakar', startTime: '08:00', restDays: '' };
  const prisma = {
    staffQrCard: { findUnique: jest.fn() },
    schoolCalendarSettings: { upsert: jest.fn() },
    schoolHoliday: { findUnique: jest.fn() },
    staffAttendance: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  } as any;
  const service = new StaffAttendanceService(prisma);
  const code = `ASSTAFF1:${'a'.repeat(48)}`;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.staffQrCard.findUnique.mockResolvedValue({ teacher });
    prisma.schoolCalendarSettings.upsert.mockResolvedValue(settings);
    prisma.schoolHoliday.findUnique.mockResolvedValue(null);
    prisma.staffAttendance.findUnique.mockResolvedValue(null);
    prisma.staffAttendance.upsert.mockImplementation(async ({ create }: any) => create);
  });

  it('records the authenticated controller on arrival', async () => {
    const result = await service.scan(code, actor);
    expect(result.event).toBe('arrival');
    expect(prisma.staffAttendance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ teacherId: teacher.id, checkInById: actor.userId, checkInByName: 'Awa Sow' }),
    }));
  });

  it('records the authenticated controller on departure', async () => {
    prisma.staffAttendance.findUnique.mockResolvedValue({ id: 'attendance-1', checkInAt: new Date(), checkOutAt: null, status: AttendanceStatus.PRESENT });
    prisma.staffAttendance.update.mockImplementation(async ({ data }: any) => data);
    const result = await service.scan(code, actor);
    expect(result.event).toBe('departure');
    expect(prisma.staffAttendance.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ checkOutById: actor.userId, checkOutByName: 'Awa Sow' }),
    }));
  });

  it('rejects a scan on a holiday', async () => {
    prisma.schoolHoliday.findUnique.mockResolvedValue({ name: 'Fête scolaire' });
    await expect(service.scan(code, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.staffAttendance.upsert).not.toHaveBeenCalled();
  });
});

import { DoorBadgeService } from './door-badge.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffAttendanceController } from './staff-attendance.controller';
import { StaffAttendanceService } from './staff-attendance.service';

@Module({ imports: [PrismaModule], controllers: [StaffAttendanceController], providers: [StaffAttendanceService, DoorBadgeService] })
export class StaffAttendanceModule {}

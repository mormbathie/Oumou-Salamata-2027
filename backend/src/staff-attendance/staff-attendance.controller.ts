import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StaffAttendanceService } from './staff-attendance.service';

@ApiTags('Pointage des professeurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff-attendance')
export class StaffAttendanceController {
  constructor(private readonly service: StaffAttendanceService) {}

  @Get('me/card')
  @Roles('ENSEIGNANT')
  myCard(@CurrentUser() actor: any) { return this.service.myCard(actor); }

  @Get('me')
  @Roles('ENSEIGNANT')
  myHistory(@CurrentUser() actor: any, @Query('start') start?: string, @Query('end') end?: string) { return this.service.myHistory(actor, start, end); }

  @Post('scan')
  @Roles('ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE')
  scan(@Body() body: { code: string }, @CurrentUser() actor: any) { return this.service.scan(body?.code, actor); }

  @Get('calendar')
  @Roles('ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE', 'ENSEIGNANT')
  getCalendar() { return this.service.getCalendar(); }

  @Patch('calendar')
  @Roles('ADMIN', 'DIRECTEUR')
  updateCalendar(@Body() body: { restDays: number[]; startTime: string; timeZone: string }) { return this.service.updateCalendar(body); }

  @Post('calendar/holidays')
  @Roles('ADMIN', 'DIRECTEUR')
  addHoliday(@Body() body: { date: string; name: string }) { return this.service.addHoliday(body); }

  @Delete('calendar/holidays/:id')
  @Roles('ADMIN', 'DIRECTEUR')
  removeHoliday(@Param('id') id: string) { return this.service.removeHoliday(id); }

  @Get()
  @Roles('ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE')
  list(@Query('date') date?: string) { return this.service.list(date); }

  @Post('finalize')
  @Roles('ADMIN', 'DIRECTEUR')
  finalize(@Body() body: { date: string }) { return this.service.finalize(body?.date); }
}

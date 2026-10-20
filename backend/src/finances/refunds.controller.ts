import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { type RefundInput, RefundsService } from './refunds.service';
@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
export class RefundsController {
  constructor(private readonly service: RefundsService) {}
  @Get() list(@Query('studentId') id?: string) { return this.service.list(id); }
  @Get('payments/:studentId') payments(@Param('studentId') id: string) { return this.service.payments(id); }
  @Get('departures') departures() { return this.service.departures(); }
  @Post() @Roles('ADMIN') create(@Body() data: RefundInput, @CurrentUser() actor: any) { return this.service.create(data, actor); }
  @Post('departures/:studentId') @Roles('ADMIN') depart(@Param('studentId') id: string, @Body() data: any, @CurrentUser() actor: any) { return this.service.depart(id, data, actor); }
}

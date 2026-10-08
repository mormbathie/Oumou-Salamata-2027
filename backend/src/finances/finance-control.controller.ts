import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FinanceControlService } from './finance-control.service';
@Controller('finance-control')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceControlController {
  constructor(private readonly service: FinanceControlService) {}
  @Post('payments/:id/cancel') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  cancelPayment(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: any) { return this.service.cancelPayment(id, body.reason, user); }
  @Post('invoices/:id/cancel') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  cancelInvoice(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: any) { return this.service.cancelInvoice(id, body.reason, user); }
  @Get('invoices/:id/installments') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  installments(@Param('id') id: string) { return this.service.installments(id); }
  @Post('invoices/:id/installments') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  saveInstallments(@Param('id') id: string, @Body() body: { installments: { dueDate: string; amount: number }[] }, @CurrentUser() user: any) { return this.service.saveInstallments(id, body.installments, user); }
  @Get('invoices/:id/reminder') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  reminderPreview(@Param('id') id: string) { return this.service.reminderPreview(id); }
  @Get('invoices/:id/reminders') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  reminders(@Param('id') id: string) { return this.service.reminderHistory(id); }
  @Post('invoices/:id/reminder') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  sendReminder(@Param('id') id: string, @Body() body: { approved: boolean; approvalToken: string }, @CurrentUser() user: any) { return this.service.sendReminder(id, body.approved, user, body.approvalToken); }
  @Get('invoices/cancelled') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  cancelledInvoices() { return this.service.cancelledInvoices(); }
  @Get('cash') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  preview(@Query('day') day: string) { return this.service.preview(day); }
  @Get('cash/history') @Roles('ADMIN','DIRECTEUR','COMPTABLE')
  history() { return this.service.history(); }
  @Post('cash/close') @Roles('ADMIN','DIRECTEUR')
  close(@Body() body: { day: string; countedCash: number; notes?: string }, @CurrentUser() user: any) { return this.service.close(body, user); }
}

import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RegistrationReportService } from './registration-report.service';
import { SchoolMailService } from './school-mail.service';
import { AuthModule } from '../auth/auth.module';
import { FinanceControlController } from './finance-control.controller';
import { FinanceControlService } from './finance-control.service';
import { Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';

@Module({
  imports: [AuthModule],
  controllers: [SuppliesController, RefundsController, FinancesController, FinanceControlController],
  providers: [SuppliesService, RefundsService, RegistrationReportService, FinancesService, FinanceControlService, SchoolMailService],
  exports: [FinancesService],
})
export class FinancesModule {}

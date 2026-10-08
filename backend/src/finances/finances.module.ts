import { SchoolMailService } from './school-mail.service';
import { AuthModule } from '../auth/auth.module';
import { FinanceControlController } from './finance-control.controller';
import { FinanceControlService } from './finance-control.service';
import { Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';

@Module({
  imports: [AuthModule],
  controllers: [FinancesController, FinanceControlController],
  providers: [FinancesService, FinanceControlService, SchoolMailService],
  exports: [FinancesService],
})
export class FinancesModule {}

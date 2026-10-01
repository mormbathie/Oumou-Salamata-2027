import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tableau de Bord / Statistiques')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Indicateurs clés du tableau de bord (élèves, finances, présences, alertes)' })
  async getSummary() {
    return this.dashboardService.getSummary();
  }
}

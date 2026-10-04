import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FinancesService } from './finances.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvoiceType, PaymentMethod } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Finances & Facturation')
@Controller('finances')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  @Get('stats')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Statistiques financières globales (recouvrement, total encaissé)' })
  @ApiQuery({ name: 'academicYearId', required: false })
  async getStats(@Query('academicYearId') academicYearId?: string) {
    return this.financesService.getFinancialStats(academicYearId);
  }

  @Get('invoices')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Liste des factures avec filtres' })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'classroomId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  async getInvoices(
    @Query('studentId') studentId?: string,
    @Query('classroomId') classroomId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.financesService.getInvoices({
      studentId,
      classroomId,
      status,
      type,
      academicYearId,
    });
  }

  @Get('invoices/:id')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Détails d\'une facture avec historique des paiements et reçu' })
  async getInvoice(@Param('id') id: string) {
    return this.financesService.getInvoice(id);
  }

  @Post('invoices')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Créer une facture pour un élève' })
  async createInvoice(
    @Body()
    body: {
      studentId: string;
      academicYearId?: string;
      title: string;
      type: InvoiceType;
      amount: number;
      dueDate: string;
    },
    @CurrentUser() actor: any,
  ) {
    return this.financesService.createInvoice(body, actor);
  }

  @Post('invoices/generate-batch')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Générer automatiquement les mensualités pour toute une classe' })
  async generateBatch(
    @Body()
    body: {
      classroomId: string;
      monthName: string;
      dueDate: string;
      academicYearId?: string;
    },
    @CurrentUser() actor: any,
  ) {
    return this.financesService.generateTuitionInvoicesForClass(body, actor);
  }

  @Post('payments')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Enregistrer un paiement / versement pour une facture (génère un reçu)' })
  async recordPayment(
    @Body()
    body: {
      invoiceId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      reference?: string;
      notes?: string;
      paymentDate?: string;
    },
    @CurrentUser() actor: any,
  ) {
    return this.financesService.recordPayment(body, actor);
  }
}

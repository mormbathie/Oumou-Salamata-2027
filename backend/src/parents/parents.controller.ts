import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Parents & Tuteurs')
@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get()
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Liste de tous les parents avec leurs enfants' })
  @ApiQuery({ name: 'search', required: false, description: 'Recherche par nom, prénom ou téléphone' })
  async findAll(@Query('search') search?: string) {
    return this.parentsService.findAll(search);
  }

  @Get(':id')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Détails d\'un parent avec dossier des enfants' })
  async findOne(@Param('id') id: string) {
    return this.parentsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Créer un nouveau parent / tuteur' })
  async create(@Body() body: any) {
    return this.parentsService.create(body);
  }

  @Put(':id')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE')
  @ApiOperation({ summary: 'Modifier les informations d\'un parent' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.parentsService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DIRECTEUR')
  @ApiOperation({ summary: 'Supprimer un parent (administrateur ou directeur)' })
  async remove(@Param('id') id: string) {
    return this.parentsService.remove(id);
  }
}

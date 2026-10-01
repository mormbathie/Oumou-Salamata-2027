import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Classes & Matières')
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Liste des classes avec effectifs' })
  async findAll(@CurrentUser() user: any) {
    return this.classesService.findAll(user);
  }

  @Get('academic-years')
  @Roles('ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Liste des années académiques' })
  async getAcademicYears() {
    return this.classesService.getAcademicYears();
  }

  @Get('subjects')
  @Roles('ADMIN', 'DIRECTEUR', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Liste des matières enseignées' })
  async getSubjects() {
    return this.classesService.getSubjects();
  }

  @Post('subjects')
  @Roles('ADMIN', 'DIRECTEUR')
  @ApiOperation({ summary: 'Ajouter une matière' })
  async createSubject(@Body() body: { name: string; code: string; coefficient?: number; level?: string }) {
    return this.classesService.createSubject(body);
  }

  @Get('teachers')
  @Roles('ADMIN', 'DIRECTEUR')
  async getTeachers() {
    return this.classesService.getTeachers();
  }

  @Get(':id')
  @Roles('ADMIN', 'DIRECTEUR', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Détails d\'une classe avec élèves inscrits' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.classesService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN', 'DIRECTEUR')
  @ApiOperation({ summary: 'Créer une nouvelle classe' })
  async create(@Body() body: any) {
    return this.classesService.create(body);
  }

  @Put(':id')
  @Roles('ADMIN', 'DIRECTEUR')
  @ApiOperation({ summary: 'Modifier une classe' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.classesService.update(id, body);
  }
}

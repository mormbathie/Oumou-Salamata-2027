import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

@ApiTags('Gestion des utilisateurs Keycloak')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Patch(':id/status')
  setEnabled(
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
    @CurrentUser() actor: any,
  ) {
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('Le champ enabled doit être un booléen.');
    }
    return this.usersService.setEnabled(id, body.enabled, actor.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.usersService.remove(id, actor.userId);
  }
}

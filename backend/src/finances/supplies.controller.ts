import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuppliesService } from './supplies.service';
@Controller('finances/supplies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliesController {
  constructor(private readonly service: SuppliesService) {}
  @Get('articles') @Roles('ADMIN','DIRECTEUR','COMPTABLE') articles() { return this.service.articles(); }
  @Post('articles') @Roles('ADMIN','DIRECTEUR') create(@Body() data:any,@CurrentUser() actor:any) { return this.service.saveArticle(data,actor); }
  @Patch('articles/:id') @Roles('ADMIN','DIRECTEUR') update(@Param('id') id:string,@Body() data:any,@CurrentUser() actor:any) { return this.service.saveArticle(data,actor,id); }
  @Post('invoices') @Roles('ADMIN','DIRECTEUR','COMPTABLE') sell(@Body() data:any,@CurrentUser() actor:any) { return this.service.sell(data,actor); }
  @Get('overview') @Roles('ADMIN','DIRECTEUR','COMPTABLE') overview() { return this.service.overview(); }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AcademicTransitionService } from './academic-transition.service';
@Controller('academic-transition') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN','DIRECTEUR')
export class AcademicTransitionController {
  constructor(private readonly service: AcademicTransitionService) {}
  @Post() prepare(@Body() body: { name: string; startDate: string; endDate: string }, @CurrentUser() user: any) { return this.service.prepare(body, user); }
  @Get(':yearId') preview(@Param('yearId') id: string) { return this.service.preview(id); }
  @Post(':yearId/enroll') enroll(@Param('yearId') id: string, @Body() body: { enrollments: { studentId: string; classroomId: string }[] }, @CurrentUser() user: any) { return this.service.enroll(id, body.enrollments, user); }
  @Post(':yearId/activate') activate(@Param('yearId') id: string, @CurrentUser() user: any) { return this.service.activate(id, user); }
}

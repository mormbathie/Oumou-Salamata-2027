import { AcademicTransitionService } from './academic-transition.service';
import { AcademicTransitionController } from './academic-transition.controller';
import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ClassesController, AcademicTransitionController],
  providers: [ClassesService, AcademicTransitionService],
  exports: [ClassesService],
})
export class ClassesModule {}

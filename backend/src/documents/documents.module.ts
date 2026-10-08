import { ParentDocumentController } from './parent-document.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DocumentsController, ParentDocumentController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

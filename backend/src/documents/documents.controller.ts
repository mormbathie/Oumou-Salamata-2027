import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Readable } from 'node:stream';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsService } from './documents.service';

@ApiTags('Dossiers et pièces justificatives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DIRECTEUR')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('students/:studentId/documents')
  listStudent(@Param('studentId') studentId: string) {
    return this.documents.listStudent(studentId);
  }

  @Post('students/:studentId/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadStudent(
    @Param('studentId') studentId: string,
    @Query('category') category: string,
    @UploadedFile() file: any,
  ) {
    return this.documents.uploadStudent(studentId, category, file);
  }

  @Get('students/:studentId/documents/:documentId/file')
  async downloadStudent(@Param('studentId') studentId: string, @Param('documentId') documentId: string) {
    return this.asDownload(await this.documents.studentFile(studentId, documentId));
  }

  @Delete('students/:studentId/documents/:documentId')
  deleteStudent(@Param('studentId') studentId: string, @Param('documentId') documentId: string) {
    return this.documents.deleteStudent(studentId, documentId);
  }

  @Get('parents/:parentId/documents')
  listParent(@Param('parentId') parentId: string) {
    return this.documents.listParent(parentId);
  }

  @Post('parents/:parentId/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadParent(
    @Param('parentId') parentId: string,
    @Query('category') category: string,
    @UploadedFile() file: any,
  ) {
    return this.documents.uploadParent(parentId, category, file);
  }

  @Get('parents/:parentId/documents/:documentId/file')
  async downloadParent(@Param('parentId') parentId: string, @Param('documentId') documentId: string) {
    return this.asDownload(await this.documents.parentFile(parentId, documentId));
  }

  @Delete('parents/:parentId/documents/:documentId')
  deleteParent(@Param('parentId') parentId: string, @Param('documentId') documentId: string) {
    return this.documents.deleteParent(parentId, documentId);
  }

  private asDownload(document: any) {
    if (!document.buffer) throw new BadRequestException('Fichier vide.');
    const fileName = encodeURIComponent(document.originalName || 'document');
    return new StreamableFile(Readable.from([document.buffer]), {
      type: document.mimeType,
      disposition: `attachment; filename*=UTF-8''${fileName}`,
    });
  }
}

import { Body, Controller, Delete, Get, Header, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountProfileService } from './account-profile.service';

@Controller('users/me/dossier')
@UseGuards(JwtAuthGuard)
export class AccountProfileController {
  constructor(private readonly profiles: AccountProfileService) {}
  @Get() @Header('Cache-Control', 'no-store')
  get(@CurrentUser() actor: any) { return this.profiles.get(actor.userId); }
  @Patch()
  update(@CurrentUser() actor: any, @Body() body: unknown) { return this.profiles.update(actor.userId, body); }
  @Post('photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() actor: any, @UploadedFile() file: any) { return this.profiles.upload(actor.userId, file); }
  @Get('photo') @Header('Cache-Control', 'private, no-store') @Header('X-Content-Type-Options', 'nosniff')
  photo(@CurrentUser() actor: any) { return this.profiles.photo(actor.userId); }
  @Delete('photo')
  remove(@CurrentUser() actor: any) { return this.profiles.removePhoto(actor.userId); }
}

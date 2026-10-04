import { AccountSecurityService } from './account-security.service';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [AccountSecurityService, AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AccountSecurityService, AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}

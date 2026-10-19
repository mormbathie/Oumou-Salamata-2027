jest.mock('../auth/guards/jwt-auth.guard',()=>({JwtAuthGuard:class {}}));
import { Reflector } from '@nestjs/core';
import { StaffAttendanceController } from './staff-attendance.controller';
import { FinancesController } from '../finances/finances.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
describe('Report and door access',()=>{
 const r=new Reflector();
 it('limits financial report to accounting and management',()=>expect(r.get(ROLES_KEY,FinancesController.prototype.registrationReport)).toEqual(['ADMIN','DIRECTEUR','COMPTABLE']));
 it('limits self punch to teacher accounts',()=>expect(r.get(ROLES_KEY,StaffAttendanceController.prototype.doorPunch)).toEqual(['ENSEIGNANT']));
 it('limits QR configuration and display to management',()=>{for(const method of ['doorSettings','doorConfigure'] as const)expect(r.get(ROLES_KEY,StaffAttendanceController.prototype[method])).toEqual(['ADMIN','DIRECTEUR']);});
});

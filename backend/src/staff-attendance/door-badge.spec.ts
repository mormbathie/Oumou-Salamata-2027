import { validateDoorLocation, DoorBadgeService } from './door-badge.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
const config={latitude:14.7,longitude:-17.4,radiusMeters:100};
describe('Door badge proximity',()=>{
  it('accepts a precise position at the door',()=>expect(()=>validateDoorLocation({...config,accuracy:10},config)).not.toThrow());
  it('rejects a remote position',()=>expect(()=>validateDoorLocation({latitude:14.8,longitude:-17.4,accuracy:10},config)).toThrow(ForbiddenException));
  it('rejects an imprecise position',()=>expect(()=>validateDoorLocation({...config,accuracy:80},config)).toThrow(BadRequestException));
  it('keeps the accuracy circle inside the authorized perimeter',()=>expect(()=>validateDoorLocation({latitude:14.7008,longitude:-17.4,accuracy:30},config)).toThrow(ForbiddenException));
  it.each([NaN,Infinity,91])('rejects invalid latitude %s',latitude=>expect(()=>validateDoorLocation({latitude,longitude:-17.4,accuracy:10},config)).toThrow());
  it('rejects non-teacher roles before accessing the database',async()=>{const prisma:any={$transaction:jest.fn()};await expect(new DoorBadgeService(prisma,{} as any).punch({code:'ASDOOR1:'+'a'.repeat(48),action:'arrival',...config,accuracy:10},{userId:'qa',username:'QA',roles:['COMPTABLE']})).rejects.toBeInstanceOf(ForbiddenException);expect(prisma.$transaction).not.toHaveBeenCalled();});
});

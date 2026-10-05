import { schoolFees, schoolOptions, validateProgramAge } from './school-options';
describe('School registration options', () => {
  it('accepts the three transport zones and preserves unchecked options', () => {
    for (const transportZone of [1, 2, 3, null]) expect(schoolOptions({transportZone, karate:false})).toEqual({transportZone, karate:false});
  });
  it('rejects malformed options and unknown document codes', () => {
    for (const data of [{transportZone:4},{karate:'true'},{schoolItemsProvided:'UNKNOWN'},{healthNotes:'x'.repeat(2001)}]) expect(()=>schoolOptions(data)).toThrow();
  });
  it('allows clearing private registration information', () => {
    expect(schoolOptions({healthNotes:' ',emergencyContactPhone:null})).toEqual({healthNotes:null,emergencyContactPhone:null});
  });
  it('permits children below the recommended minimum and rejects future dates', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-05T12:00:00Z'));
    for (const program of ['DAARA_DAY','DAARA_BOARDING','FRANCO_ARAB_BOARDING']) {
      expect(()=>validateProgramAge(program,'2020-10-05')).not.toThrow();
      expect(()=>validateProgramAge(program,'2024-10-06')).not.toThrow();
    }
    expect(()=>validateProgramAge('PRESCHOOL','2024-10-05')).not.toThrow();
    expect(()=>validateProgramAge('PRESCHOOL','2027-01-01')).toThrow();
    jest.useRealTimers();
  });
  it('applies individual full-day fees without changing the classroom or ordinary fees', () => {
    const classroom = {level:'MS',program:'PRESCHOOL',registrationFee:50000,monthlyTuition:15000};
    expect(schoolFees({fullDay:true},classroom)).toEqual({registrationFee:65000,monthlyTuition:35000});
    expect(schoolFees({fullDay:false},classroom)).toEqual({registrationFee:50000,monthlyTuition:15000});
    expect(classroom.registrationFee).toBe(50000);
    expect(schoolFees({fullDay:true},{...classroom,level:'CI',program:'ELEMENTARY'})).toEqual({registrationFee:50000,monthlyTuition:15000});
    expect(()=>schoolOptions({fullDay:'true'})).toThrow();
  });
});

import { schoolOptions, validateProgramAge } from './school-options';
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
  it('enforces six years for boarding and Daara without restricting preschool', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-05T12:00:00Z'));
    for (const program of ['DAARA_DAY','DAARA_BOARDING','FRANCO_ARAB_BOARDING']) {
      expect(()=>validateProgramAge(program,'2020-10-05')).not.toThrow();
      expect(()=>validateProgramAge(program,'2020-10-06')).toThrow();
    }
    expect(()=>validateProgramAge('PRESCHOOL','2024-10-05')).not.toThrow();
    expect(()=>validateProgramAge('PRESCHOOL','2027-01-01')).toThrow();
    jest.useRealTimers();
  });
});

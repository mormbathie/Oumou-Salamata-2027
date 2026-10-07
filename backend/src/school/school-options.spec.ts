import { schoolFees, schoolOptions, validateProgramAge, validateOptionsForClass } from './school-options';
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
    expect(schoolFees({fullDay:true},{...classroom,level:'CI',program:'ELEMENTARY'})).toEqual({registrationFee:75000,monthlyTuition:35000});
    expect(()=>schoolOptions({fullDay:'true'})).toThrow();
  });
});

describe('Dynamic registration tariffs', () => {
  const preschool={level:'MS',program:'PRESCHOOL',registrationFee:50000,monthlyTuition:15000};
  const elementary={level:'CI',program:'ELEMENTARY',registrationFee:40500,monthlyTuition:15000};
  it.each([
    [{},preschool,50000],
    [{transportZone:1},preschool,60000],
    [{transportZone:2,fullDay:true},preschool,80000],
    [{karate:true},preschool,52000],
    [{supplies:true},elementary,77500],
    [{transportZone:3,karate:true,supplies:true},elementary,99500],
    [{transportZone:1,karate:true,fullDay:true},preschool,77000],
    [{karate:true,kimono:true},preschool,52000],
  ])('prices %j without charging kimono in registration',(options,classroom,expected)=>{
    expect(schoolFees(options as any,classroom as any).registrationFee).toBe(expected);
  });
});

describe('Legacy option billing snapshots',()=>{
  const c={level:'CI',program:'ELEMENTARY',registrationFee:40000,monthlyTuition:15000};
  it('never deducts legacy karate or transport flags that were not billed',()=>{
    const {registrationAdjustment}=require('./school-options');
    expect(registrationAdjustment({karate:true,transportZone:2},{karate:false,transportZone:null},c,c,{amount:100000}).delta).toBe(0);
  });
  it('does not start billing unchanged legacy transport when supplies are added',()=>{
    const {registrationAdjustment}=require('./school-options');
    const result=registrationAdjustment({transportZone:3},{transportZone:3,supplies:true},c,c,{amount:100000});
    expect(result.delta).toBe(37500);expect(JSON.parse(result.registrationOptions).transportZone).toBeNull();
  });
});

 describe('elementary full-day option', () => {
  for (const level of ['CI','CP','CE1']) it(`adds 25000 for ${level} and sets monthly tuition to 35000`, () => {
   const classroom={level,program:'ELEMENTARY',registrationFee:40000,monthlyTuition:15000};
   expect(()=>validateOptionsForClass({fullDay:true},classroom)).not.toThrow();
   expect(schoolFees({fullDay:true},classroom)).toEqual({registrationFee:65000,monthlyTuition:35000});
   expect(schoolFees({fullDay:false},classroom)).toEqual({registrationFee:40000,monthlyTuition:15000});
  });
 });
it('preserves other options with elementary full-day and rejects CE2', () => {
  const classroom = {level:'CP',program:'ELEMENTARY',registrationFee:40000,monthlyTuition:15000};
  expect(schoolFees({fullDay:true,supplies:true,karate:true,transportZone:1},classroom)).toEqual({registrationFee:114500,monthlyTuition:35000});
  expect(()=>validateOptionsForClass({fullDay:true},{...classroom,level:'CE2'})).toThrow();
});

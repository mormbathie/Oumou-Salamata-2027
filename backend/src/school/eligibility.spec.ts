import {validateOptionsForClass} from './school-options';
describe('School option eligibility',()=>{
  it.each(['TPS','PS'])('rejects karate for %s',level=>expect(()=>validateOptionsForClass({karate:true},{level,registrationFee:50000,monthlyTuition:15000})).toThrow('interdit'));
  it('rejects supplies outside elementary',()=>expect(()=>validateOptionsForClass({supplies:true},{level:'MS',registrationFee:50000,monthlyTuition:15000})).toThrow('élémentaire'));
  it('keeps karate independent from kimono',()=>expect(()=>validateOptionsForClass({karate:true},{level:'MS',registrationFee:50000,monthlyTuition:15000})).not.toThrow());
});

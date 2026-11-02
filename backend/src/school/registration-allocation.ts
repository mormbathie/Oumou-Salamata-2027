// Reporting only. These validated packages never reprice an invoice or a payment.
import { optionTariffs } from './school-options';
export type Cycle = 'PRESCHOOL' | 'ELEMENTARY' | 'OTHER';
export type PackageLine = { code: string; amount: number };
export const rubricLabels: Record<string,string> = {
 REGISTRATION:'Inscription', INCLUDED_TUITION:'Mensualité incluse dans le forfait', SUPPLIES:'Fournitures incluses au forfait maternelle', BOOK:'Livre', PRESCHOOL_UNIFORM:'Blouse et blouson', UNIFORM:'Tenue', INFIRMARY:'Infirmerie', APE:'APE', BADGE:'Badge', SOCIAL:'Social', TISSUES:'Mouchoirs', PAPER:'Rame de papier', KARATE:'Karaté inclus dans la facture d’inscription', TRANSPORT:'Transport inclus dans la facture d’inscription', LEGACY_SUPPLIES:'Fournitures élémentaires incluses dans un ancien forfait', UNALLOCATED:'À vérifier — montant non ventilé',
};
export const registrationPackages: Record<'PRESCHOOL'|'ELEMENTARY',PackageLine[]> = {
 PRESCHOOL:[['REGISTRATION',7000],['INCLUDED_TUITION',15000],['SUPPLIES',10000],['PRESCHOOL_UNIFORM',14000],['INFIRMARY',1000],['APE',1000],['BADGE',500],['SOCIAL',500],['TISSUES',1000]].map(([code,amount])=>({code:String(code),amount:Number(amount)})),
 ELEMENTARY:[['REGISTRATION',7000],['INCLUDED_TUITION',15000],['BOOK',2500],['UNIFORM',10000],['INFIRMARY',1000],['APE',1000],['BADGE',1000],['SOCIAL',500],['PAPER',2000]].map(([code,amount])=>({code:String(code),amount:Number(amount)})),
};
export function registrationCycle(c:any): Cycle {
 if (!c || ['DAARA_DAY','DAARA_BOARDING','FRANCO_ARAB_BOARDING'].includes(c.program)) return 'OTHER';
 // School billing already treats TPS/PS/MS/GS as preschool, even if an old program label is wrong.
 if (['TPS','PS','MS','GS'].includes(c.level) || c.program==='PRESCHOOL') return 'PRESCHOOL';
 if (['CI','CP','CE1','CE2','CM1','CM2'].includes(c.level) || c.program==='ELEMENTARY') return 'ELEMENTARY';
 return 'OTHER';
}
export const allocationReasons: Record<string,string> = {
 CLASS_UNKNOWN:'Classe ou cycle non renseigné pour cette année.', OTHER_PROGRAM:'Le détail de ce programme n’est pas défini par les barèmes validés.', LEVEL_UNVERIFIED:'Barème non validé pour ce niveau : aucune application automatique du barème CI/CP/CE1.', CUSTOM_CLASS:'Tarif particulier de classe : composition non documentée.', FULL_DAY:'Le détail du forfait journée continue n’est pas documenté ; la mensualité ordinaire n’est pas supposée incluse.', BAD_SNAPSHOT:'Options facturées absentes ou illisibles : répartition non fiable.', LEGACY_REVIEW:'Ancien forfait signalé pour vérification des fournitures.', CUSTOM_AMOUNT:'Montant différent du forfait reconstitué : remise, exclusion ou tarif particulier non détaillé.', MULTIPLE_INVOICES:'Plusieurs factures d’inscription pour cet élève et cette année : composition à vérifier.', PAYMENTS_MISMATCH:'Le total des paiements actifs ne correspond pas au montant encaissé enregistré sur la facture.', INVALID_MONEY:'Montants non entiers ou incohérents : vérification nécessaire.', BALANCE_MISMATCH:'Le solde de la facture ne correspond pas aux paiements actifs.', NO_INVOICE:'Aucune facture d’inscription active : aucun encaissement n’est ventilé.',
};
export function packageFor(invoice:any, classroom:any, student:any): {lines:PackageLine[];reason?:string} {
 const cycle=registrationCycle(classroom);
 if(!classroom)return {lines:[],reason:'CLASS_UNKNOWN'};
 if(cycle==='OTHER')return {lines:[],reason:'OTHER_PROGRAM'};
 if(cycle==='ELEMENTARY'&&!['CI','CP','CE1'].includes(classroom.level))return {lines:[],reason:'LEVEL_UNVERIFIED'};
 let options:any;
 if(invoice.registrationOptions){
  try {options=JSON.parse(invoice.registrationOptions);}catch{return {lines:[],reason:'BAD_SNAPSHOT'};}
  if(!options||typeof options!=='object'||Array.isArray(options)||['fullDay','karate','supplies'].some(k=>options[k]!==undefined&&typeof options[k]!=='boolean')||options.transportZone!=null&&![1,2,3].includes(options.transportZone))return {lines:[],reason:'BAD_SNAPSHOT'};
 }else{
  // Only an exact ordinary package with no contrary current option can be recognized without a snapshot.
  if(student.fullDay||student.karate||student.supplies||student.transportZone)return {lines:[],reason:'BAD_SNAPSHOT'};
  options={};
 }
 if(options.karate&&['TPS','PS'].includes(classroom.level))return {lines:[],reason:'BAD_SNAPSHOT'};
 if(options.suppliesLegacyReview)return {lines:[],reason:'LEGACY_REVIEW'};
 if(options.fullDay||classroom.program==='FULL_DAY')return {lines:[],reason:'FULL_DAY'};
 const lines=registrationPackages[cycle].map(l=>({...l}));
 const base=lines.reduce((s,l)=>s+l.amount,0);
 if(classroom.registrationFee!==base && !(classroom.level==='CI'&&classroom.registrationFee===40500))return {lines:[],reason:'CUSTOM_CLASS'};
 if(options.karate)lines.push({code:'KARATE',amount:optionTariffs.karateRegistration});
 if(options.transportZone)lines.push({code:'TRANSPORT',amount:optionTariffs.transport[options.transportZone]});
 // The old 37,500 surcharge was bundled only before separate supplies billing. Separate sales never enter this calculation.
 if(options.supplies&&options.suppliesSeparate!==true){
  if(cycle!=='ELEMENTARY')return {lines:[],reason:'BAD_SNAPSHOT'};
  lines.push({code:'LEGACY_SUPPLIES',amount:37500});
 }
 if(invoice.amount!==lines.reduce((s,l)=>s+l.amount,0))return {lines:[],reason:'CUSTOM_AMOUNT'};
 return {lines};
}
// Largest remainder, exact integer arithmetic. Ties follow the fixed rubric order.
export function prorata(amount:number, weights:number[]):number[] {
 if(!Number.isSafeInteger(amount)||amount<0||weights.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Integer FCFA amounts required');
 const total=weights.reduce((s,n)=>s+BigInt(n),0n);
 if(total===0n){if(amount)throw new Error('No positive basis');return weights.map(()=>0);}
 if(BigInt(amount)>total)throw new Error('Amount exceeds package');
 const cells=weights.map((n,index)=>{const p=BigInt(amount)*BigInt(n);return {index,value:Number(p/total),remainder:p%total};});
 let left=amount-cells.reduce((s,c)=>s+c.value,0);
 for(const c of [...cells].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)){if(left--<=0)break;cells[c.index].value++;}
 return cells.map(c=>c.value);
}
export function allocatePackage(lines:PackageLine[], gross:number, refunded:number) {
 const expected=lines.reduce((s,l)=>s+l.amount,0),net=gross-refunded;
 const eligible=Math.min(net,expected),covered=Math.min(gross,expected),debt=expected-covered;
 const paid=prorata(eligible,lines.map(l=>l.amount));
 // Allocate debt within remaining capacities, then derive refunded shares. Every line stays nonnegative and reconciled.
 const remaining=prorata(debt,lines.map((l,i)=>l.amount-paid[i]));
 return {lines:lines.map((l,i)=>({...l,paid:paid[i],balance:remaining[i],refunded:l.amount-paid[i]-remaining[i]})),overpayment:Math.max(net-expected,0),refundOutsidePackage:refunded-(covered-eligible)};
}

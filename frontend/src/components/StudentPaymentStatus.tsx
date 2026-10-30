import { t } from '../i18n';
import { money } from '../config/school';
export function StudentPaymentStatus({invoices=[]}:{invoices?:any[]}) {
 const registration=invoices.filter(i=>i.type==='REGISTRATION'&&!i.cancelledAt);
 const supplies=invoices.filter(i=>i.category==='SUPPLIES'&&!i.cancelledAt);
 const remaining=registration.reduce((s,i)=>s+i.balance,0),supplyBalance=supplies.reduce((s,i)=>s+i.balance,0);
 const legacy=registration.some(i=>{try{const options=JSON.parse(i.registrationOptions||'{}');return !options||typeof options!=='object'||Array.isArray(options)||(options.suppliesSeparate!==true&&(options.suppliesLegacyReview||options.supplies||!i.registrationOptions));}catch{return true;}});
 return <div className="mt-1 space-y-1 text-[11px]">{!!registration.length&&<p className={remaining>0?'text-amber-800':'text-emerald-800'}>{t(legacy?'Ancien forfait inscription':'Inscription')} : {remaining>0?money(remaining)+' '+t('à régler'):t('Payée')}{legacy&&<span className="block text-amber-800">{t('Fournitures incluses éventuelles : à vérifier')}</span>}</p>}{!!supplies.length&&<p className={supplyBalance>0?'text-amber-800':'text-emerald-800'}>{t('Fournitures séparées')} : {supplyBalance>0?money(supplyBalance)+' '+t('à régler'):t('Payées')}</p>}</div>;
}

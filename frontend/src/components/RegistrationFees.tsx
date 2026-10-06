import { useEffect, useState } from 'react';
import { studentsApi } from '../services/api';
import { money } from '../config/school';
import { t } from '../i18n';
import type { SchoolOptionsValue } from './SchoolOptions';
export function RegistrationFees({ value, classroomId, studentId }: { value: SchoolOptionsValue; classroomId?: string; studentId?: string }) {
  const [fees, setFees] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setFees(null); setError('');
    if (!classroomId) return;
    studentsApi.quote({ classroomId, studentId, fullDay: !!value.fullDay, supplies: !!value.supplies, karate: !!value.karate, transportZone: value.transportZone ?? null })
      .then(data => { if (active) setFees(data); })
      .catch(e => { if (active) setError(e.response?.data?.message || t('Unable to calculate fees')); });
    return () => { active = false; };
  }, [classroomId, studentId, value.fullDay, value.supplies, value.karate, value.transportZone]);
  return <div aria-live="polite" className="rounded-lg bg-emerald-50 p-3 text-sm">
    {error ? <p className="text-rose-700">{error}</p> : fees ? <><p className="font-semibold">{t('Initial amount')}: {money(fees.registrationFee)}</p>{fees.projectedAmount!==null && fees.projectedAmount!==undefined && <p>{t('Invoice amount')}: {money(fees.projectedAmount)} · {t('Total paid')}: {money(fees.paidAmount)} · {t('Balance due')}: {money(fees.projectedBalance)}</p>}<p>{t('Monthly tuition')}: {money(fees.monthlyTuition)}</p><p className="mt-1 text-xs">{t('Kimono is billed separately. Recorded payments are retained.')}</p></> : <p>{t('Choose a class to calculate fees')}</p>}
  </div>;
}

export const school = {
  name: 'Groupe scolaire islamique Abou Oubayda As Sakina',
  shortName: 'Abou Oubayda As Sakina',
  address: 'Cité extension Léopold Sédar Senghor, villa 185 — Dakar',
  phones: ['77 363 08 56', '70 339 68 02', '70 464 78 73'],
  email: 'contact@assakina-school.com', website: 'assakina-school.com',
  logo: '/school-logo-print.png', year: '2026/2027',
};
export type SchoolProgram = { id: string; label: string; hours: string; levels: string[]; registrationFee: number; monthlyTuition: number; minimumAge?: number; requiredItems: string[]; fees: [string, number][]; extraSupplies?: number };
const preschoolFees: [string, number][] = [['Inscription', 7000], ['Mensualité', 15000], ['Fournitures', 10000], ['Blouse et blouson', 14000], ['Infirmerie', 1000], ['APE', 1000], ['Badge', 500], ['Social', 500], ['Mouchoirs', 1000]];
const elementaryFees: [string, number][] = [['Inscription', 7000], ['Mensualité', 15000], ['Livre', 2500], ['Tenue', 10000], ['Infirmerie', 1000], ['APE', 1000], ['Badge', 1000], ['Social', 500], ['Rame de papier', 2500]];
export const programs: SchoolProgram[] = [
  { id: 'PRESCHOOL', label: 'Maternelle', hours: '8h–13h', levels: ['TPS','PS','MS','GS'], registrationFee: 50000, monthlyTuition: 15000, requiredItems: ['BIRTH_CERTIFICATE'], fees: preschoolFees },
  { id: 'ELEMENTARY', label: 'Élémentaire', hours: '8h–13h', levels: ['CI','CP','CE1','CE2','CM1','CM2'], registrationFee: 40500, monthlyTuition: 15000, requiredItems: ['BIRTH_CERTIFICATE'], fees: elementaryFees, extraSupplies: 37500 },
  { id: 'FULL_DAY', label: 'Journée continue', hours: '8h–17h', levels: ['TPS','PS','MS','GS','CI','CP','CE1','CE2','CM1','CM2'], registrationFee: 65000, monthlyTuition: 35000, requiredItems: ['BIRTH_CERTIFICATE'], fees: [['Inscription',65000]] },
  { id: 'DAARA_DAY', label: 'Daara externat', hours: '8h–17h', levels: ['DAARA'], registrationFee: 60000, monthlyTuition: 35000, minimumAge: 6, requiredItems: ['BIRTH_CERTIFICATE','IDJI_BOOK','QURAN_JUZZ'], fees: [['Inscription',60000]] },
  { id: 'DAARA_BOARDING', label: 'Daara internat', hours: 'Internat', levels: ['DAARA'], registrationFee: 75000, monthlyTuition: 50000, minimumAge: 6, requiredItems: ['BIRTH_CERTIFICATE','MATTRESS_SHEETS','BOARDING_KIT'], fees: [['Inscription',75000]] },
  { id: 'FRANCO_ARAB_BOARDING', label: 'Internat franco-arabe', hours: 'Internat', levels: ['CI','CP','CE1','CE2','CM1','CM2'], registrationFee: 100000, monthlyTuition: 75000, minimumAge: 6, requiredItems: ['BIRTH_CERTIFICATE','IDJI_BOOK','QURAN_JUZZ','MATTRESS_SHEETS','BOARDING_KIT','SCHOOL_SUPPLIES'], fees: [['Inscription',100000]] },
];
export const itemLabels: Record<string,string> = { BIRTH_CERTIFICATE: 'Extrait de naissance', IDJI_BOOK: 'Livre IDJI', QURAN_JUZZ: 'Coran par Juzz', MATTRESS_SHEETS: 'Matelas et quatre draps', BOARDING_KIT: 'Valise, trousseau et effets de toilette', SCHOOL_SUPPLIES: 'Fournitures scolaires', DIAPERS: 'Deux couches pour les enfants de deux ans' };
export const transportFees: Record<number,number> = { 1: 10000, 2: 15000, 3: 20000 };
export const programFor = (classroom?: {program?:string;level?:string}) => programs.find(p => p.id === classroom?.program) || programs.find(p => p.id === (['TPS','PS','MS','GS'].includes(classroom?.level || '') ? 'PRESCHOOL' : 'ELEMENTARY'))!;
export const money = (n: number) => new Intl.NumberFormat('fr-SN').format(n) + ' F CFA';

export function ageWarning(birth: string | Date, classroom?: {program?:string; level?:string}) {
  const min = programFor(classroom).minimumAge;
  if (!min || !birth) return false;
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - min);
  return new Date(birth) > cutoff;
}
export const effectiveFees = (student: {fullDay?:boolean}, classroom?: {program?:string;level?:string;registrationFee?:number;monthlyTuition?:number}) => {
  const plan = programFor(classroom);
  return student.fullDay && (plan.id==='PRESCHOOL' || ['TPS','PS','MS','GS'].includes(classroom?.level || ''))
    ? {registrationFee:65000,monthlyTuition:35000}
    : {registrationFee:classroom?.registrationFee ?? plan.registrationFee,monthlyTuition:classroom?.monthlyTuition ?? plan.monthlyTuition};
};

export const isPreschool = (classroom?: {program?:string;level?:string}) => classroom?.program==='PRESCHOOL' || ['TPS','PS','MS','GS'].includes(classroom?.level || '');

import { BadRequestException } from '@nestjs/common';
export type CollectionFilter = { mode?: string; start?: string; end?: string };
export function collectionPeriod(filter: CollectionFilter = {}, now = new Date()) {
  const mode = filter.mode || 'today';
  if (!['today', 'date', 'range', 'all'].includes(mode)) throw new BadRequestException('Filtre de dates invalide.');
  if (mode === 'all') return { mode, start: null, end: null, where: {} };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = mode === 'today' ? today : filter.start;
  const end = mode === 'range' ? filter.end : start;
  function parse(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Date obligatoire au format AAAA-MM-JJ.');
    const date = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Date invalide.');
    return date;
  }
  const from = parse(start), to = parse(end);
  if (to < from) throw new BadRequestException('La date de fin doit suivre la date de début.');
  return { mode, start, end, where: { paymentDate: { gte: from, lt: new Date(to.getTime() + 86400000) } } };
}

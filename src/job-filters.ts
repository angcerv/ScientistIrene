export type JobFilters = {
  query: string;
  similar: boolean;
  date: string;
  zone: string;
  mode: string;
  company: string;
  sort: string;
};

type FilterableJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  published: string | null;
  mode: string;
  priority?: number;
  match?: { score: number | null };
};

export const emptyFilters: JobFilters = { query: '', similar: false, date: '', zone: '', mode: '', company: '', sort: '' };
const fold = (text: string) => text.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
const variantGroups = [
  ['ingeniero', 'ingeniera'], ['tecnico', 'tecnica'], ['investigador', 'investigadora'],
  ['desarrollador', 'desarrolladora'], ['programador', 'programadora'], ['consultor', 'consultora'],
  ['cientifico', 'cientifica'], ['diseñador', 'diseñadora'], ['coordinador', 'coordinadora'],
  ['operador', 'operadora'], ['supervisor', 'supervisora'], ['ingenieria'],
  ['óptico', 'óptica'], ['mecánico', 'mecánica'], ['electrónico', 'electrónica'],
  ['biomédico', 'biomédica'], ['eléctrico', 'eléctrica'], ['químico', 'química'],
  ['analista'], ['especialista'], ['sensor'], ['prototipo'], ['dispositivo'], ['ensayo'],
].map(group => group.flatMap(value => {
  const word = fold(value);
  return [word, word + (/[aeiou]$/.test(word) ? 's' : 'es')];
}));
const wordVariants = new Map(variantGroups.flatMap(group => group.map(word => [word, group] as const)));

const day = 86400000;
const publishedAt = (job: FilterableJob) => job.published ? Date.parse(job.published) : NaN;
const newestFirst = (a: FilterableJob, b: FilterableJob) => {
  const first = publishedAt(a);
  const second = publishedAt(b);
  if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
  return Number.isFinite(second) ? second - first : -1;
};

export function filterJobs<T extends FilterableJob>(jobs: T[], filters: JobFilters, now = Date.now()) {
  const terms = fold(filters.query.trim()).split(/\s+/).filter(Boolean);
  const alternatives = filters.similar ? terms.map(term => wordVariants.get(term) || []) : [];
  const limit = Number(filters.date);
  const visible = jobs.filter(job => {
    const published = publishedAt(job);
    if (filters.date === 'unknown' && Number.isFinite(published)) return false;
    if (limit && (!Number.isFinite(published) || published < now - limit * day || published > now)) return false;
    if (filters.mode === 'unknown' ? !!job.mode : filters.mode && job.mode !== filters.mode) return false;
    if (filters.zone === 'priority' && (job.priority ?? 0) < 3) return false;
    if (filters.zone === 'remote' && job.priority !== 2) return false;
    if (filters.zone === 'other' && job.priority !== 1) return false;
    if (filters.company && job.company !== filters.company) return false;
    if (!terms.length) return true;
    const text = fold([job.title, job.company, job.location, job.description].join(' '));
    if (!filters.similar || !alternatives.some(group => group.length)) return terms.every(term => text.includes(term));
    const words = new Set(text.match(/[a-z0-9]+/g) || []);
    return terms.every((term, index) => text.includes(term) || alternatives[index].some(word => words.has(word)));
  });
  if (filters.sort === 'newest') return visible.sort(newestFirst);
  if (filters.sort === 'fit') return visible.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));
  return visible;
}

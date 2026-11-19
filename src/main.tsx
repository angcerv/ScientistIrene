import { StrictMode, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, Bookmark, BriefcaseBusiness, Building2, CalendarDays, Check, ChevronDown, ClipboardCheck, Compass, FileUp, Info,
  LoaderCircle, MapPin, PanelLeftClose, PanelLeftOpen, Plane, Search, SlidersHorizontal, Sparkles, ThumbsDown, Trash2, Undo2, UserRound, Wallet, X,
} from 'lucide-react';
import { emptyFilters, filterJobs, type JobFilters } from './job-filters';
import './style.css';

type Profile = {
  education: string; experience: string; skills: string; interests: string; likes: string; dislikes: string;
  salary: number; salaryMax: number; location: string; mode: string; preferences: string;
};
type Evidence = { label: string; quote: string };
type PositiveEvidence = Evidence & { kind?: 'technical' | 'soft' | 'interest' };
type WorkPattern = { summary: string; time: string[]; items: Evidence[] };
type Application = { date: string; notes: string };
type LearnedFit = { points: number; title: string; company: string; topics: string[]; activities: string[]; count: number };
type SearchFitUpdate = { id: string; score: number | null; learned: LearnedFit | null };
type Job = {
  id: string; title: string; company: string; location: string; salary: string; mode: string; published: string | null;
  description: string; url: string; source: string; status: Status; priority?: number; discardReason?: Evidence; application?: Application;
  match: { level: string; score: number | null; learned?: LearnedFit | null; salaryFit?: string | null; positives: PositiveEvidence[]; work?: WorkPattern; gaps: Evidence[]; concerns: Evidence[]; travel: string };
};
type Status = '' | 'saved' | 'discarded' | 'applied';
const libraryTabs = [
  { id: 'saved', label: 'Guardadas', empty: 'Aún no tienes ofertas guardadas' },
  { id: 'applied', label: 'Candidaturas', empty: 'Aún no has registrado ninguna candidatura' },
  { id: 'uninterested', label: 'No me interesan', empty: 'Aún no has marcado ofertas como no interesantes' },
  { id: 'automatic', label: 'Descartes automáticos', empty: 'Aún no hay descartes automáticos' },
] as const;
type LibraryTab = typeof libraryTabs[number]['id'];

function jobTab(job: Job): LibraryTab {
  if (job.status === 'saved' || job.status === 'applied') return job.status;
  return job.discardReason ? 'automatic' : 'uninterested';
}
type Feed = { name: string; ok: boolean; count: number; warning?: string };
type Results = { jobs: Job[]; careerMatches?: string[]; location?: string; sources: Feed[]; searchedAt: string; automaticCount: number };
type Careers = { roles: { title: string; reason: string }[]; method: string; warning: string };
type Page = 'search' | 'profile' | 'careers' | 'saved';
const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'Europe/Madrid' });
const applicationDate = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid' });
const countFormat = new Intl.NumberFormat('es-ES');
const date = (input: string | null) => input && Number.isFinite(Date.parse(input)) ? dateFormat.format(new Date(input)) : 'Fecha sin publicar';
const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/' + path, options);
  const body = await response.json();
  if (!response.ok && !(path === 'search' && response.status === 503 && Array.isArray(body.sources))) {
    throw new Error(body.error || 'No se pudo completar la operación.');
  }
  return body as T;
}
const put = (data: unknown): RequestInit => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

const nav = [
  { id: 'search', label: 'Explorar ofertas', icon: Search }, { id: 'profile', label: 'Mi perfil', icon: UserRound },
  { id: 'careers', label: 'Profesiones compatibles', icon: Sparkles }, { id: 'saved', label: 'Mi lista', icon: Bookmark },
] as const;

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p className={'notice' + (error ? ' error' : '')} role={error ? 'alert' : 'status'}>{children}</p>;
}

type ToastMessage = { id: number; text: string };
const toastDuration = 5000;

function Toast({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const [closing, setClosing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (closing || hovered || focused) return;
    const timer = window.setTimeout(() => setClosing(true), toastDuration);
    return () => window.clearTimeout(timer);
  }, [closing, hovered, focused]);

  return <div className="notice toast-card" data-closing={closing}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}
    onAnimationEnd={event => {
      if (closing && event.target === event.currentTarget && event.animationName === 'toast-out') onDismiss();
    }}>
    <Info size={19} aria-hidden="true" />
    <p aria-hidden="true">{text}</p>
    <button type="button" className="icon-button" title="Cerrar aviso" aria-label="Cerrar aviso" onClick={() => setClosing(true)}>
      <X size={17} />
    </button>
  </div>;
}

function Empty({ icon, title, children, compact = false, action }: {
  icon: ReactNode; title: string; children?: ReactNode; compact?: boolean; action?: ReactNode;
}) {
  return <section className={'empty' + (compact ? ' empty-compact' : '')}>
    <span className="tile" aria-hidden="true">{icon}</span>
    <div className="empty-copy"><h2>{title}</h2>{children && <p>{children}</p>}</div>
    {action && <div className="empty-action">{action}</div>}
  </section>;
}

function Loading({ title, view = 'cards' }: { title: string; view?: 'cards' | 'jobs' | 'form' }) {
  return <section className={'loading-view loading-' + view} aria-busy="true" aria-label={title}>
    <p className="loading-label" role="status"><LoaderCircle size={18} className="spin" /> {title}</p>
    <div className="loading-grid" aria-hidden="true">
      <div className="loading-stack">{Array.from({ length: view === 'jobs' ? 4 : 2 }, (_, index) =>
        <div className="panel placeholder" key={index}><div /><div /><div /></div>)}</div>
      {view === 'jobs' && <div className="panel placeholder placeholder-detail"><div /><div /><div /><div /><div /><div /></div>}
    </div>
  </section>;
}

function ResultsFilters({ filters, companies, priorityLocation, careerScoped, showFilters, expanded, onToggleFilters, searching, searchDisabled, onChange, onSearch }: {
  filters: JobFilters; companies: string[]; priorityLocation: string; careerScoped: boolean; showFilters: boolean;
  expanded: boolean; onToggleFilters: () => void; searching: boolean; searchDisabled: boolean; onChange: (filters: JobFilters) => void; onSearch: () => void;
}) {
  const set = (field: keyof JobFilters, value: string) => onChange({ ...filters, [field]: value });
  const filterCount = Object.entries(filters).filter(([key, value]) => key !== 'query' && key !== 'similar' && !!value).length;
  const active = !!filters.query || filterCount > 0;
  return <form className="panel results-filters" role="search" aria-label="Ofertas de empleo" onSubmit={event => {
    event.preventDefault();
    if (!searchDisabled) onSearch();
  }}>
    <div className="filter-heading">
      <label className="results-query">
        Buscar ofertas
        <input type="search" placeholder="Puesto, empresa o competencia" value={filters.query} onChange={event => set('query', event.target.value)} />
      </label>
      <button type="submit" className="icon-button primary" disabled={searchDisabled}
        aria-label={searching ? 'Buscando ofertas' : 'Buscar ofertas'} title="Buscar ofertas">
        {searching ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}
      </button>
      {showFilters && <button type="button" className="button secondary filters-trigger" aria-expanded={expanded} aria-controls="search-filters"
        onClick={onToggleFilters}><SlidersHorizontal size={17} /> <span>Filtros</span>{filterCount > 0 && <span className="tag">{filterCount}</span>}</button>}
      {active && <button type="button" className="icon-button" aria-label="Limpiar búsqueda y filtros" title="Limpiar búsqueda y filtros" onClick={() => onChange({ ...emptyFilters, similar: filters.similar })}><X size={18} /></button>}
    </div>
    <label className="search-similar">
      <input type="checkbox" checked={filters.similar} onChange={event => onChange({ ...filters, similar: event.target.checked })} />
      Buscar palabras similares
    </label>
    {showFilters && <div className="filter-expansion" data-expanded={expanded} id="search-filters" inert={!expanded}>
      <div className="filter-grid">
        <label>Fecha<select data-filter-active={!!filters.date} value={filters.date} onChange={event => set('date', event.target.value)}>
          <option value="">Cualquier fecha</option><option value="7">Últimos 7 días</option><option value="14">Últimos 14 días</option>
          <option value="30">Últimos 30 días</option><option value="unknown">Sin fecha publicada</option>
        </select></label>
        {!!priorityLocation && <label>Zona<select data-filter-active={!!filters.zone} value={filters.zone} onChange={event => set('zone', event.target.value)}>
          <option value="">Todas las zonas</option><option value="priority">{priorityLocation}</option><option value="remote">Alternativas remotas</option><option value="other">Otras zonas</option>
        </select></label>}
        <label>Modalidad<select data-filter-active={!!filters.mode} value={filters.mode} onChange={event => set('mode', event.target.value)}>
          <option value="">Todas</option><option>Remoto</option><option>Híbrido</option><option>Presencial</option><option value="unknown">Sin especificar</option>
        </select></label>
        <label>Empresa<select data-filter-active={!!filters.company} value={filters.company} onChange={event => set('company', event.target.value)}>
          <option value="">Todas</option>{companies.map(company => <option key={company}>{company}</option>)}
        </select></label>
        <label>Orden<select data-filter-active={!!filters.sort} value={filters.sort} onChange={event => set('sort', event.target.value)}>
          <option value="">{careerScoped ? 'Afinidad con la profesión' : 'Recomendadas'}</option><option value="fit">Mayor encaje</option><option value="newest">Más recientes</option>
        </select></label>
      </div>
    </div>}
  </form>;
}

const cvFields = { education: 'Formación', experience: 'Experiencia profesional', skills: 'Habilidades e idiomas' } as const;
type CvDraft = Pick<Profile, keyof typeof cvFields>;

function ProfileForm({ profile, onSave, notify }: { profile: Profile; onSave: (p: Profile) => void; notify: (text: string) => void }) {
  const [draft, setDraft] = useState(profile);
  const [text, setText] = useState('');
  const [imported, setImported] = useState<(CvDraft & Partial<Profile>) | null>(null);
  const [wholeProfile, setWholeProfile] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [justSaved]);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setJustSaved(false);
    setDraft(existing => ({ ...existing, [key]: value }));
  };
  const field = (key: Exclude<keyof Profile, 'salary' | 'salaryMax'>, label: string) =>
    <label>{label}<textarea rows={key === 'experience' ? 6 : 3} maxLength={10000} value={draft[key]} onChange={event => set(key, event.target.value)} /></label>;
  async function upload(file?: File) {
    if (!file || busy) return;
    setError(''); setText(''); setImported(null); setWholeProfile(false); setBusy('import');
    try {
      if (/\.json$/i.test(file.name)) {
        if (file.size > 180000) throw new Error('El archivo de perfil supera el tamaño permitido.');
        let parsed: unknown;
        try { parsed = JSON.parse(await file.text()); }
        catch { throw new Error('No se pudo leer el archivo de perfil JSON.'); }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('El archivo no contiene un perfil válido.');
        const data = parsed as Record<string, unknown>;
        const keys = Object.keys(draft) as (keyof Profile)[];
        const imported: Record<string, unknown> = { salaryMax: 0, ...data };
        if (keys.some(key => typeof imported[key] !== typeof draft[key]) || ![data.education, data.experience, data.skills].some(Boolean)) {
          throw new Error('El archivo no tiene el formato de perfil de Brújula Empleo.');
        }
        setImported(Object.fromEntries(keys.map(key => [key, imported[key]])) as Profile);
        setWholeProfile(true);
        return;
      }
      const extracted = await api<{ draft: CvDraft; text: string }>('cv', {
        method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file,
      });
      setText(extracted.text);
      setImported(extracted.draft);
      if (!Object.values(extracted.draft).some(Boolean)) {
        notify('No se identificaron secciones. Puedes copiar los datos desde el texto extraído.');
      }
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(''); }
  }
  const invalidSalary = draft.salaryMax > 0 && draft.salary > draft.salaryMax;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || invalidSalary) return;
    setJustSaved(false); setBusy('save'); setError('');
    try {
      const saved = await api<Profile>('profile', put(draft));
      setDraft(saved); onSave(saved); setJustSaved(true); notify('Perfil guardado en este equipo.');
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(''); }
  }
  return <>
    <header className="heading"><h1>Mi perfil</h1><p>El punto de partida para encontrar trabajo que encaje contigo.</p></header>
    <div className="panel import">
      <span className="tile"><FileUp size={23} /></span>
      <div><h2>Importar CV o perfil</h2><p>PDF con texto seleccionable, hasta 8 MB, o perfil de Brújula en JSON.</p></div>
      <label className="button secondary upload" aria-disabled={!!busy}>
        {busy === 'import' ? <LoaderCircle className="spin" size={18} /> : <FileUp size={18} />} Elegir archivo
        <input type="file" aria-label="Elegir CV o perfil" accept=".pdf,.json,application/pdf,application/json" disabled={!!busy}
          onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
      </label>
    </div>
    {error && <Notice error>{error}</Notice>}
    {imported && Object.values(imported).some(Boolean) && <section className="panel form-section cv-review" aria-labelledby="cv-review-title">
      <h2 id="cv-review-title">Revisar importación</h2>
      {(Object.keys(cvFields) as (keyof CvDraft)[]).map(key => imported[key] &&
        <details className="disclosure" key={key}>
          <summary>{cvFields[key]} <ChevronDown size={18} /></summary>
          <pre>{imported[key]}</pre>
        </details>)}
      {wholeProfile && <p>{imported.location || 'Sin ubicación prioritaria'}{imported.mode ? ' · ' + imported.mode : ''}</p>}
      <Notice>{wholeProfile ? 'Al aplicar el archivo, se reemplazan los datos y las preferencias del borrador.' : 'Al aplicar la importación, se reemplazan en el borrador los campos mostrados arriba.'} Revisa el resultado antes de guardar.</Notice>
      <button type="button" className="button secondary" disabled={!!busy} onClick={() => {
        setDraft(existing => ({ ...existing, ...Object.fromEntries(Object.entries(imported).filter(([, value]) => wholeProfile || value)) }));
        setImported(null);
        setJustSaved(false);
        notify('Importación aplicada al borrador. Revisa los campos y guarda el perfil.');
      }}><Check size={18} /> Aplicar al borrador</button>
    </section>}
    {text && <details className="panel disclosure"><summary>Texto extraído del CV <ChevronDown size={18} /></summary><pre>{text}</pre></details>}
    <form onSubmit={save} className="profile-form">
      <fieldset className="profile-fields" disabled={busy === 'save'} aria-label="Datos y preferencias">
        <section className="panel form-section">
          <h2>Trayectoria</h2>
          {field('education', 'Formación')}
          {field('experience', 'Experiencia profesional')}
          {field('skills', 'Habilidades e idiomas')}
        </section>
        <section className="panel form-section">
          <h2>Preferencias</h2>
          {field('interests', 'Intereses profesionales')}
          <div className="field-grid">{field('likes', 'Tareas que te gustan')}{field('dislikes', 'Tareas que prefieres evitar')}</div>
          <div className="field-grid">
            <label>Ubicación prioritaria<input value={draft.location} maxLength={150} onChange={event => set('location', event.target.value)} /></label>
            <label>Modalidad<select value={draft.mode} onChange={event => set('mode', event.target.value)}>
              <option value="">Cualquiera</option><option>Remoto</option><option>Híbrido</option><option>Presencial</option>
            </select></label>
          </div>
          <fieldset className="salary-range">
            <legend>Salario bruto anual deseado (€)</legend>
            <div className="field-grid">
              <label>Mínimo<input type="number" min="0" max="10000000" step="1" value={draft.salary || ''} aria-invalid={invalidSalary}
                aria-describedby={invalidSalary ? 'salary-range-error' : 'salary-range-help'} onChange={event => set('salary', Number(event.target.value))} /></label>
              <label>Máximo<input type="number" min="0" max="10000000" step="1" value={draft.salaryMax || ''} aria-invalid={invalidSalary}
                aria-describedby={invalidSalary ? 'salary-range-error' : 'salary-range-help'} onChange={event => set('salaryMax', Number(event.target.value))} /></label>
            </div>
            {invalidSalary ? <div id="salary-range-error"><Notice error>El mínimo salarial no puede superar el máximo.</Notice></div>
              : <p id="salary-range-help">Puedes indicar un solo límite. El salario solo se usa para comparar importes.</p>}
          </fieldset>
          {field('preferences', 'Otras preferencias')}
        </section>
      </fieldset>
      {error && <Notice error>{error}</Notice>}
      <footer className="profile-save-bar">
        <div className="profile-save-inner">
          <button type="submit" className={'button primary profile-save' + (justSaved ? ' saved' : '')}
            disabled={!!busy || invalidSalary} aria-busy={busy === 'save'}>
            {busy === 'save' ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
            {busy === 'save' ? 'Guardando…' : justSaved ? 'Perfil guardado' : 'Guardar perfil'}
          </button>
        </div>
      </footer>
    </form>
  </>;
}

function JobCard({ job, selected, onSelect }: { job: Job; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={'job-card' + (selected ? ' selected' : '')} onClick={onSelect} aria-pressed={selected}>
    <span className="company-icon"><Building2 size={20} /></span>
    <span className="job-card-copy">
      <span className="job-title">{job.title}</span>
      <span className="job-card-meta"><span className="job-company">{job.company}</span><small>{job.application ? 'Candidatura · ' + date(job.application.date) : date(job.published)}</small></span>
      <span className="job-location"><MapPin size={14} /> {job.location || 'Ubicación sin publicar'}</span>
      <MatchMeter score={job.match.score} compact />
    </span>
    {job.status === 'saved' && <Bookmark className="job-saved" size={17} aria-label="Guardada" fill="currentColor" />}
  </button>;
}

function EvidenceList({ items }: { items: Evidence[] }) {
  return <ul>{items.map((item, index) => <li key={index}><strong>{item.label}</strong>{item.quote && <blockquote>{item.quote}</blockquote>}</li>)}</ul>;
}

function EvidenceGroup({ title, items, empty, tone }: { title: string; items: Evidence[]; empty: string; tone: string }) {
  return <section className={'evidence ' + tone}><h3>{title}</h3>{items.length ? <EvidenceList items={items} /> : <p>{empty}</p>}</section>;
}

function FitEvidence({ items, hasProfile }: { items: PositiveEvidence[]; hasProfile: boolean }) {
  const technical = items.filter(item => !item.kind || item.kind === 'technical');
  const soft = items.filter(item => item.kind === 'soft');
  const interests = items.filter(item => item.kind === 'interest');
  return <section className="evidence positive">
    <h3>Por qué podrías encajar</h3>
    {hasProfile ? <>
      <h4>Habilidades técnicas</h4>
      {technical.length ? <EvidenceList items={technical} /> : <p>Sin coincidencias técnicas identificadas.</p>}
      <h4>Habilidades blandas</h4>
      {soft.length ? <EvidenceList items={soft} /> : <p>Sin coincidencias en habilidades blandas.</p>}
      {!!interests.length && <><h4>Intereses y preferencias</h4><EvidenceList items={interests} /></>}
    </> : <p>Completa tu perfil para comparar esta oferta con tu trayectoria.</p>}
  </section>;
}

function WorkEvidence({ work }: { work: WorkPattern }) {
  return <section className="evidence work-evidence">
    <h3>El día a día del puesto</h3>
    <p>{work.summary}</p>
    {work.time.length ? <div className="work-time">
      <h4>Dedicación indicada en la oferta</h4>
      {work.time.map(quote => <blockquote key={quote}>{quote}</blockquote>)}
    </div> : <p className="muted">Tiempo por actividad: sin especificar.</p>}
    {!!work.items.length && <details className="disclosure">
      <summary>Ver actividades y fragmentos <ChevronDown size={18} /></summary>
      <EvidenceList items={work.items} />
    </details>}
  </section>;
}

function MatchMeter({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const labelId = useId();
  if (score == null) return compact ? null : <p className="muted">Encaje sin calcular.</p>;
  const style = { '--match-position': score + '%', '--match-color': `hsl(${score * 1.22} 68% 36%)` } as CSSProperties;
  const value = score + '%';
  return <span className={'match-meter' + (compact ? ' compact' : '')} style={style}>
    <span className="match-meter-label"><span id={labelId}>{compact ? 'Encaje' : 'Encaje estimado'}</span><strong>{value}</strong></span>
    <span className="match-meter-track" role={compact ? undefined : 'meter'} aria-hidden={compact || undefined}
      aria-labelledby={compact ? undefined : labelId} aria-valuemin={compact ? undefined : 0}
      aria-valuemax={compact ? undefined : 100} aria-valuenow={compact ? undefined : score} aria-valuetext={compact ? undefined : value}>
      <span aria-hidden="true" />
    </span>
  </span>;
}

function JobDetail({ job, busy, onDecision, onClose }: {
  job: Job; busy: boolean; onDecision: (status: Status, application?: Application) => Promise<boolean>; onClose: () => void;
}) {
  const [applicationDraft, setApplicationDraft] = useState<Application | null>(null);
  const applied = job.status === 'applied';
  function editApplication() {
    setApplicationDraft(job.application || { date: applicationDate.format(new Date()), notes: '' });
  }

  return <article className="panel detail" id="job-detail" aria-labelledby="detail-title" tabIndex={-1}>
    <header className="detail-top">
      <span className="company-icon"><Building2 size={22} /></span>
      <div><h2 id="detail-title">{job.title}</h2><p className="detail-company">{job.company}{job.company.toLocaleLowerCase('es') !== job.source.toLocaleLowerCase('es') && ' · ' + job.source}</p></div>
      <button type="button" className="icon-button mobile-close" onClick={onClose} aria-label="Cerrar detalle"><X size={20} /></button>
    </header>
    <div className="metadata">
      <span><MapPin size={16} />{job.location || 'Ubicación sin publicar'}</span>
      <span><CalendarDays size={16} />{date(job.published)}</span>
      <span><BriefcaseBusiness size={16} />{job.mode || 'Modalidad sin publicar'}</span>
      <span><Wallet size={16} />{job.salary || 'Salario sin publicar'}</span>
      <span><Plane size={16} />Viajes: {job.match.travel || 'No especificado'}</span>
    </div>
    {job.match.salaryFit && job.salary && <p className="salary-comparison"><Wallet size={16} />{job.match.salaryFit}</p>}
    <MatchMeter score={job.match.score} />
    {job.match.learned && <details className="disclosure evidence learned-fit">
      <summary>+{job.match.learned.points} puntos por candidaturas afines <ChevronDown size={16} /></summary>
      <p>La oferta se parece a <strong>{job.match.learned.title}</strong> de {job.match.learned.company}{job.match.learned.count > 1
        ? ' y a ' + (job.match.learned.count - 1) + (job.match.learned.count === 2 ? ' candidatura más.' : ' candidaturas más.') : '.'}</p>
      <p>{[...job.match.learned.topics, ...job.match.learned.activities].join(' · ')}</p>
    </details>}
    <div className="detail-actions">
      <a className="button primary" href={job.url} target={'__BRUJULA_DESKTOP__' in window ? undefined : '_blank'} rel="noreferrer">Ver oferta original <ArrowUpRight size={17} /></a>
      {!applied && (job.status === 'discarded' ?
        <button className="button secondary" disabled={busy} onClick={() => void onDecision('')}>
          <Undo2 size={18} /> {job.discardReason ? 'Recuperar oferta' : 'Quitar marca de no interés'}
        </button> : <button className={'icon-button' + (job.status === 'saved' ? ' marked' : '')}
          aria-label={job.status === 'saved' ? 'Quitar de guardadas' : 'Guardar oferta'} title={job.status === 'saved' ? 'Quitar de guardadas' : 'Guardar oferta'}
          disabled={busy} onClick={() => void onDecision(job.status === 'saved' ? '' : 'saved')}><Bookmark size={19} fill={job.status === 'saved' ? 'currentColor' : 'none'} /></button>)}
      <button type="button" className="button secondary" disabled={busy || !!applicationDraft} onClick={editApplication}>
        <ClipboardCheck size={18} /> {applied ? 'Editar candidatura' : 'Ya he aplicado'}
      </button>
      {!applied && job.status !== 'discarded' && <button type="button" className="button secondary" disabled={busy}
        onClick={() => void onDecision('discarded')}><ThumbsDown size={18} /> No me interesa</button>}
    </div>
    {applicationDraft ? <form className="panel form-section application-form" aria-labelledby="application-title" onSubmit={async event => {
      event.preventDefault();
      if (!busy && await onDecision('applied', applicationDraft)) setApplicationDraft(null);
    }}>
      <h3 id="application-title">{applied ? 'Editar candidatura' : 'Registrar candidatura'}</h3>
      <label>Fecha de aplicación<input type="date" required value={applicationDraft.date} disabled={busy}
        onChange={event => setApplicationDraft({ ...applicationDraft, date: event.target.value })} /></label>
      <label>Notas (opcional)<textarea rows={3} maxLength={10000} value={applicationDraft.notes} disabled={busy}
        onChange={event => setApplicationDraft({ ...applicationDraft, notes: event.target.value })} /></label>
      <div className="application-actions">
        <button type="submit" className="button primary" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <Check size={18} />} Guardar candidatura</button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => setApplicationDraft(null)}>Cancelar</button>
      </div>
    </form> : job.application && <section className="evidence application-summary">
      <h3>Candidatura</h3>
      <p><CalendarDays size={16} /> Aplicaste el <time dateTime={job.application.date}>{date(job.application.date)}</time></p>
      {job.application.notes && <p className="application-notes">{job.application.notes}</p>}
    </section>}
    {job.discardReason && <EvidenceGroup tone="concern" title="Descarte automático" items={[job.discardReason]} empty="" />}
    {job.match.work && <WorkEvidence work={job.match.work} />}
    <FitEvidence items={job.match.positives} hasProfile={job.match.level !== 'Sin perfil'} />
    <EvidenceGroup tone="gap" title="Requisitos por contrastar" items={job.match.gaps} empty="El análisis no señaló requisitos concretos por revisar." />
    <EvidenceGroup tone="concern" title="Condiciones que conviene revisar" items={job.match.concerns} empty="El análisis no señaló conflictos con tus preferencias." />
    <details className="disclosure description"><summary>Descripción completa <ChevronDown size={18} /></summary><div lang="">{job.description}</div></details>
  </article>;
}

function App() {
  const [page, setPage] = useState<Page>('search');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [library, setLibrary] = useState<Job[]>([]);
  const [career, setCareer] = useState('');
  const [careers, setCareers] = useState<Careers | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [searchSelectedId, setSearchSelectedId] = useState('');
  const [tab, setTab] = useState<LibraryTab>('saved');
  const [mobileDetail, setMobileDetail] = useState(false);
  const [searchMobileDetail, setSearchMobileDetail] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const deferredFilters = useDeferredValue(filters);
  const jobListRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const listPosition = useRef(0);
  const searchPosition = useRef({ list: 0, detail: 0, detailId: '' });
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);

  function notify(text: string) {
    setToast({ id: ++toastId.current, text });
  }

  function refresh() {
    setError('');
    void api<Profile>('profile').then(setProfile).catch(failure => setError(message(failure)));
    void loadLibrary();
  }
  async function loadLibrary() {
    setLibraryLoading(true);
    try { setLibrary(await api<Job[]>('decisions')); }
    catch (failure) { setError(message(failure)); }
    finally { setLibraryLoading(false); }
  }
  useEffect(refresh, []);

  function resetSearchView() {
    searchPosition.current = { list: 0, detail: 0, detailId: '' };
    setSearchSelectedId('');
    setSearchMobileDetail(false);
  }

  function navigate(next: Page) {
    if (next === page) return;
    setPage(next); setSelectedId(''); setMobileDetail(false); setError('');
    if (next === 'saved') void loadLibrary();
  }

  function searchCareer(title: string) {
    navigate('search');
    void search(title);
  }

  async function search(careerTitle = career) {
    setBusy('search'); setError('');
    try {
      const found = await api<Results>('search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ career: careerTitle }),
      });
      const previousSearch = results?.sources.some(source => source.ok);
      if (previousSearch && !found.sources.some(source => source.ok)) {
        setError('No se pudo actualizar la búsqueda. Se muestran los últimos resultados cargados.');
        return;
      }
      resetSearchView();
      setResults({ ...found, location: profile?.location });
      setCareer(careerTitle);
      setFilters(current => careerTitle !== career ? { ...emptyFilters, similar: current.similar } : {
        ...current,
        company: found.jobs.some(job => job.company === current.company) ? current.company : '',
      });
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(''); }
  }
  async function exploreCareers() {
    setBusy('careers'); setError('');
    try { setCareers(await api<Careers>('careers', { method: 'POST' })); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(''); }
  }
  const candidateJobs = useMemo(() => {
    if (!results) return [];
    if (!career) return results.jobs;
    const byId = new Map(results.jobs.map(job => [job.id, job]));
    return (results.careerMatches || []).flatMap(id => {
      const job = byId.get(id);
      return job ? [job] : [];
    });
  }, [results, career]);
  const searchJobs = useMemo(() => filterJobs(candidateJobs, deferredFilters), [candidateJobs, deferredFilters]);
  const companies = useMemo(() => [...new Set(candidateJobs.map(job => job.company))].sort((a, b) => a.localeCompare(b, 'es')), [candidateJobs]);
  const libraryJobs = page === 'saved' ? library.filter(job => jobTab(job) === tab) : [];
  if (tab === 'applied') libraryJobs.sort((a, b) => (b.application?.date || '').localeCompare(a.application?.date || ''));
  const visible = page === 'saved' ? libraryJobs : searchJobs;
  const activeId = page === 'search' ? searchSelectedId : selectedId;
  const selected = visible.find(job => job.id === activeId) || visible[0];
  const loadingJobs = page === 'search' ? busy === 'search' || (!profile && !error) : page === 'saved' && libraryLoading && !library.length;
  const hasJobView = !loadingJobs && !!selected;
  const filtered = Object.entries(deferredFilters).some(([field, value]) => field !== 'sort' && field !== 'similar' && !!value);
  const searchLocation = results?.location ?? profile?.location ?? '';
  const priorityLocation = /^(españa|spain)$/i.test(searchLocation) ? '' : searchLocation;

  useLayoutEffect(() => {
    if (jobListRef.current) jobListRef.current.scrollTop = page === 'search' ? searchPosition.current.list : 0;
  }, [page, tab, career, deferredFilters, results?.searchedAt, hasJobView]);

  useLayoutEffect(() => {
    if (!detailRef.current || !selected) return;
    if (page === 'search') {
      const position = searchPosition.current;
      if (position.detailId !== selected.id) {
        position.detailId = selected.id;
        position.detail = 0;
      }
      detailRef.current.scrollTop = position.detail;
    } else {
      detailRef.current.scrollTop = 0;
    }
  }, [page, selected?.id, hasJobView, searchMobileDetail]);

  function selectJob(id: string) {
    if (page === 'search') {
      searchPosition.current.list = jobListRef.current?.scrollTop || 0;
      setSearchSelectedId(id);
      setSearchMobileDetail(true);
    } else {
      listPosition.current = jobListRef.current?.scrollTop || 0;
      setSelectedId(id);
      setMobileDetail(true);
    }
    requestAnimationFrame(() => {
      const detail = detailRef.current?.querySelector('article');
      if (detail?.querySelector<HTMLButtonElement>('.mobile-close')?.getClientRects().length) detail.focus({ preventScroll: true });
    });
  }

  function closeDetail() {
    if (page === 'search') setSearchMobileDetail(false);
    else setMobileDetail(false);
    requestAnimationFrame(() => {
      const list = jobListRef.current;
      if (!list) return;
      list.scrollTop = page === 'search' ? searchPosition.current.list : listPosition.current;
      list.querySelector<HTMLButtonElement>('.job-card.selected')?.focus({ preventScroll: true });
    });
  }

  async function decide(status: Status, application?: Application) {
    if (!selected) return false;
    setBusy('decision'); setError('');
    try {
      const updated = await api<{ job: Job; inSearch: boolean; automaticCount: number; searchUpdates?: SearchFitUpdate[] }>('decision', put({ id: selected.id, status, application }));
      const byId = new Map((updated.searchUpdates || []).map(({ id, ...match }, index) => [id, { match, index }]));
      const updateFit = (job: Job) => {
        const latest = byId.get(job.id);
        return latest ? { ...job, match: { ...job.match, ...latest.match } } : job;
      };
      setResults(current => {
        if (!current) return current;
        const jobs = status === 'discarded' || status === 'applied' ? current.jobs.filter(job => job.id !== selected.id)
          : current.jobs.some(job => job.id === selected.id) ? current.jobs.map(job => job.id === selected.id ? updated.job : job)
          : updated.inSearch ? [...current.jobs, updated.job] : current.jobs;
        const refreshed = byId.size ? jobs.map(updateFit).sort((a, b) => (byId.get(a.id)?.index ?? Infinity) - (byId.get(b.id)?.index ?? Infinity)) : jobs;
        return { ...current, jobs: refreshed, automaticCount: updated.automaticCount };
      });
      notify(status === 'applied' ? selected.status === 'applied' ? 'Candidatura actualizada.' : 'Candidatura guardada en Mi lista.'
        : status === 'saved' ? 'Oferta guardada en este equipo.' : status === 'discarded' ? 'Oferta marcada como no interesante en este equipo.' : selected.status === 'discarded' ? 'Oferta recuperada. Volverá a aparecer en las búsquedas si sigue disponible.' : 'Oferta retirada de guardadas.');
      if (page === 'search' && (status === 'applied' || status === 'discarded')) setSearchMobileDetail(false);
      else if (selected.status === 'applied') setSelectedId(selected.id);
      else if (page === 'saved') setMobileDetail(false);
      setLibrary(current => {
        const remaining = current.filter(job => job.id !== selected.id).map(updateFit);
        return status ? [updated.job, ...remaining] : remaining;
      });
      return true;
    } catch (failure) { setError(message(failure)); return false; }
    finally { setBusy(''); }
  }
  const allFailed = results && !results.sources.some(feed => feed.ok);
  const listVisible = page === 'search' || page === 'saved';
  return <div className="shell" data-sidebar-collapsed={sidebarCollapsed} data-profile={page === 'profile' && !!profile}>
    <aside className="sidebar">
      <div className="brand" aria-label="Brújula Empleo"><span><Compass size={25} /></span><div className="sidebar-label">Brújula<span>Empleo</span></div></div>
      <nav id="sidebar-navigation" aria-label="Navegación principal">{nav.map(({ id, label, icon: Icon }) =>
        <button key={id} type="button" className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined}
          aria-label={label} title={sidebarCollapsed ? label : undefined} onClick={() => navigate(id)}><Icon size={20} /><span className="sidebar-label">{label}</span></button>)}</nav>
      <div className="sidebar-footer">
        <div className="local sidebar-label"><span /> Espacio personal local</div>
        <button type="button" className="icon-button sidebar-toggle" aria-controls="sidebar-navigation" aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Plegar barra lateral'}
          title={sidebarCollapsed ? 'Expandir barra lateral' : 'Plegar barra lateral'} onClick={() => setSidebarCollapsed(value => !value)}>
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </div>
    </aside>
    <main className={'workspace' + (listVisible ? ' browse-workspace' : '') + (page === 'saved' ? ' library-workspace' : '')} id="main">
      {page === 'saved' && <header className="library-header">
        <h1 className="results-title">Mi lista</h1>
        <div className="segmented library-tabs" aria-label="Estado de ofertas">
          {libraryTabs.map(({ id, label }) => <button type="button" key={id} aria-pressed={tab === id}
            onClick={() => { setTab(id); setSelectedId(''); setMobileDetail(false); }}>{label}</button>)}
        </div>
      </header>}
      {page === 'careers' && <header className="heading"><h1>Profesiones compatibles</h1><p>Explora puestos relacionados con tus competencias e intereses.</p></header>}
      {error && <Notice error>{error} {!profile && <button className="text-button" onClick={refresh}>Reintentar</button>}</Notice>}
      {page === 'profile' && (profile ? <ProfileForm profile={profile} notify={notify} onSave={value => { setProfile(value); setCareers(null); }} /> : !error && <Loading title="Cargando perfil…" view="form" />)}
      {page === 'careers' && <>
        <div className="section-tools"><button className="button primary" disabled={!profile || !!busy || ![profile.education, profile.experience, profile.skills, profile.interests, profile.likes].some(Boolean)} onClick={() => void exploreCareers()}>
          {busy === 'careers' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} {busy === 'careers' ? 'Analizando perfil…' : 'Explorar profesiones'}
        </button><button className="button secondary" onClick={() => navigate('profile')}><UserRound size={18} /> Editar perfil</button></div>
        {careers?.warning && <Notice>{careers.warning}</Notice>}
        {busy === 'careers' ? <Loading title="Analizando tu trayectoria…" /> : careers ? careers.roles.length ? <>
          <p className="muted">{careers.method}</p>
          <div className="role-grid">{careers.roles.map((role, index) => (
            <button type="button" className="panel role role-link" key={index} disabled={!!busy}
              aria-label={'Ver ofertas de ' + role.title} onClick={() => searchCareer(role.title)}>
              <span className="tile"><BriefcaseBusiness size={21} /></span>
              <span className="role-title">{role.title}</span>
              <span className="role-reason">{role.reason}</span>
              <span className="role-action"><Search size={16} /> Ver ofertas</span>
            </button>
          ))}</div>
        </> : <Empty icon={<Sparkles size={26} />} title="Sin propuestas para este perfil">Añade competencias o intereses más concretos para ampliar el análisis.</Empty>
          : <Empty icon={<Sparkles size={26} />} title="Descubre nuevas posibilidades">Completa tu perfil y explora profesiones afines a tu trayectoria.</Empty>}
      </>}
      {listVisible && <>
        {page === 'search' && <ResultsFilters filters={filters} companies={companies} priorityLocation={priorityLocation}
          careerScoped={!!career} showFilters={!!results && !allFailed} searching={busy === 'search'} searchDisabled={!profile || !!busy}
          expanded={filtersExpanded} onToggleFilters={() => setFiltersExpanded(value => !value)}
          onSearch={() => void search()} onChange={next => { resetSearchView(); setFilters(next); }} />}
        {page === 'search' && career && <div className="career-scope">
          <span>Profesión <strong>{career}</strong></span>
          <button type="button" className="icon-button" aria-label="Quitar filtro de profesión" title="Quitar filtro de profesión"
            onClick={() => { resetSearchView(); setCareer(''); }}><X size={17} /></button>
        </div>}
        {page === 'search' && results && <div className="section-tools results-tools">
          <h1 className="results-title" aria-live="polite">{!allFailed && !loadingJobs
            ? countFormat.format(visible.length) + (visible.length === 1 ? ' oferta' : ' ofertas') : 'Resultados'}</h1>
          <div className="results-actions">
            <details className="disclosure feeds results-sources">
              <summary className="button secondary">Fuentes <span className="tag">{results.sources.filter(feed => feed.ok).length}/{results.sources.length}</span><ChevronDown size={16} /></summary>
              <ul className="panel">{results.sources.map(feed => <li key={feed.name}><strong>{feed.name}</strong><span>{feed.ok ? countFormat.format(feed.count) + ' anuncios' : feed.warning}{feed.ok && feed.warning ? ' · ' + feed.warning : ''}</span></li>)}</ul>
            </details>
            {!!results.automaticCount && <button type="button" className="button secondary" onClick={() => {
              setTab('automatic'); navigate('saved');
            }}><Trash2 size={17} /> Descartes ({countFormat.format(results.automaticCount)})</button>}
          </div>
        </div>}
        {loadingJobs ? <Loading title={page === 'saved' ? 'Cargando tu lista…' : profile ? 'Consultando las bolsas de empleo…' : 'Preparando la búsqueda…'} view="jobs" />
          : selected ? <div className={'jobs-layout' + ((page === 'search' ? searchMobileDetail : mobileDetail) ? ' show-detail' : '')}>
          <div ref={jobListRef} className="job-list" role="region" aria-label="Ofertas" tabIndex={0} onScroll={event => {
            if (page === 'search' && event.currentTarget.getClientRects().length) searchPosition.current.list = event.currentTarget.scrollTop;
          }}>
            {visible.map(job => <JobCard key={job.id} job={job} selected={job.id === selected.id} onSelect={() => selectJob(job.id)} />)}
          </div>
          <div ref={detailRef} className="detail-scroll" role="region" aria-label="Detalle de la oferta" tabIndex={0} onScroll={event => {
            if (page === 'search' && event.currentTarget.getClientRects().length) searchPosition.current.detail = event.currentTarget.scrollTop;
          }}>
            <JobDetail key={selected.id} job={selected} busy={!!busy} onDecision={decide} onClose={closeDetail} />
          </div>
        </div> : page === 'saved' ? <Empty icon={tab === 'applied' ? <ClipboardCheck size={26} /> : <Bookmark size={26} />} title={libraryTabs.find(item => item.id === tab)?.empty || ''} />
          : allFailed ? <Empty compact icon={<Search size={22} />} title="Fuentes no disponibles"
            action={<button type="button" className="button secondary" disabled={!profile || !!busy} onClick={() => void search()}>Reintentar</button>}>
            No se pudieron consultar las bolsas de empleo.
          </Empty>
          : results ? <Empty compact icon={<Search size={22} />} title="No hay ofertas para esta búsqueda"
            action={filtered ? <button type="button" className="button secondary" onClick={() => { resetSearchView(); setFilters(current => ({ ...emptyFilters, similar: current.similar })); }}>Limpiar filtros</button>
              : career ? <button type="button" className="button secondary" onClick={() => { resetSearchView(); setCareer(''); }}>Ver todas las ofertas</button> : undefined}>
            {filtered ? 'Prueba con menos filtros o con otro texto.' : career ? 'No encontramos vacantes relacionadas con esta profesión.' : 'Las bolsas consultadas no devolvieron vacantes.'}
          </Empty>
          : <Empty compact icon={<Compass size={22} />} title="Busca según tu perfil">
            Deja el campo vacío para ver recomendaciones{priorityLocation ? ' con prioridad en ' + priorityLocation : ''}.
          </Empty>}
      </>}
    </main>
    <div className="toast-viewport">
      <p className="toast-announcer" role="status" aria-atomic="true">{toast?.text}</p>
      {toast && <Toast key={toast.id} text={toast.text} onDismiss={() => setToast(current => current?.id === toast.id ? null : current)} />}
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

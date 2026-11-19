import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { automaticDiscard } from './discard.mjs';
import { liveJobs } from './sources.mjs';
import { careerMatches, rankJobs, emptyProfile } from './match.mjs';
import { careerSuggestions, cleanProfile, importCv } from './profile.mjs';
import { initializeProfile, loadProfileSeed } from './profile-seed.mjs';

const port = Number(process.env.PORT || 5173);
const desktopToken = process.env.BRUJULA_DESKTOP_TOKEN;
const database = process.env.DB_PATH === ':memory:' ? ':memory:' : resolve(process.env.DB_PATH || 'data/brujula.sqlite');
if (database !== ':memory:') mkdirSync(dirname(database), { recursive: true });
const db = new DatabaseSync(database);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS profile_setup (id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS decisions (fingerprint TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS automatic_discards (fingerprint TEXT PRIMARY KEY, data TEXT NOT NULL);
`);
initializeProfile(db, loadProfileSeed());
const profile = () => {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  return row ? cleanProfile(JSON.parse(row.data)) : { ...emptyProfile };
};
const decisions = () => db.prepare('SELECT fingerprint, status, data FROM decisions').all();
const appliedJobs = () => db.prepare("SELECT data FROM decisions WHERE status = 'applied'").all().map(row => JSON.parse(row.data));
const automatic = () => db.prepare('SELECT fingerprint, data FROM automatic_discards').all();
const automaticCount = () => db.prepare(`
  SELECT COUNT(*) AS count FROM automatic_discards a
  WHERE NOT EXISTS (SELECT 1 FROM decisions d WHERE d.fingerprint = a.fingerprint)
`).get().count;
const searches = new Map();
let available = new Map();

const app = express();
app.disable('x-powered-by');
const server = createServer(app);
const localHost = () => '127.0.0.1:' + server.address()?.port;

if (desktopToken) {
  const expected = Buffer.from(desktopToken);
  const matches = value => typeof value === 'string' && Buffer.byteLength(value) === expected.length && timingSafeEqual(Buffer.from(value), expected);
  app.use((req, res, next) => {
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (req.get('host') !== localHost()) return res.sendStatus(403);
    if (req.method === 'GET' && req.path === '/desktop-session' && matches(req.query.token)) {
      res.set('Cache-Control', 'no-store');
      res.cookie('brujula_desktop', desktopToken, { httpOnly: true, sameSite: 'strict', path: '/' });
      return res.redirect('/');
    }
    const session = (req.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith('brujula_desktop='));
    if (!matches(session?.slice('brujula_desktop='.length))) return res.sendStatus(403);
    next();
  });
  process.stdin.resume();
  process.stdin.on('end', () => server.close(() => process.exit(0)));
}

app.use('/api', (req, res, next) => {
  const host = req.get('host') || '';
  if (![localHost(), 'localhost:' + server.address()?.port].includes(host) || (req.get('origin') && req.get('origin') !== 'http://' + host)) {
    return res.status(403).json({ error: 'Acceso disponible únicamente desde esta aplicación local.' });
  }
  res.set('Cache-Control', 'no-store');
  next();
});
app.post('/api/cv', express.raw({ type: 'application/pdf', limit: '8mb' }), async (req, res) => {
  res.json(await importCv(req.body));
});
app.use(express.json({ limit: '180kb' }));
app.get('/api/profile', (_req, res) => res.json(profile()));
app.put('/api/profile', (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Perfil inválido.' });
  const data = cleanProfile(req.body);
  if (data.salaryMax && data.salary > data.salaryMax) {
    return res.status(400).json({ error: 'El mínimo salarial no puede superar el máximo.' });
  }
  db.prepare('INSERT INTO profile VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').run(JSON.stringify(data));
  res.json(data);
});
app.post('/api/careers', async (_req, res) => res.json(await careerSuggestions(profile())));
app.post('/api/search', async (req, res) => {
  const career = req.body?.career;
  if (career !== undefined && (typeof career !== 'string' || career.length > 150)) {
    return res.status(400).json({ error: 'Profesión inválida.' });
  }
  const current = profile();
  if (!searches.has(current.location)) {
    searches.set(current.location, liveJobs(current.location).finally(() => searches.delete(current.location)));
  }
  const { jobs, sources } = await searches.get(current.location);
  const entries = new Map(decisions().map(row => [row.fingerprint, row.status]));
  const ranked = rankJobs(jobs, current, appliedJobs());
  const visible = [];
  const classified = [];
  for (const job of ranked) {
    const status = entries.get(job.fingerprint);
    const reason = automaticDiscard(job);
    if (reason) classified.push({ ...job, discardReason: reason });
    if (status === 'discarded' || status === 'applied' || (reason && !status)) continue;
    visible.push({ ...job, status: status === 'saved' ? status : '' });
  }
  const success = sources.some(source => source.ok);
  if (success) {
    const insert = db.prepare('INSERT INTO automatic_discards VALUES (?, ?)');
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM automatic_discards');
      for (const job of classified) insert.run(job.fingerprint, JSON.stringify(job));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    available = new Map(ranked.map(job => [job.id, job]));
  }
  res.status(success ? 200 : 503).json({ jobs: visible, careerMatches: career ? careerMatches(ranked, career) : [], sources, automaticCount: automaticCount(), searchedAt: new Date().toISOString() });
});
app.get('/api/decisions', (_req, res) => {
  const rows = new Map(decisions().map(row => [row.fingerprint, row]));
  for (const row of automatic()) {
    if (!rows.has(row.fingerprint)) rows.set(row.fingerprint, { ...row, status: 'discarded' });
  }
  const jobs = rankJobs([...rows.values()].filter(row => row.status !== 'included').map(row => JSON.parse(row.data)), profile(), appliedJobs());
  res.json(jobs.map(job => ({ ...job, status: rows.get(job.fingerprint).status })));
});
app.put('/api/decision', (req, res) => {
  const { id, status, application } = req.body || {};
  if (typeof id !== 'string' || !['saved', 'discarded', 'applied', ''].includes(status)) return res.status(400).json({ error: 'Acción inválida.' });
  let applicationDetails;
  if (status === 'applied') {
    const date = application?.date;
    const notes = application?.notes ?? '';
    const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date) : NaN;
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date || typeof notes !== 'string' || notes.length > 10000) {
      return res.status(400).json({ error: 'Indica una fecha de candidatura válida. Las notas admiten hasta 10.000 caracteres.' });
    }
    applicationDetails = { date, notes: notes.trim() };
  }
  const job = available.get(id) || [...decisions(), ...automatic()].map(row => JSON.parse(row.data)).find(row => row.id === id);
  if (!job) return res.status(404).json({ error: 'Oferta no disponible. Actualiza la búsqueda.' });
  const previousStatus = db.prepare('SELECT status FROM decisions WHERE fingerprint = ?').get(job.fingerprint)?.status;
  const next = status || (automaticDiscard(job) ? 'included' : '');
  const { discardReason, application: previousApplication, ...record } = job;
  if (applicationDetails) record.application = applicationDetails;
  if (next) {
    db.prepare('INSERT INTO decisions VALUES (?, ?, ?) ON CONFLICT(fingerprint) DO UPDATE SET status = excluded.status, data = excluded.data')
      .run(job.fingerprint, next, JSON.stringify(record));
  } else {
    db.prepare('DELETE FROM decisions WHERE fingerprint = ?').run(job.fingerprint);
  }
  const historyChanged = (previousStatus === 'applied') !== (status === 'applied');
  let searchUpdates;
  if (historyChanged) {
    const current = profile();
    const history = appliedJobs();
    const updated = rankJobs([...available.values()], current, history);
    available = new Map(updated.map(entry => [entry.id, entry]));
    searchUpdates = updated.map(({ id, match: { score, learned } }) => ({ id, score, learned }));
    record.match = available.get(id)?.match || rankJobs([record], current, history)[0].match;
  }
  res.json({ status, job: { ...record, status }, inSearch: available.has(id), automaticCount: automaticCount(), searchUpdates });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no disponible.' }));

if (process.argv.includes('--production')) {
  app.use(express.static(resolve('dist')));
} else {
  const { createServer: vite } = await import('vite');
  const frontend = await vite({ server: { middlewareMode: true, hmr: { server } } });
  app.use(frontend.middlewares);
}
app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ error: status === 413 ? 'El archivo o el contenido supera el tamaño permitido.' : status < 500 ? error.message : 'No se pudo completar la operación.' });
});
server.listen(port, '127.0.0.1', () => {
  console.log(desktopToken ? 'BRUJULA_READY:' + server.address().port : 'Brújula Empleo · http://' + localHost());
});

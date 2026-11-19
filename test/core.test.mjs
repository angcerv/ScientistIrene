import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, careerMatches, emptyProfile, rankJobs, suggest } from '../server/match.mjs';
import { importCv, splitCv } from '../server/profile.mjs';
import { automaticDiscard } from '../server/discard.mjs';
import { area, plainText } from '../server/sources.mjs';

test('analiza el contenido y conserva evidencia de preferencias y requisitos', () => {
  const profile = { ...emptyProfile, skills: 'PostgreSQL, Power BI', dislikes: 'cold calling', salary: 45000, location: 'Madrid', mode: 'Remoto', preferences: 'sin viajes' };
  const job = {
    title: 'Operations Associate', location: 'Barcelona, Spain', priority: 1, mode: 'Híbrido',
    salary: 'Salario anual 35.000–40.000 €',
    description: 'Responsibilities\nBuild dashboards with Tableau.\nCold calling with customers.\nIncluye viajes a clientes.\nRequirements\nSQL required.\nFluency in German.\nNice to have\nPython.',
  };
  const match = assess(job, profile);
  assert.ok(match.positives.some(item => item.quote === 'SQL required.'));
  assert.ok(match.positives.some(item => item.quote.includes('Tableau')));
  assert.ok(match.gaps.some(item => item.label.includes('Alemán')));
  assert.ok(!match.gaps.some(item => item.label.includes('Python')));
  assert.match(match.salaryFit, /por debajo/i);
  assert.ok(match.concerns.some(item => item.label.includes('ubicación')));
  assert.ok(match.concerns.some(item => item.quote.includes('viajes')));
  assert.ok(suggest(profile).some(role => role.title.includes('inteligencia de negocio')));
});

test('interpreta HTML de Greenhouse y limita ubicaciones remotas', () => {
  assert.equal(plainText('&lt;h2&gt;Requisitos&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Inglés&lt;/li&gt;&lt;/ul&gt;'), 'Requisitos\nInglés');
  assert.equal(area({ location: 'Madrid, Spain', mode: '' }, 'Madrid'), 3);
  assert.equal(area({ location: 'Remote — Europe', mode: 'Remoto' }, 'Madrid'), 2);
  assert.equal(area({ location: 'Remote — US', mode: 'Remoto' }, 'Madrid'), 0);
  assert.equal(area({ location: 'Barcelona, Spain' }, 'España'), 1);
});

test('extrae formación, experiencia y habilidades de un PDF con texto', async () => {
  const stream = 'BT /F1 14 Tf 50 740 Td 22 TL (Education) Tj T* (Computer Science) Tj T* (Experience) Tj T* (Data Analyst) Tj T* (Skills) Tj T* (SQL, Tableau) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((obj, index) => {
    const offset = pdf.length;
    pdf += (index + 1) + ' 0 obj\n' + obj + '\nendobj\n';
    return offset;
  });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  const result = await importCv(Buffer.from(pdf));
  assert.deepEqual(result.draft, { education: 'Computer Science', experience: 'Data Analyst', skills: 'SQL, Tableau' });
  await assert.rejects(importCv(Buffer.from('no PDF')), /PDF válido/);
});


test('separa encabezados de CV con títulos ampliados, partidos y texto en la misma línea', () => {
  const text = [
    'FORMACIÓN REGLADA', 'Grado en Historia', 'EXPERIENCIA', 'PROFESIONAL',
    'Técnica de archivo', 'COMPETENCIAS DIGITALES  Excel y SQL', 'IDIOMAS: Inglés B2',
    'INFORMACIÓN ADICIONAL', 'Disponibilidad inmediata',
  ].join('\n');
  assert.deepEqual(splitCv(text), {
    education: 'Grado en Historia',
    experience: 'Técnica de archivo',
    skills: 'Excel y SQL\nInglés B2',
  });
});

test('prioriza Madrid y analiza evidencia de fotónica y viajes sin atribuir especialización FBG', () => {
  const profile = { ...emptyProfile, education: 'Grado en Física', skills: 'fotolitografía, guías ópticas, espectroscopía', interests: 'fotónica, sensores', location: 'Madrid', preferences: 'Pocos desplazamientos, jornada completa' };
  const base = { title: 'Development Engineer', location: 'Getafe', mode: 'Híbrido', priority: 3, salary: '' };
  const match = assess({ ...base, description: 'Develop optical systems and prototypes.\nRequirements\nExperience with FBG sensors required.\nOccasional travel for workshops.\nTravel up to 60% of the time.' }, profile);
  assert.equal(area(base, 'Madrid'), 3);
  assert.ok(match.positives.some(item => item.label.includes('Óptica')));
  assert.ok(match.gaps.some(item => item.quote.includes('FBG')));
  assert.equal(match.travel, 'Travel up to 60% of the time.');
  assert.ok(match.heavyTravel);
  assert.equal(assess({ ...base, description: 'Investigación experimental.' }, profile).travel, 'No especificado');
});

test('importa encabezados con tabuladores internos y variantes de investigación', () => {
  const text = 'EXPERIENCIA \tPROFESIONAL \tEN \tENTORNOS \tTECNOLÓGICOS\nIngeniería\nEXPERIENCIA \tEN \tINVESTIGACIÓN \tY \tEN \tI+D\nPrácticas\nEDUCACIÓN\nGrado\nCOMPETENCIAS \tTÉCNICAS \tE \tIDIOMAS\nIdioma';
  assert.deepEqual(splitCv(text), { experience: 'Ingeniería\nPrácticas', education: 'Grado', skills: 'Idioma' });
});


test('aparta desarrollo y analítica puros, conserva programación y datos científicos', () => {
  const check = (title, description) => automaticDiscard({ title, description });
  assert.equal(check('Senior Backend Developer', 'Develop REST APIs for web applications.').label, 'Puesto centrado en desarrollo de software');
  assert.match(check('Data Analyst', 'Build dashboards and reporting for commercial teams.').quote, /dashboards/);
  assert.ok(check('Analista de datos', 'Desarrollar cuadros de mando y modelado de datos.'));
  assert.equal(check('Software Engineer', 'Develop software applications. Develop optical instrumentation and integrate hardware.'), null);
  assert.equal(check('Data Scientist', 'Build data pipelines. Analyze energy yield across wind farms.'), null);
  assert.equal(check('Embedded Software Engineer', 'Develop software applications and review code.'), null);
  assert.equal(check('Opto-Mechanical Engineer', 'Develop Python scripts for data analysis.'), null);
  assert.equal(check('Software Engineer', 'More details will be shared at the interview.'), null);
});

test('prellena un perfil nuevo o parcial una vez y respeta ediciones posteriores', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { initializeProfile } = await import('../server/profile-seed.mjs');
  const seed = { ...emptyProfile, location: 'Madrid', education: 'Física', experience: 'Laboratorio óptico', skills: 'MATLAB', interests: 'Fotónica' };
  for (const initial of [null, { ...emptyProfile, skills: 'Python', location: 'Getafe' }]) {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE profile (id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE profile_setup (id TEXT PRIMARY KEY);');
      if (initial) db.prepare('INSERT INTO profile VALUES (1, ?)').run(JSON.stringify(initial));
      initializeProfile(db, seed);
      const get = () => JSON.parse(db.prepare('SELECT data FROM profile WHERE id = 1').get().data);
      assert.equal(get().education, 'Física');
      assert.equal(get().location, initial?.location || 'Madrid');
      assert.equal(get().skills, initial?.skills || 'MATLAB');
      const edited = { ...get(), experience: '', interests: 'Sensores' };
      db.prepare('UPDATE profile SET data = ? WHERE id = 1').run(JSON.stringify(edited));
      initializeProfile(db, seed);
      assert.deepEqual(get(), edited);
    } finally {
      db.close();
    }
  }
});

test('combina filtros de ofertas y ordena las publicaciones sin fecha al final', async () => {
  const { emptyFilters, filterJobs } = await import('../src/job-filters.ts');
  const base = { title: 'Ingeniería óptica', company: 'KD', mode: 'Híbrido', priority: 3, description: 'Validación', location: 'Madrid' };
  const jobs = [
    { ...base, id: 'unknown', published: null, match: { score: null } },
    { ...base, id: 'old', published: '2026-11-01T12:00:00Z', match: { score: 0 } },
    { ...base, id: 'new', published: '2026-11-18T12:00:00Z', match: { score: 87 } },
    { ...base, id: 'remote', company: 'Otra', mode: 'Remoto', priority: 2, published: '2026-11-19T10:00:00Z', match: { score: 62 } },
  ];
  const now = Date.parse('2026-11-19T12:00:00Z');
  const ids = filters => filterJobs(jobs, { ...emptyFilters, ...filters }, now).map(job => job.id);
  assert.deepEqual(ids({ query: 'optica validacion', date: '7', zone: 'priority', mode: 'Híbrido', company: 'KD' }), ['new']);
  assert.deepEqual(ids({ date: 'unknown' }), ['unknown']);
  assert.deepEqual(ids({ zone: 'remote' }), ['remote']);
  assert.deepEqual(ids({ sort: 'newest' }), ['remote', 'new', 'old', 'unknown']);
  assert.deepEqual(ids({ sort: 'fit' }), ['new', 'remote', 'old', 'unknown']);
});

test('separa habilidades técnicas e interpersonales y explica actividades a partir del anuncio', () => {
  const profile = { ...emptyProfile, skills: 'MATLAB, trabajo en equipo, coordinación transversal', interests: 'fotónica' };
  const job = {
    title: 'Development Engineer', location: 'Madrid', salary: '', mode: '',
    description: [
      'About us', 'We work in the laboratory and conduct site visits.',
      'Responsibilities', 'Spend 60% of your time running numerical simulations in MATLAB.',
      'Perform bench tests and calibrate laboratory equipment.',
      'Participate in weekly design review meetings and collaborate with other teams.',
      'Join monthly calls with customers and visit client plants.',
      'Requirements', 'Work independently and demonstrate teamwork.',
      'Preferred qualifications include experience with video calls.',
    ].join('\n'),
  };
  const { positives, work } = assess(job, profile);
  assert.ok(positives.some(item => item.kind === 'technical' && item.label.includes('MATLAB')));
  assert.ok(positives.some(item => item.kind === 'soft' && item.label.includes('equipo')));
  assert.ok(work.items.some(item => item.label === 'Trabajo de ordenador'));
  assert.ok(work.items.some(item => item.label.includes('Laboratorio') && item.quote.startsWith('Perform')));
  assert.ok(work.items.some(item => item.label.includes('Reuniones')));
  assert.ok(work.items.some(item => item.label.includes('Llamadas')));
  assert.ok(work.items.some(item => item.label.includes('Visitas') && item.quote.includes('client plants')));
  assert.ok(!work.items.some(item => item.label.includes('individual')));
  assert.equal(work.time.length, 1);
  assert.match(work.time[0], /60%/);
});

test('mantiene como desconocidos los tiempos ausentes y evita confundir objetivos con dedicación', () => {
  const base = { title: 'Optics Engineer', location: 'Madrid', salary: '', mode: '' };
  const work = assess({ ...base, description: 'Develop software to improve efficiency by 40%.\nBuild prototypes and do hands-on testing in software.\nExperience working in a cleanroom.\nNo customer calls.' }, emptyProfile).work;
  assert.match(work.summary, /tareas de ordenador/);
  assert.deepEqual(work.time, []);
  assert.ok(!work.items.some(item => /Llamadas|Laboratorio/.test(item.label)));
  const desk = assess({ ...base, description: 'This is a mostly desk-based position.' }, emptyProfile).work;
  assert.match(desk.summary, /mayor parte/);
  assert.equal(desk.time.length, 1);
});

test('calcula un encaje de 0 a 100, distingue falta de datos y resta conflictos comprobados', () => {
  const profile = {
    ...emptyProfile,
    skills: 'SQL, Python, MATLAB, Power BI, Excel, React, trabajo en equipo, comunicación técnica, atención al detalle',
    interests: 'SQL, Python, MATLAB, Power BI, Excel, React',
  };
  const job = { title: 'Ingeniería', location: 'Madrid', mode: 'Presencial', salary: '', description: '' };
  assert.equal(assess(job, profile).score, null);
  assert.equal(assess({ ...job, description: 'Audiciones de violín.' }, emptyProfile).score, null);
  assert.equal(assess({ ...job, description: 'Audiciones de violín.' }, profile).score, 0);
  const matched = { ...job, description: 'SQL, Python, MATLAB, Power BI, Excel y React. Trabajo en equipo, comunicación técnica y atención al detalle.' };
  assert.equal(assess(matched, profile).score, 100);
  assert.equal(assess(matched, { ...profile, mode: 'Remoto' }).score, 92);
  assert.equal(assess({ ...matched, mode: '' }, { ...profile, mode: 'Remoto' }).score, 100);
});

test('busca ofertas de una profesión por sus tareas, sin dar peso a menciones en la presentación de la empresa', () => {
  const jobs = [
    { id: 'same', title: 'Opto-Mechanical Engineer', description: 'Optical measurements and beam propagation.' },
    { id: 'different', title: 'Hardware Engineer', description: 'Responsibilities\nDesign and test optical systems and calibrate photonics instrumentation.' },
    { id: 'company-only', title: 'Recruiter', description: 'About us\nWe develop optical systems and work in photonics.\nResponsibilities\nCoordinate interviews.' },
    { id: 'sales', title: 'Account Manager', description: 'Schedule customer calls and renew contracts.' },
  ];
  const ids = careerMatches(jobs, 'Ingeniera de óptica y fotónica');
  assert.deepEqual(ids.toSorted(), ['different', 'same']);
  assert.ok(careerMatches(jobs, 'Especialista en fotónica integrada').includes('different'));
  assert.deepEqual(careerMatches(jobs, 'Especialista en cerámica artística'), []);
});

test('compara el rango salarial sin cambiar el encaje ni el orden de una oferta', async () => {
  const { cleanProfile } = await import('../server/profile.mjs');
  const profile = { ...emptyProfile, skills: 'MATLAB, Python' };
  const job = { title: 'Ingeniera', location: 'Madrid', mode: '', salary: 'Salario bruto anual 35.000–40.000 €', description: 'Usar MATLAB y Python.' };
  const baseline = assess(job, profile);
  const target = { ...profile, salary: 45000, salaryMax: 55000 };
  const compared = assess(job, target);
  assert.equal(compared.score, baseline.score);
  assert.equal(compared.rank, baseline.rank);
  assert.equal(compared.salaryFit, 'Por debajo del salario deseado');
  const compare = salary => assess({ ...job, salary }, target).salaryFit;
  assert.equal(compare('Salario anual 48 000 a 52 000 EUR'), 'Encaja con tu salario deseado');
  assert.equal(compare('Annual salary €40k to €50k'), 'Coincide en parte con tu rango salarial');
  assert.equal(compare('Salario bruto €60.000/año'), 'Por encima del salario deseado');
  assert.equal(compare('Up to €50k per year'), 'Podría encajar · rango de la oferta incompleto');
  assert.equal(compare('Salario 3000 € al mes'), 'Salario bruto anual en euros por confirmar');
  assert.equal(compare('Salario neto anual 50000 €'), 'Salario bruto anual en euros por confirmar');
  assert.equal(compare(''), 'Salario sin publicar');
  assert.deepEqual(
    [cleanProfile({ salary: 30000 }).salary, cleanProfile({ salary: 30000 }).salaryMax],
    [30000, 0],
  );
});

test('las candidaturas previas refuerzan puestos afines por tareas reales, sin contar la propia oferta', () => {
  const profile = { ...emptyProfile, skills: 'MATLAB, fotolitografía, sensores', interests: 'fotónica', location: 'Madrid' };
  const base = { company: 'Empresa', location: 'Madrid', mode: '', salary: '', priority: 3 };
  const applied = { ...base, id: 'old', fingerprint: 'old', title: 'Especialista de laboratorio',
    description: 'Responsabilidades\nCaracterizar sistemas ópticos y sensores.\nRealizar ensayos de laboratorio y calibrar instrumentación.' };
  const similar = { ...base, id: 'new', fingerprint: 'new', title: 'Development Engineer',
    description: 'Responsibilities\nDevelop optical systems and test sensors.\nPerform laboratory tests and calibrate instrumentation in MATLAB.' };
  const unrelated = { ...base, id: 'other', title: 'Operations Analyst', description: 'Build reports in MATLAB and prepare spreadsheets for the commercial team.' };
  const jobs = [similar, unrelated, applied];
  const before = new Map(rankJobs(jobs, profile).map(job => [job.id, job.match]));
  const after = new Map(rankJobs(jobs, profile, [applied]).map(job => [job.id, job.match]));
  assert.ok(after.get('new').score > before.get('new').score);
  assert.equal(after.get('new').learned.title, applied.title);
  assert.ok(after.get('new').learned.activities.some(activity => activity.includes('Laboratorio')));
  assert.equal(after.get('other').score, before.get('other').score);
  assert.equal(after.get('old').learned, null);
  assert.ok(after.get('new').learned.points <= 10);
});

test('amplía la búsqueda a variantes de género y número solo al activar la casilla', async () => {
  const { emptyFilters, filterJobs } = await import('../src/job-filters.ts');
  const base = { location: 'Madrid', company: 'KD', published: null, mode: '', description: '' };
  const jobs = [
    { ...base, title: 'Ingeniero óptico' },
    { ...base, title: 'Ingeniera óptica' },
    { ...base, title: 'Ingenieras de óptica' },
    { ...base, title: 'Investigadora óptica' },
    { ...base, title: 'Ingeniera industrial' },
  ];
  assert.deepEqual(filterJobs(jobs, { ...emptyFilters, query: 'ingeniero' }).map(job => job.title), ['Ingeniero óptico']);
  assert.deepEqual(filterJobs(jobs, { ...emptyFilters, query: 'ingeniero', similar: true }).map(job => job.title),
    ['Ingeniero óptico', 'Ingeniera óptica', 'Ingenieras de óptica', 'Ingeniera industrial']);
  assert.deepEqual(filterJobs(jobs, { ...emptyFilters, query: 'ingeniera óptica', similar: true }).map(job => job.title),
    ['Ingeniero óptico', 'Ingeniera óptica', 'Ingenieras de óptica']);
});

test('InfoJobs solicita el detalle con credenciales de aplicación y omite fichas cerradas', async t => {
  const { fetchInfoJobs } = await import('../server/sources.mjs');
  const rows = [
    { id: 'test-optics', title: 'Ingeniería óptica', city: 'Tres Cantos', published: '2026-11-19T10:00:00Z', author: { name: 'Empresa de prueba' }, teleworking: { value: 'Híbrido' } },
    { id: 'test-closed', title: 'Oferta cerrada', city: 'Madrid' },
    { id: 'test-no-detail', title: 'Ficha incompleta', city: 'Madrid' },
  ];
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    calls.push(url.pathname);
    assert.equal(url.host, 'api.infojobs.net');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('test-id:test-secret').toString('base64'));
    if (url.pathname === '/api/9/offer') {
      assert.equal(url.searchParams.get('province'), 'madrid');
      return Response.json({ offers: rows });
    }
    if (url.pathname.endsWith('test-closed')) return Response.json({ active: false });
    if (url.pathname.endsWith('test-no-detail')) return Response.json({});
    return Response.json({
      link: 'https://www.infojobs.net/oferta-prueba', active: true,
      description: 'Montar y validar instrumentos ópticos.',
      minRequirements: 'Experiencia de laboratorio.',
      showPay: true, minPay: { amount: 40000, amountValue: '40.000 €', periodValue: 'Bruto/año' },
      maxPay: { amount: 50000, amountValue: '50.000 €' },
    });
  });
  assert.equal(fetchInfoJobs('Madrid', null), null);
  const { jobs, status } = await fetchInfoJobs('Madrid', { id: 'test-id', secret: 'test-secret' });
  assert.ok(status.ok);
  assert.equal(jobs.length, 1);
  assert.equal(calls.filter(path => path === '/api/7/offer/test-optics').length, 1);
  assert.match(jobs[0].description, /Requisitos\nExperiencia de laboratorio/);
  assert.equal(jobs[0].mode, 'Híbrido');
  assert.equal(jobs[0].salary, '40.000 € – 50.000 € Bruto/año');
  assert.equal(jobs[0].source, 'InfoJobs');
});

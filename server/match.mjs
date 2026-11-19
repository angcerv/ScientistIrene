import { salaryFit } from './salary.mjs';
import { describeWork } from './work-pattern.mjs';

export const normalize = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9+#.%]+/g, ' ').replace(/[.%](?= |$)/g, ' ').replace(/ +/g, ' ').trim();

export const emptyProfile = { education: '', experience: '', skills: '', interests: '', likes: '', dislikes: '', salary: 0, salaryMax: 0, location: 'España', mode: '', preferences: '' };

export function hasProfile(profile) {
  return ['education', 'experience', 'skills', 'interests', 'likes'].some(key => profile[key].trim());
}

const concepts = {
  'Óptica y fotónica': ['optica', 'optico', 'opticos', 'opticas', 'opto mechanical', 'optical', 'optics', 'fotonica', 'photonics', 'optical waveguides', 'guias opticas', 'espectroscopia', 'spectroscopy', 'fiber optics', 'fibra optica'],
  'Microfabricación': ['microfabricacion', 'microfabrication', 'fotolitografia', 'photolithography', 'cleanroom', 'clean room', 'sala blanca', 'grabado ionico', 'ion etching'],
  'Instrumentación y sensores': ['instrumentacion', 'instrumentation', 'sensores', 'sensors', 'instrumentacion cientifica', 'sensor systems', 'sistemas opticos', 'optical systems'],
  'Investigación y desarrollo experimental': ['i+d', 'r d', 'research and development', 'applied research', 'investigacion aplicada', 'experimentacion', 'experimental', 'prototipos', 'prototypes', 'prototyping', 'experimental testing'],
  'Caracterización de materiales': ['caracterizacion', 'characterization', 'nanoparticulas', 'nanoparticles', 'nanomateriales', 'nanomaterials', 'materials testing', 'material characterization'],
  'Análisis de señales': ['analisis de senales', 'signal analysis', 'signal processing', 'procesamiento de senales', 'senales electromagneticas', 'electromagnetic signals'],
  'Inspección y ensayos no destructivos': ['ensayos no destructivos', 'non destructive testing', 'ndt', 'eddy current', 'corrientes inducidas', 'inspeccion industrial', 'industrial inspection', 'iso 9712'],
  'Diseño mecánico y fabricación aditiva': ['solidworks', 'autocad', 'rhinoceros', 'fabricacion aditiva', 'additive manufacturing', '3d printing', 'impresion 3d', 'mechanical design', 'diseno mecanico', 'cad'],
  'Ingeniería biomédica': ['ingenieria biomedica', 'biomedical engineering', 'dispositivos medicos', 'medical devices', 'protesis', 'prosthesis'],
  'Física': ['fisica', 'physics', 'applied physics'],
  'MATLAB': ['matlab'],
  'Energía y rendimiento': ['energia renovable', 'energias renovables', 'renewable energy', 'wind energy', 'solar energy', 'recurso energetico', 'performance analysis', 'analisis de rendimiento'],
  'Validación y verificación técnica': ['validacion', 'verification', 'validation', 'verificacion', 'test campaign', 'pruebas de laboratorio', 'laboratory testing', 'testing and validation'],
  'Análisis de datos': ['analisis de datos', 'data analysis', 'data analytics', 'business intelligence', 'reporting', 'estadistica', 'statistics'],
  'SQL': ['sql', 'postgresql', 'mysql', 'sqlite', 'bigquery', 'snowflake'],
  'Visualización de datos': ['power bi', 'tableau', 'looker', 'data visualization', 'visualizacion de datos'],
  'Hojas de cálculo': ['excel', 'spreadsheets', 'google sheets', 'hojas de calculo'],
  'Python': ['python', 'pandas', 'numpy'],
  'Desarrollo web': ['desarrollo web', 'web development', 'javascript', 'typescript', 'react', 'frontend', 'vue', 'angular'],
  'Diseño de experiencia de usuario': ['ux', 'ui design', 'figma', 'user research', 'usabilidad', 'prototyping', 'prototipado', 'diseno de interfaces'],
  'Gestión de proyectos': ['gestion de proyectos', 'project management', 'coordinacion de proyectos', 'scrum', 'agile', 'metodologias agiles', 'jira'],
  'Gestión de producto': ['product management', 'gestion de producto', 'product owner', 'roadmap', 'product discovery'],
  'Optimización de procesos': ['process improvement', 'optimizacion de procesos', 'mejora de procesos', 'lean', 'six sigma', 'process mining'],
  'Operaciones y logística': ['logistica', 'logistics', 'supply chain', 'cadena de suministro', 'inventario', 'inventory', 'operaciones', 'operations'],
  'Atención al cliente': ['atencion al cliente', 'soporte al cliente', 'customer service', 'customer support', 'customer success', 'onboarding de clientes'],
  'Ventas y cuentas': ['ventas', 'sales', 'account management', 'gestion de cuentas', 'negociacion comercial', 'business development'],
  'Marketing digital': ['marketing', 'seo', 'sem', 'paid media', 'campanas digitales', 'digital campaigns', 'google ads'],
  'Redacción y contenidos': ['redaccion', 'copywriting', 'content strategy', 'creacion de contenido', 'technical writing', 'documentacion tecnica', 'edicion'],
  'Formación': ['docencia', 'formacion', 'teaching', 'training', 'instructional design', 'diseno instruccional'],
  'Finanzas y contabilidad': ['contabilidad', 'accounting', 'finance', 'finanzas', 'auditoria', 'budgeting', 'presupuestos'],
  'Selección y talento': ['recursos humanos', 'human resources', 'seleccion de personal', 'talent acquisition', 'recruitment', 'recruiting'],
  'Calidad y pruebas': ['quality assurance', 'software testing', 'pruebas de software', 'control de calidad', 'qa', 'playwright', 'cypress'],
  'Inglés': ['ingles', 'english'],
  'Español': ['espanol', 'spanish', 'castellano'],
  'Alemán': ['aleman', 'german'],
  'Francés': ['frances', 'french'],
};

const softSkills = {
  'Colaboración y trabajo en equipo': ['trabajo en equipo', 'teamwork', 'team player', 'collaborative work', 'colaboracion multidisciplinar', 'trabajo multidisciplinar', 'equipos multidisciplinares', 'multidisciplinary teams', 'collaborate with', 'work closely with'],
  'Comunicación e interlocución': ['comunicacion cientifica', 'comunicacion tecnica', 'habilidades comunicativas', 'communication skills', 'technical communication', 'scientific communication', 'interlocucion', 'presentar resultados', 'present findings', 'present results', 'communicate findings'],
  'Coordinación transversal': ['coordinacion transversal', 'coordinacion entre equipos', 'coordinar equipos', 'coordinate across teams', 'cross functional collaboration', 'cross functional teams', 'stakeholder management', 'liaise with stakeholders'],
  'Resolución de problemas': ['resolucion de problemas', 'problem solving', 'solve problems', 'solving problems', 'pensamiento analitico', 'analytical thinking'],
  'Atención al detalle': ['atencion al detalle', 'attention to detail', 'detail oriented', 'rigor experimental'],
  'Aprendizaje y adaptación': ['capacidad de aprendizaje', 'facilidad para aprender', 'adaptacion a nuevas tecnologias', 'adaptabilidad', 'adaptability', 'willingness to learn', 'quick learner', 'learn new technologies'],
  'Autonomía': ['capacidad de trabajar de forma autonoma', 'trabajo autonomo', 'trabajar de forma independiente', 'work independently', 'self motivated', 'autonomia'],
};

const roles = [
  ['Ingeniera de I+D experimental', 'Investigación y desarrollo experimental', 'Caracterización de materiales', 'Instrumentación y sensores', 'Física', 'Validación y verificación técnica'],
  ['Ingeniera de óptica y fotónica', 'Óptica y fotónica', 'Microfabricación', 'Instrumentación y sensores', 'Investigación y desarrollo experimental'],
  ['Ingeniera de validación de sensores e instrumentación', 'Instrumentación y sensores', 'Validación y verificación técnica', 'Análisis de señales', 'Investigación y desarrollo experimental'],
  ['Ingeniera de ensayos no destructivos y caracterización', 'Inspección y ensayos no destructivos', 'Análisis de señales', 'Caracterización de materiales', 'Validación y verificación técnica'],
  ['Ingeniera de prototipos y dispositivos médicos', 'Ingeniería biomédica', 'Diseño mecánico y fabricación aditiva', 'Validación y verificación técnica', 'Investigación y desarrollo experimental'],
  ['Ingeniera de rendimiento energético', 'Energía y rendimiento', 'Análisis de datos', 'Optimización de procesos', 'Hojas de cálculo'],
  ['Analista de inteligencia de negocio', 'Análisis de datos', 'SQL', 'Visualización de datos', 'Hojas de cálculo'],
  ['Especialista en minería de procesos', 'Optimización de procesos', 'Análisis de datos', 'SQL', 'Operaciones y logística'],
  ['Especialista en operaciones de producto', 'Gestión de proyectos', 'Gestión de producto', 'Optimización de procesos', 'Análisis de datos'],
  ['Especialista en implantación de software', 'Atención al cliente', 'Gestión de proyectos', 'Formación', 'Optimización de procesos'],
  ['Analista de operaciones comerciales', 'Ventas y cuentas', 'Análisis de datos', 'Hojas de cálculo', 'Optimización de procesos'],
  ['Especialista en formación de clientes', 'Formación', 'Atención al cliente', 'Redacción y contenidos'],
  ['Especialista en documentación técnica', 'Redacción y contenidos', 'Desarrollo web', 'Formación'],
  ['Investigador/a de experiencia de usuario', 'Diseño de experiencia de usuario', 'Análisis de datos', 'Gestión de producto'],
  ['Analista de calidad de software', 'Calidad y pruebas', 'Desarrollo web', 'Python', 'Optimización de procesos'],
  ['Analista de cadena de suministro', 'Operaciones y logística', 'Optimización de procesos', 'Hojas de cálculo', 'Análisis de datos'],
  ['Analista de planificación financiera', 'Finanzas y contabilidad', 'Hojas de cálculo', 'Análisis de datos'],
  ['Especialista en campañas y contenidos', 'Marketing digital', 'Redacción y contenidos', 'Diseño de experiencia de usuario'],
  ['Analista de talento', 'Selección y talento', 'Análisis de datos', 'Hojas de cálculo'],
];

const careerAnchors = {
  'Ingeniera de I+D experimental': ['i+d', 'r d', 'research and development', 'applied research', 'investigacion aplicada', 'experimental design', 'experimental testing', 'experimental setups', 'experimentos', 'prototipos fisicos', 'physical prototypes'],
  'Ingeniera de óptica y fotónica': ['optica', 'optico', 'opticos', 'optical', 'optics', 'fotonica', 'photonics', 'opto mechanical', 'electro optical', 'optoelectronica', 'optoelectronics', 'optomecanica', 'guias de onda', 'fiber optics'],
  'Ingeniera de validación de sensores e instrumentación': ['validacion de sensores', 'sensor validation', 'test benches', 'test bench', 'bancos de pruebas', 'instrumentacion', 'instrumentation', 'hardware test', 'sensor systems', 'integracion de sensores'],
  'Ingeniera de ensayos no destructivos y caracterización': ['ensayos no destructivos', 'non destructive testing', 'ndt', 'eddy current', 'corrientes inducidas', 'inspeccion industrial', 'industrial inspection', 'material characterization', 'characterization of materials', 'caracterizacion de materiales'],
  'Ingeniera de prototipos y dispositivos médicos': ['medical devices', 'medical device', 'dispositivos medicos', 'dispositivo medico', 'protesis', 'prosthesis', 'biomedical', 'biomedica', 'manufactura aditiva', 'additive manufacturing', 'fabricacion aditiva', 'rapid prototyping', 'prototipado rapido'],
  'Ingeniera de rendimiento energético': ['energy performance', 'rendimiento energetico', 'energy yield', 'energy production', 'produccion energetica', 'produccion de plantas', 'produccion renovable', 'solar generation', 'wind generation', 'renewable energy', 'energias renovables'],
};

const genericCareerWords = new Set(['ingeniera', 'ingeniero', 'ingenieria', 'engineer', 'engineering', 'especialista', 'specialist', 'analista', 'analyst', 'tecnico', 'tecnica', 'technician', 'consultor', 'consultora', 'consultant', 'senior', 'junior', 'investigador', 'investigadora', 'researcher', 'associate', 'puesto', 'desarrollo', 'development', 'aplicada', 'aplicado']);
const careerTasks = /\b(design|develop|build|perform|conduct|test|testing|manufactur\w*|calibrat\w*|validat\w*|verif\w*|simulat\w*|optimiz\w*|characteri[sz]\w*|analy[sz]\w*|measur\w*|integrat\w*|instrument\w*|disen\w*|desarroll\w*|ensay\w*|realiz\w*|medic\w*|valid\w*|integr\w*|caracteriz\w*|analiz\w*|fabric\w*)\b/;
const dutyHeader = /^(responsabilidades(?: principales| del puesto)?|funciones(?: principales| del puesto)?|tareas|que haras|tu dia a dia|responsibilities|main responsibilities|key responsibilities|what you ll do|what you will do|your role|job description)$/;
const nonDutyHeader = /^(sobre nosotros|about us|company description|beneficios|benefits|what we offer|que ofrecemos|requisitos(?: minimos)?|requirements|qualifications|your profile)$/;

function dutyLines(lines) {
  let section = 'general';
  return lines.filter(line => {
    if (dutyHeader.test(line)) { section = 'tasks'; return false; }
    if (nonDutyHeader.test(line)) { section = 'other'; return false; }
    return section === 'tasks' || (section === 'general' && careerTasks.test(line));
  });
}

export function careerMatches(jobs, career) {
  const query = normalize(career);
  if (!query) return [];
  const catalog = roles.find(([title]) => normalize(title) === query);
  const inferred = Object.values(careerAnchors).find(aliases => aliases.some(alias => contains(query, alias)));
  const core = catalog?.[1];
  const anchors = (catalog && careerAnchors[catalog[0]]) || inferred || (core && concepts[core]) || [];
  const supporting = (catalog || []).slice(2).map(label => concepts[label] || []);
  const specificWords = query.split(' ').filter(word => word.length >= 4 && !genericCareerWords.has(word));
  const relevant = [];
  for (const job of jobs) {
    const title = normalize(job.title);
    const titleHits = anchors.filter(alias => contains(title, alias)).length;
    const duties = dutyLines(excerpts(job.description).map(normalize));
    const bodyHits = anchors.filter(alias => duties.some(line => contains(line, alias))).length;
    const support = supporting.filter(aliases => aliases.some(alias => duties.some(line => contains(line, alias)))).length;
    const literalTitle = contains(title, query);
    const topicalMatch = !anchors.length && specificWords.length && (specificWords.every(word => contains(title, word)) ||
      duties.some(line => specificWords.every(word => contains(line, word))));
    if (literalTitle || titleHits || bodyHits || topicalMatch) {
      relevant.push({ id: job.id, weight: Number(literalTitle) * 8 + Math.min(titleHits, 3) * 4 + Math.min(bodyHits, 4) * 3 + support + Number(Boolean(topicalMatch)) });
    }
  }
  return relevant.sort((a, b) => b.weight - a.weight).map(({ id }) => id);
}

function contains(text, phrase) {
  return phrase && (' ' + text + ' ').includes(' ' + phrase + ' ');
}

function vocabulary(profile) {
  const known = normalize([profile.education, profile.experience, profile.skills].join(' '));
  const wanted = normalize([profile.interests, profile.likes].join(' '));
  const custom = profile.skills.split(/[,;\n]/).map(skill => skill.trim()).filter(skill => skill.length >= 2 && skill.length <= 60 && normalize(skill));
  const entries = new Map(Object.entries({ ...concepts, ...softSkills }));
  for (const skill of custom) {
    if (![...entries.values()].some(aliases => aliases.includes(normalize(skill)))) entries.set(skill, [normalize(skill)]);
  }
  return [...entries].map(([label, aliases]) => ({
    label, aliases, kind: Object.hasOwn(softSkills, label) ? 'soft' : 'technical', recorded: aliases.filter(alias => contains(known, alias)), known: aliases.some(alias => contains(known, alias)), wanted: aliases.some(alias => contains(wanted, alias)),
  }));
}

export function suggest(profile) {
  const terms = vocabulary(profile);
  return roles.map(([title, ...skills]) => {
    const matched = terms.filter(term => skills.includes(term.label) && (term.known || term.wanted));
    return { title, reason: matched.map(term => term.label).join(', '), weight: matched.reduce((sum, term) => sum + (term.known ? 2 : 0) + (term.wanted ? 3 : 0), 0) };
  }).filter(role => role.weight).sort((a, b) => b.weight - a.weight).slice(0, 6).map(({ title, reason }) => ({ title, reason: 'Áreas de tu perfil relacionadas: ' + reason + '.' }));
}

function excerpts(description) {
  return description.split('\n').flatMap(line => line.split(/(?<=[.!?])\s+/)).map(line => line.trim()).filter(Boolean);
}

function requirementLines(lines) {
  let section = false;
  return lines.filter(line => {
    const text = normalize(line);
    if (/^(benefits|perks|what we offer|que ofrecemos|responsibilities|responsabilidades|what you will do|about us|sobre nosotros|nice to have|deseable|preferred)\b/.test(text) && line.length < 95) section = false;
    if (/^(requirements|requisitos|qualifications|what you bring|what you ll bring|what we are looking for|what we re looking for|que buscamos|minimum qualifications|your profile|tu perfil)\b/.test(text) && line.length < 95) {
      section = true;
      return false;
    }
    if (/\b(nice to have|desirable|deseable|se valorara|preferred|a plus|valorable)\b/.test(text)) return false;
    return section || /\b(required|mandatory|must have|imprescindible|obligatorio|requisito|minimum of|at least|al menos|years of experience|anos de experiencia|proficiency in|fluency in)\b/.test(text);
  });
}

const generalTopics = new Set(['Formación', 'Física', 'Inglés', 'Español', 'Alemán', 'Francés', 'Gestión de proyectos', 'Optimización de procesos', 'Python', 'MATLAB', 'SQL', 'Hojas de cálculo']);

function dutyTopics(lines) {
  const duties = dutyLines(lines);
  return Object.entries(concepts).flatMap(([label, aliases]) => {
    if (generalTopics.has(label)) return [];
    const alias = aliases.find(value => duties.some(line => contains(line, value)));
    return alias ? [{ label, alias }] : [];
  });
}

function learnFromApplications(job, duties, work, history) {
  if (!history.length) return null;
  const topics = dutyTopics(duties);
  const activities = work.items.map(item => item.label);
  const comparisons = history.flatMap(previous => {
    if (previous.id === job.id || (job.fingerprint && previous.fingerprint === job.fingerprint)) return [];
    const common = topics.filter(topic => previous.topics.has(topic.label));
    const distinct = new Set(common.map(topic => topic.alias));
    const sharedActivities = activities.filter(activity => previous.activities.has(activity));
    const overlap = distinct.size / Math.max(1, topics.length, previous.topics.size);
    const sharesHandsOnWork = sharedActivities.some(activity => /^(Laboratorio|Visitas)/.test(activity));
    const closelyRelated = distinct.size >= 2 && overlap >= 0.25;
    const practicalMatch = distinct.size >= 1 && sharesHandsOnWork && sharedActivities.length >= 2;
    if (!closelyRelated && !practicalMatch) return [];
    const weight = 2 + Math.min(distinct.size, 3) + Number(overlap >= 0.5) + Math.min(sharedActivities.length, 2);
    return [{ title: previous.title, company: previous.company, topics: common.map(topic => topic.label), activities: sharedActivities, weight }];
  });
  if (!comparisons.length) return null;
  comparisons.sort((a, b) => b.weight - a.weight);
  const { weight, ...closest } = comparisons[0];
  return { ...closest, count: comparisons.length, points: Math.min(10, weight + Math.min(comparisons.length - 1, 2)) };
}

function scoreFit(positives, matchedInterests, gaps, conflicts, learnedPoints = 0) {
  const points = { technical: 0, soft: 0, interest: 0 };
  for (const { kind, weight } of positives) points[kind] += weight;
  const technical = Math.round(65 * Math.min(1, points.technical / 12));
  const soft = Math.round(15 * Math.min(1, points.soft / 4));
  const interests = Math.round(20 * Math.min(1, (points.interest + matchedInterests) / 6));
  const deductions = Math.min(gaps.length * 2, 12) + conflicts;
  return Math.max(0, Math.min(100, technical + soft + interests + learnedPoints) - deductions);
}

export function assess(job, profile, prepared = vocabulary(profile), history = []) {
  const lines = excerpts(job.description);
  const normalized = lines.map(normalize);
  const required = requirementLines(lines);
  const requiredNormalized = required.map(normalize);
  const positives = [];
  const gaps = [];
  const concerns = [];
  const profileReady = hasProfile(profile);
  let scoreConflicts = 0;
  for (const term of prepared) {
    const index = normalized.findIndex(line => term.aliases.some(alias => contains(line, alias)));
    if (index < 0) continue;
    const req = requiredNormalized.findIndex(line => term.aliases.some(alias => contains(line, alias)));
    const exact = term.recorded.some(alias => contains(req < 0 ? normalized[index] : requiredNormalized[req], alias));
    if (term.known || term.wanted) {
      const evidence = exact ? ' · en tu perfil' : term.known ? ' · competencia relacionada' : ' · en tus intereses';
      positives.push({ label: term.label + evidence, quote: req < 0 ? lines[index] : required[req], kind: term.known ? term.kind : 'interest', weight: exact && req >= 0 ? 4 : term.known ? 2 : 1 });
    }
    if (!exact && term.kind !== 'soft' && req >= 0 && profileReady) gaps.push({ label: term.label + ' · requisito concreto por verificar', quote: required[req] });
  }
  if (profileReady) {
    for (const line of required) {
      if (/\b(?:\d+\+?\s+(?:years|anos)|grado universitario|bachelor|master s degree|work authori[sz]ation|permiso de trabajo|nivel c[12]|level c[12]|native speaker|fbg|fiber bragg gratings?|hidrometalurgia|hydrometallurgy)\b/.test(normalize(line))) {
        gaps.push({ label: 'Requisito por contrastar', quote: line });
      }
    }
  }
  for (const item of profile.dislikes.split(/[,;\n]/).map(x => x.trim()).filter(x => normalize(x).length > 2)) {
    const aliases = Object.values(concepts).find(group => group.includes(normalize(item))) || [normalize(item)];
    const index = normalized.findIndex(line => aliases.some(alias => contains(line, alias)));
    if (index >= 0) {
      concerns.push({ label: 'Tarea que prefieres evitar: ' + item, quote: lines[index] });
      scoreConflicts += 5;
    }
  }
  const conditions = conditionsFor(lines, job, profile);
  concerns.push(...conditions.concerns);
  scoreConflicts += conditions.scoreConflicts;
  for (const preference of profile.preferences.split(/[,;\n]/).map(value => value.trim()).filter(value => normalize(value).length > 3)) {
    const term = normalize(preference);
    const unwanted = /^(evitar|sin|no quiero) (.+)$/.exec(term);
    const phrase = unwanted ? unwanted[2] : term;
    const aliases = Object.values(concepts).find(group => group.includes(phrase)) || [phrase];
    const index = normalized.findIndex(line => aliases.some(alias => contains(line, alias)));
    if (unwanted && index >= 0) {
      concerns.push({ label: 'Preferencia por revisar: ' + preference, quote: lines[index] });
      scoreConflicts += 5;
    }
    if (!unwanted && index >= 0) positives.push({ label: 'Preferencia mencionada: ' + preference, quote: lines[index], kind: 'interest', weight: 1 });
    if (!unwanted && index < 0) concerns.push({ label: 'Preferencia por confirmar: ' + preference, quote: '' });
  }
  if (profile.mode && profile.mode !== job.mode) {
    concerns.push({ label: job.mode ? 'Modalidad distinta de tu preferencia' : 'Modalidad por confirmar', quote: job.mode });
    if (job.mode) scoreConflicts += 8;
  }
  if (job.priority === 1 && !['', 'espana', 'spain'].includes(normalize(profile.location))) {
    concerns.push({ label: 'Fuera de la ubicación prioritaria', quote: job.location });
    scoreConflicts += 8;
  }
  const evidence = [...new Map(gaps.map(item => [item.quote, item])).values()];
  const weight = positives.reduce((sum, item) => sum + item.weight, 0);
  const matchedInterests = prepared.filter(term => term.wanted && normalized.some(line => term.aliases.some(alias => contains(line, alias))));
  const fitArguments = [positives, matchedInterests.filter(term => term.known).length, evidence, scoreConflicts];
  const baseScore = profileReady && lines.length ? scoreFit(...fitArguments) : null;
  const work = describeWork(lines, normalized);
  const similarity = baseScore > 0 && !conditions.heavyTravel ? learnFromApplications(job, normalized, work, history) : null;
  const score = similarity ? scoreFit(...fitArguments, similarity.points) : baseScore;
  const added = similarity ? score - baseScore : 0;
  return {
    score,
    learned: added > 0 ? { ...similarity, points: added } : null,
    salaryFit: salaryFit(job.salary, profile),
    level: !profileReady ? 'Sin perfil' : weight >= 6 ? 'Varias coincidencias' : weight ? 'Algunas coincidencias' : 'Pocas coincidencias',
    positives: positives.sort((a, b) => b.weight - a.weight).map(({ label, quote, kind }) => ({ label, quote, kind })),
    work,
    gaps: evidence, concerns, travel: conditions.travel, heavyTravel: conditions.heavyTravel,
    rank: weight + added / 2 + matchedInterests.length * 3 + conditions.adjustment - Math.min(evidence.length, 6) - 2 * concerns.filter(item => item.quote).length,
  };
}

function conditionsFor(lines, job, profile) {
  const prefs = normalize([profile.preferences, profile.dislikes].join(' '));
  const travelLines = lines.filter(line => /\b(travel(?:ling)?|desplazamientos?|viajes?|viajar)\b/.test(normalize(line)) &&
    (line.includes('%') || /\b(occasional|ocasional|frequent|frecuentes?|regular|required|disponibilidad|willing|ability|international|domestic|within|between|esporadicos?|no travel|sin viajes)\b/.test(normalize(line))));
  const maximumTravel = line => Math.max(0, ...[...line.matchAll(/(\d{1,3})\s*%\s*(?:of (?:the )?time|del tiempo|travel|viajes?)|(?:travel|viajes|viajar|desplazamientos)[^%.\d]{0,35}(\d{1,3})(?:\s*[–—-]\s*(\d{1,3}))?\s*%/gi)]
    .map(match => Number(match[3] || match[2] || match[1])));
  const strongest = [...travelLines].sort((a, b) => maximumTravel(b) - maximumTravel(a));
  const conflict = strongest.find(line => maximumTravel(line) > 25 || /\b(frequent|frecuentes?|regular)\b/.test(normalize(line)));
  const travel = conflict || strongest[0] || 'No especificado';
  const concerns = [];
  let adjustment = 0;
  let scoreConflicts = 0;
  const travelPreference = /\b(viajes|viajar|desplazamientos)\b/.test(prefs);
  const heavyTravel = travelPreference && conflict && maximumTravel(conflict) > 50;
  if (travelPreference && conflict) {
    adjustment -= heavyTravel ? 30 : 12;
    scoreConflicts += heavyTravel ? 20 : 8;
    concerns.push({ label: heavyTravel ? 'Viajes de más del 50 % · prioridad baja' : 'Viajes frecuentes o superiores al 25 %', quote: conflict });
  }
  const relocation = lines.find(line => /\b(must relocate|relocation required|willing(?:ness)? to relocate|requires relocation|reubicacion obligatoria|disponibilidad para trasladarse)\b/.test(normalize(line)));
  const presence = lines.find(line => /\b(must be based|you will be based|position is based|you will work on site|presencia semanal|asistencia semanal|puesto ubicado|puesto se encuentra en)\b/.test(normalize(line)));
  if (relocation) {
    adjustment -= 12;
    scoreConflicts += 10;
    concerns.push({ label: 'Posible requisito de reubicación', quote: relocation });
  }
  if (presence) concerns.push({ label: 'Ubicación o presencialidad indicada en el anuncio', quote: presence });
  if (job.priority === 2 && /\b(europe|europa|emea|global|worldwide)\b/.test(normalize(job.location)) && !/\b(espana|spain|madrid)\b/.test(normalize(job.location))) {
    concerns.push({ label: 'Elegibilidad para trabajar desde España por confirmar', quote: job.location });
  }
  if (hasProfile(profile) && /\b(head of|chief technology officer|director of|director tecnico|principal researcher)\b/.test(normalize(job.title))) {
    adjustment -= 10;
    concerns.push({ label: 'Posible puesto de dirección o alta especialización', quote: job.title });
  }
  if (job.priority === 1 && job.mode === 'Híbrido' && normalize(profile.location) === 'madrid') adjustment -= 5;
  if (job.priority > 1 && ['Híbrido', 'Remoto'].includes(job.mode) && /\b(hibrido|hibrida|remoto|remota)\b/.test(prefs)) adjustment += 3;
  if (/\b(estable|indefinido|jornada completa)\b/.test(prefs)) {
    const contract = normalize([job.contract, ...lines].join(' '));
    if (/\b(permanent contract|contrato indefinido|full time|jornada completa)\b/.test(contract)) adjustment += 2;
    if (/\b(fixed term contract|contrato temporal|part time|jornada parcial)\b/.test(contract)) adjustment -= 2;
  }
  return { travel, concerns, adjustment, scoreConflicts, heavyTravel: Boolean(heavyTravel) };
}

export function rankJobs(jobs, profile, appliedJobs = []) {
  const terms = vocabulary(profile);
  const history = appliedJobs.map(({ id, fingerprint, title, company, description }) => {
    const lines = excerpts(description);
    const text = lines.map(normalize);
    return {
      id, fingerprint, title, company,
      topics: new Set(dutyTopics(text).map(topic => topic.label)),
      activities: new Set(describeWork(lines, text).items.map(item => item.label)),
    };
  });
  return jobs.map(job => ({ ...job, match: assess(job, profile, terms, history) })).sort((a, b) =>
    Number(a.match.heavyTravel) - Number(b.match.heavyTravel) || (b.match.rank + b.priority * 3) - (a.match.rank + a.priority * 3) || (b.published || '').localeCompare(a.published || ''));
}

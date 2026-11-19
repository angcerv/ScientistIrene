import { load } from 'cheerio';
import { normalize } from './match.mjs';

const defaults = { cabify: 'Cabify', wallapop: 'Wallapop', typeform: 'Typeform', celonis: 'Celonis' };
const boards = [...new Set((process.env.GREENHOUSE_BOARDS || Object.keys(defaults).join(',')).split(',').map(s => s.trim()).filter(s => /^[a-z0-9_-]+$/i.test(s)))].slice(0, 12);
const cooldowns = new Map();
const madrid = /\b(madrid|getafe|tres cantos|alcobendas|san sebastian de los reyes|leganes|mostoles|san fernando de henares|alcala de henares|torrejon de ardoz|pozuelo de alarcon|las rozas|boadilla del monte|rivas vaciamadrid|alcorcon|fuenlabrada|parla|coslada|pinto|valdemoro|aranjuez|colmenar viejo|villaviciosa de odon|majadahonda|villanueva de la canada|arganda del rey|collado villalba|villaviciosa|hoyo de manzanares)\b/;

export function plainText(html) {
  let $ = load(String(html || ''));
  if (!$('body').children().length && /<\w+[^>]*>/.test($.text())) $ = load($.text());
  $('script,style,noscript').remove();
  $('br').replaceWith('\n');
  $('p,li,h1,h2,h3,h4,div,section,tr').append('\n');
  return $('body').text().split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

const spain = /\b(espana|spain|madrid|barcelona|valencia|sevilla|seville|bilbao|malaga|zaragoza|alicante|murcia|granada|valladolid|santander|oviedo|gijon|vigo|coruna|palma|pamplona|girona|galicia|catalonia|andalucia|salamanca|tenerife|canarias|canary islands|santiago de compostela|san sebastian)\b/;

export function area(job, location) {
  const place = normalize(job.location);
  const target = normalize(location);
  const spanish = spain.test(place) || madrid.test(place);
  const regional = /\b(europe|europa|emea|worldwide|global|from anywhere|union europea)\b/.test(place);
  const remote = job.mode === 'Remoto';
  const requested = target && !['espana', 'spain'].includes(target);
  const exact = requested && (target === 'madrid' || target === 'comunidad de madrid' ? madrid.test(place) : (' ' + place + ' ').includes(' ' + target + ' '));
  if (exact) return 3;
  if (requested && remote && (spanish || regional)) return 2;
  if (remote && regional) return 1;
  if (spanish) return 1;
  return 0;
}

function proposedMode(location, description) {
  const place = normalize(location);
  const work = normalize(description);
  if (/\b(hybrid|hibrido|hibrida)\b/.test(place) || /\b(hybrid working|hybrid work model|modelo hibrido|trabajo hibrido|hybrid setup)\b/.test(work)) return 'Híbrido';
  if (/\b(remote|remoto|remota|teletrabajo)\b/.test(place) || /\b(fully remote|100% remote|100% remoto|completamente remoto)\b/.test(work)) return 'Remoto';
  if (/\b(on site|onsite|presencial)\b/.test(place) || /\b(fully on site|100% presencial)\b/.test(work)) return 'Presencial';
  return '';
}

function vacancy(row, board) {
  const description = plainText(row.content);
  const primary = row.location?.name?.replace(/\s*;\s*/g, '; ').trim() || '';
  const offices = (row.offices || []).map(office => office.location).filter(Boolean);
  const location = [...new Set([primary, ...offices.filter(office => !primary || !normalize(office).startsWith(normalize(primary)))].filter(Boolean))].join(' · ');
  const company = row.company_name || defaults[board] || board;
  const salary = description.split('\n').find(line => /(?:€|\bEUR\b)/i.test(line) && /\d/.test(line) && /salary|salar|retribuci|compensation|\d\s*€/i.test(line)) || '';
  const url = new URL(row.absolute_url);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Enlace inválido');
  const linkKey = new URL(url);
  linkKey.hash = '';
  for (const key of [...linkKey.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'gh_src') linkKey.searchParams.delete(key);
  }
  return {
    id: 'greenhouse:' + board + ':' + row.id,
    fingerprint: normalize(company) + '|' + normalize(row.title) + '|' + normalize(row.location?.name || location),
    title: row.title, company, location, description, salary,
    mode: proposedMode(location, description), published: row.first_published || null,
    url: url.href, linkKey: linkKey.href, source: 'Greenhouse', board,
  };
}

async function fetchSource(name, read) {
  try {
    if (cooldowns.get(name) > Date.now()) throw new Error('Límite de consultas. Reintento disponible en unos minutos.');
    async function request(url) {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (response.status === 429) {
        const header = response.headers.get('retry-after');
        const delay = header && /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header || '') - Date.now();
        cooldowns.set(name, Date.now() + (delay > 0 ? delay : 60000));
        throw new Error('La fuente ha alcanzado su límite de consultas.');
      }
      if (!response.ok) throw new Error('La fuente devolvió HTTP ' + response.status + '.');
      return response;
    }
    const { jobs, warning } = await read(request);
    return { jobs, status: { name, ok: true, count: jobs.length, warning } };
  } catch (error) {
    const message = error.name === 'TimeoutError' ? 'La fuente tardó demasiado en responder.' : error instanceof TypeError ? 'No se pudo conectar con la fuente.' : error.message;
    return { jobs: [], status: { name, ok: false, count: 0, warning: message } };
  }
}

function collect(rows, transform) {
  const jobs = [];
  let skipped = 0;
  for (const row of rows) {
    try {
      const job = transform(row);
      if (!job) continue;
      if (!job.description || !job.title || !job.id) throw new Error();
      jobs.push(job);
    } catch {
      skipped++;
    }
  }
  return { jobs, warning: skipped ? skipped + ' registros incompletos omitidos.' : undefined };
}

function fetchBoard(board) {
  return fetchSource(defaults[board] || board, async request => {
    const response = await request('https://boards-api.greenhouse.io/v1/boards/' + board + '/jobs?content=true');
    const body = await response.json();
    if (!Array.isArray(body.jobs)) throw new Error('La respuesta de la fuente no tiene el formato esperado.');
    return collect(body.jobs, row => {
      if (!row.id || (row.application_deadline && Date.parse(row.application_deadline) < Date.now())) return null;
      return vacancy(row, board);
    });
  });
}

function fetchTeamtailor(name, host, pages) {
  return fetchSource(name, async request => {
    const url = host + '/jobs.rss?per_page=100';
    const first = await request(url);
    const $ = load(await first.text(), { xml: true });
    const channel = $('rss > channel');
    if (!channel.length) throw new Error('La respuesta de la fuente no contiene un canal RSS.');
    let partial;
    for (let page = 1; page < pages && channel.children('item').length === page * 100; page++) {
      try {
        const response = await request(url + '&offset=' + page * 100);
        const next = load(await response.text(), { xml: true });
        if (!next('rss > channel').length) throw new Error();
        for (const item of next('channel > item').toArray()) channel.append(next.xml(item));
      } catch {
        partial = 'No se pudieron consultar todas las páginas.';
        break;
      }
    }
    if (channel.children('item').length === pages * 100) partial = 'Se consultaron los primeros ' + pages * 100 + ' anuncios.';
    const result = collect(channel.children('item').toArray(), row => {
      const item = $(row);
      const value = tag => item.children(tag).first().text().trim();
      const location = item.find('tt\\:location').toArray().map(place => {
        const name = $(place).children('tt\\:name').text().trim();
        const city = $(place).children('tt\\:city').text().trim();
        const country = $(place).children('tt\\:country').text().trim();
        return [...new Set([name, city, country].filter(Boolean))].join(', ');
      }).join('; ');
      const guid = value('guid');
      if (!guid) throw new Error();
      const date = Date.parse(value('pubDate'));
      const result = vacancy({
        id: guid, title: value('title'), company_name: name, location: { name: location },
        content: value('description'), absolute_url: value('link'), first_published: Number.isFinite(date) ? new Date(date).toISOString() : null,
      }, name);
      const modes = { hybrid: 'Híbrido', fully: 'Remoto', temporary: '', none: 'Presencial' };
      return { ...result, id: 'teamtailor:' + guid, source: 'Teamtailor', mode: modes[value('remoteStatus')] || result.mode };
    });
    return { jobs: result.jobs, warning: [result.warning, partial].filter(Boolean).join(' ') || undefined };
  });
}

function fetchSmartRecruiters(name) {
  return fetchSource(name, async request => {
    const base = 'https://api.smartrecruiters.com/v1/companies/' + name + '/postings';
    const response = await request(base + '?country=es&limit=40');
    const body = await response.json();
    if (!Array.isArray(body.content)) throw new Error('La respuesta de la fuente no tiene el formato esperado.');
    let interrupted = false;
    let skipped = 0;
    const details = [];
    for (let offset = 0; offset < body.content.length && !interrupted; offset += 5) {
      const batch = await Promise.allSettled(body.content.slice(offset, offset + 5).map(async row => {
        if (!/^\d+$/.test(row.id)) throw new Error();
        const detail = await request(base + '/' + row.id);
        return detail.json();
      }));
      for (const row of batch) {
        if (row.status === 'fulfilled') details.push(row.value);
        else skipped++;
      }
      interrupted = cooldowns.get(name) > Date.now() || (offset === 0 && batch.every(row => row.status === 'rejected'));
    }
    if (body.content.length && !details.length) throw new Error('No se pudieron recuperar las descripciones de la fuente.');
    const result = collect(details, row => {
      if (!row.active || (row.unpublishOn && Date.parse(row.unpublishOn) < Date.now())) return null;
      const sections = row.jobAd?.sections;
      if (!sections?.jobDescription?.text) throw new Error();
      const content = ['companyDescription', 'jobDescription', 'qualifications', 'additionalInformation'].map(key => {
        const section = sections[key];
        return section?.text ? '<p>' + (key === 'qualifications' ? 'Requisitos' : key === 'additionalInformation' ? 'Qué ofrecemos' : key === 'jobDescription' ? 'Responsabilidades' : 'Sobre nosotros') + '</p>' + section.text : '';
      }).join('');
      const job = vacancy({
        id: row.id, title: row.name, company_name: row.company?.name,
        location: { name: row.location?.fullLocation || row.location?.city }, content, absolute_url: row.postingUrl,
        first_published: row.releasedDate,
      }, name);
      const mode = row.location?.hybrid ? 'Híbrido' : row.location?.remote ? 'Remoto' : job.mode;
      return { ...job, id: 'smartrecruiters:' + name + ':' + row.id, source: 'SmartRecruiters', mode, contract: row.typeOfEmployment?.label || '' };
    });
    const warnings = [
      result.warning,
      body.totalFound > body.content.length && 'Se consultaron los ' + body.content.length + ' anuncios de la primera página.',
      skipped && skipped + ' descripciones no disponibles.',
      interrupted && 'La consulta de descripciones se interrumpió.',
    ].filter(Boolean);
    return { jobs: result.jobs, warning: warnings.join(' ') || undefined };
  });
}

function fetchKd() {
  return fetchSource('KD', async request => {
    const host = 'https://www.kd.tech';
    const index = await request(host + '/sitemap.xml');
    const sitemap = load(await index.text(), { xml: true });
    if (!sitemap('urlset').length) throw new Error('No se pudo leer el índice público de vacantes.');
    const urls = [...new Set(sitemap('url > loc').toArray().map(row => sitemap(row).text().trim())
      .filter(url => /^https:\/\/www\.kd\.tech\/careers\/[a-z\d-]+\/?$/i.test(url)))];
    const jobs = [];
    let missing = 0;
    for (let offset = 0; offset < Math.min(urls.length, 24) && !(cooldowns.get('KD') > Date.now()); offset += 6) {
      const batch = await Promise.allSettled(urls.slice(offset, offset + 6).map(async url => {
        const response = await request(url);
        const $ = load(await response.text());
        const records = $('script[type="application/ld+json"]').toArray().flatMap(script => {
          try {
            const schema = JSON.parse($(script).text());
            return Array.isArray(schema) ? schema : schema['@graph'] || [schema];
          } catch {
            return [];
          }
        });
        const posting = records.find(record => record?.['@type'] === 'JobPosting');
        if (!posting || (posting.validThrough && Date.parse(posting.validThrough) < Date.now())) return null;
        const places = [posting.jobLocation].flat().filter(Boolean);
        const location = places.map(({ address }) => address
          ? [address.addressLocality, address.addressRegion, address.addressCountry === 'ES' ? 'España' : address.addressCountry].filter(Boolean).join(', ')
          : '').filter(Boolean).join('; ');
        const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1);
        const details = vacancy({
          id: slug, title: posting.title, company_name: 'KD', absolute_url: url,
          first_published: posting.datePosted || null, location: { name: location }, content: posting.description,
        }, 'kd');
        if (!details.title || !details.description) throw new Error();
        return { ...details, id: 'kd:' + slug, source: 'KD', contract: [posting.employmentType].flat().filter(Boolean).join(' ').replaceAll('_', ' ') };
      }));
      for (const result of batch) {
        if (result.status === 'fulfilled') {
          if (result.value) jobs.push(result.value);
        } else missing++;
      }
      if (offset === 0 && batch.every(row => row.status === 'rejected')) throw new Error('No se pudieron recuperar las descripciones de la fuente.');
    }
    const warning = [
      missing && missing + ' descripciones no disponibles.',
      urls.length > 24 && 'Se consultaron solo las primeras vacantes del índice.',
      cooldowns.get('KD') > Date.now() && 'La consulta de descripciones se interrumpió.',
    ].filter(Boolean).join(' ');
    return { jobs, warning: warning || undefined };
  });
}

export async function liveJobs(location) {
  const feeds = await Promise.all([...boards.map(fetchBoard), fetchTeamtailor('ARQUIMEA', 'https://careers.arquimea.com', 2), fetchTeamtailor('Sener', 'https://www.engineering-jobs.sener', 3), fetchSmartRecruiters('AFRY'), fetchSmartRecruiters('Eurofins'), fetchKd()]);
  const jobs = [];
  const seen = new Set();
  for (const job of feeds.flatMap(feed => feed.jobs).sort((a, b) => b.description.length - a.description.length)) {
    const priority = area(job, location);
    if (!priority || seen.has(job.fingerprint) || seen.has(job.linkKey)) continue;
    seen.add(job.fingerprint);
    seen.add(job.linkKey);
    jobs.push({ ...job, priority });
  }
  return { jobs, sources: feeds.map(feed => feed.status) };
}

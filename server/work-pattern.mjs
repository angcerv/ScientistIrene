const rules = [
  { id: 'computer', label: 'Trabajo de ordenador', evidence: /\b(desk based|computer based|screen time|trabajo (?:de|en|con) ordenador|delante del ordenador|(?:en|ante) el ordenador|frente a la pantalla|at a computer|at a desk|develop(?:ing)? (?:software|scripts|code)|writ(?:e|ing) code|(?:run(?:ning)?|perform(?:ing)?|conduct(?:ing)?|build(?:ing)?|develop(?:ing)?|creat(?:e|ing)|prepar(?:e|ing)|writ(?:e|ing)|maintain(?:ing)?|analy[sz](?:e|ing))\b.{0,55}\b(?:simulations?|numerical models?|datasets?|data sets?|dashboards?|reports?|spreadsheets?|documentation|python scripts?)|(?:desarrollar|programar|realizar|ejecutar|preparar|redactar|analizar|crear|mantenimiento de|diseno de)\b.{0,55}\b(?:simulaciones|modelos numericos|datos|informes|documentacion|cuadros de mando|scripts?|software))\b/ },
  { id: 'solo', label: 'Trabajo individual explícito', evidence: /\b(work(?:ing)? (?:mostly |primarily )?(?:alone|independently|in isolation)|trabaj(?:o|ar) (?:en solitario|de forma independiente|de manera autonoma)|tareas individuales|individual work)\b/ },
  { id: 'lab', label: 'Laboratorio, taller y pruebas', evidence: /\b(hands on (?:lab|laboratory|hardware (?:testing|assembly|integration)|physical prototyping)|work(?:ing)? in (?:a |the )?(?:labs?|laboratory|clean ?room|workshop)|(?:trabajar|trabajo|ensayos|pruebas|mediciones|experimentacion) (?:en|de) (?:el |un |sala (?:limpia|blanca) )?(?:laboratorio|sala (?:blanca|limpia)|taller)|(?:conduct|perform|run|realizar|ejecutar)\b.{0,36}\b(?:bench tests?|lab(?:oratory)? tests?|pruebas de banco|ensayos de laboratorio)|(?:assemble|fabricate|montar|ensamblar|fabricar)\b.{0,30}\b(?:prototypes?|prototipos|physical components?|componentes fisicos)|(?:build|construct|construir)\b.{0,22}\b(?:physical prototypes?|prototipos fisicos)|(?:set up|operate|calibrate|operar|calibrar)\b.{0,38}\b(?:test equipment|test benches|laboratory equipment|instrumentacion|equipos de ensayo|bancos de prueba)|(?:develop|integrate|implement(?:ation)?|integrar|implementar|montaje)\b.{0,50}\b(?:test benches|hardware test setups?|bancos de pruebas?)|perform electrical characterization|realizar caracterizacion electrica)\b/ },
  { id: 'visits', label: 'Visitas y trabajo de campo', evidence: /\b(site visits?|fieldwork|field work|field tests?|field inspections?|on site (?:testing|inspections?|commissioning|measurements?)|visit(?:ing|s)? (?:customers?|clients?|sites?|plants?|suppliers?)|travel to (?:customer|client|site|plant)|visitas? (?:a|en) (?:clientes?|instalaciones|plantas|obras|proveedores)|pruebas en campo|trabajo de campo|inspecciones en (?:campo|planta|obra)|puesta en marcha en (?:campo|planta|las instalaciones))\b/ },
  { id: 'meetings', label: 'Reuniones y presentaciones', evidence: /\b((?:attend|lead|organize|organise|facilitate|participate in|schedule|hold|present in)\b.{0,40}\b(?:meetings?|workshops?|design reviews?)|(?:asistir|participar|liderar|organizar|facilitar|mantener|convocar)\b.{0,40}\b(?:reuniones|presentaciones|talleres)|(?:weekly|daily|regular|monthly|team|client|customer) (?:meetings?|workshops?)|reuniones (?:semanales|diarias|mensuales|con (?:clientes|el equipo|proveedores)))\b/ },
  { id: 'calls', label: 'Llamadas y videollamadas', evidence: /\b(phone calls?|video calls?|(?:client|customer|sales|support) calls?|calls with (?:customers?|clients?|partners?|suppliers?|the team)|llamadas (?:telefonicas|con (?:clientes?|proveedores|el equipo)|de (?:soporte|seguimiento))|videollamadas)\b/ },
  { id: 'customers', label: 'Contacto con clientes', evidence: /\b(customer facing|client facing|customer liaison|client liaison|(?:work|collaborate|engage|meet|liaise|interact|communicate|build relationships)\b.{0,36}\bwith (?:end )?(?:customers?|clients?)|(?:train|advise|support|onboard) (?:new |our )?(?:customers?|clients?)|(?:tratar|colaborar|interactuar|trabajar|reunirse|comunicarse)\b.{0,35}\bcon (?:los )?clientes|atender (?:a )?clientes|asesorar a clientes|contacto (?:directo )?con clientes|(?:client|customer) (?:meetings?|calls?)|(?:reuniones|llamadas|visitas) (?:con|a) clientes)\b/ },
  { id: 'team', label: 'Colaboración con otros equipos', evidence: /\b((?:work|collaborate|coordinate|partner|liaise)\b.{0,36}\bwith\b.{0,50}\b(?:teams?|colleagues?|stakeholders?|engineers?)|(?:colaborar|coordinarse|trabajar)\b.{0,35}\bcon\b.{0,35}\b(?:equipos?|companeros?|departamentos?)|coordinacion (?:transversal|entre equipos|con otros departamentos)|cross functional collaboration|cross functional teams?)\b/ },
];

const roleHeading = /^(?:responsabilidades(?: del puesto)?|funciones(?: principales| del puesto)?|tus tareas|que haras|que vas a hacer|tu dia a dia|responsibilities|key responsibilities|your responsibilities|what you will do|what you ll do|your day to day|job description|your mission|your role|about the role|what you ll be doing|que haras en tu dia a dia)$/;
const ignoredHeading = /^(?:required experience and candidate profile|required experience|skills and qualifications|requisitos(?: minimos| del puesto)?|perfil (?:requerido|buscado)|que buscamos|your profile|qualifications|requirements|what we (?:are looking for|offer|expect)|what are we looking for|what you (?:bring|need)|what do you bring|que esperamos de ti|sobre nosotros|about (?:us|the company)|company description|que ofrecemos|beneficios|benefits|nice to have)$/;
const splitOfTime = /\b(?:\d{1,3}\s*%\s*(?:of (?:your |the )?time|(?:de|del) (?:tu tiempo|la jornada|tiempo)|(?:at a|on a|in the) (?:desk|lab|laboratory|field))|\d+\s*(?:hours?|horas?|days?|dias?)\s*(?:a week|per week|por semana|a la semana|semanales?)|full time at a desk|(?:mostly|primarily|entirely) (?:desk based|computer based)|principalmente (?:trabajo )?de ordenador|(?:most of|la mayor parte de) (?:your time|the time|tu tiempo|la jornada|el tiempo))\b|\b(?:spend|dedicar|dedicacion|distribucion)\b.{0,24}\b\d{1,3}\s*%(?!\d)/i;
const negated = /\b(?:no (?:customer|client|phone|video) (?:contact|calls?)|sin (?:contacto|llamadas|visitas)|no se (?:realizan|requieren) (?:visitas|llamadas)|not required to)\b/;
const qualification = /^(?:experience (?:with|in|working|using|conducting|performing)|previous experience|proven experience|demonstrable experience|professional experience|hands on experience|\d+ years (?:of )?experience|experiencia (?:en|previa|demostrable|con)|ability to|capacidad para|knowledge of|conocimientos de)\b/;

export function describeWork(lines, normalized) {
  let section = 'general';
  const found = new Map();
  const allocations = new Set();
  let mostlyComputer = false;
  for (const [index, text] of normalized.entries()) {
    if (roleHeading.test(text)) { section = 'tasks'; continue; }
    if (ignoredHeading.test(text)) { section = 'ignore'; continue; }
    if (section === 'ignore' || qualification.test(text) || negated.test(text)) continue;
    const matches = rules.filter(rule => rule.evidence.test(text));
    if (!matches.length) continue;
    // A frequency or explicit allocation outranks a general mention of the same activity.
    const quote = lines[index];
    const timeText = quote.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[-–—]/g, ' ');
    const hasTime = splitOfTime.test(timeText);
    if (hasTime) allocations.add(quote);
    if (matches.some(rule => rule.id === 'computer') && /\b((?:most|majority) of (?:your|the) time|mayor parte de (?:la jornada|tu tiempo|el tiempo)|(?:mostly|primarily|entirely) (?:desk based|computer based)|full time at a desk|principalmente (?:trabajo )?de ordenador)\b/.test(text)) mostlyComputer = true;
    const weight = Number(section === 'tasks') + Number(hasTime) * 2;
    for (const { id, label } of matches) {
      if (!found.has(id) || found.get(id).weight < weight) found.set(id, { label, quote, weight });
    }
  }
  const items = rules.flatMap(rule => {
    const evidence = found.get(rule.id);
    return evidence ? [{ label: evidence.label, quote: evidence.quote }] : [];
  });
  const practical = found.has('lab') || found.has('visits');
  const social = ['calls', 'customers', 'meetings', 'team'].some(id => found.has(id));
  let summary = 'El anuncio no describe con suficiente claridad cómo es el día a día.';
  if (mostlyComputer) summary = 'El anuncio indica que el trabajo de ordenador ocupa la mayor parte de la jornada.';
  else if (found.has('computer') && practical && social) summary = 'El puesto describe tareas de ordenador, trabajo práctico e interacción con otras personas.';
  else if (found.has('computer') && practical) summary = 'El puesto describe tareas de ordenador junto con trabajo práctico.';
  else if (found.has('computer') && social) summary = 'El puesto incluye tareas de ordenador e interacción con otras personas.';
  else if (practical && social) summary = 'El puesto describe trabajo práctico e interacción con otras personas.';
  else if (practical) summary = 'El anuncio describe trabajo práctico en laboratorio, taller o instalaciones.';
  else if (social) summary = 'El anuncio describe interacción con otras personas.';
  else if (found.has('computer')) summary = 'El anuncio describe tareas de ordenador. El resto de la jornada está por aclarar.';
  else if (found.has('solo')) summary = 'El anuncio menciona trabajo individual.';
  return { summary, time: [...allocations].slice(0, 2), items };
}

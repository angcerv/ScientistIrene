import { normalize } from './match.mjs';

const softwareTitle = /\b(software (?:engineer|developer|architect)|(?:front ?end|back ?end|full ?stack|web|mobile|android|ios|java|javascript|typescript|python|php|go|react) (?:engineer|developer)|(?:application|applications) developer|programador(?:a| a)?|desarrollador(?:a| a)? (?:de software|web|frontend|backend|full stack|java|python|javascript)|ingenier[oa](?: a)? de software)\b/;
const dataTitle = /\b(data (?:analyst|scientist|engineer|analytics engineer)|(?:business intelligence|bi) (?:analyst|developer|engineer)|(?:analista|cientific[oa]|ingenier[oa]) de datos|analista bi|analytics engineer)\b/;
const softwareWork = /\b(web applications?|mobile applications?|microservices|rest apis?|front ?end|back ?end|full ?stack|software applications?|software (?:development|engineering)|web services?|application development|cloud services?|code reviews?|debugging|programacion|desarrollo (?:de software|web|de aplicaciones)|aplicaciones (?:web|moviles)|microservicios|revision de codigo)\b/;
const dataWork = /\b(dashboards?|data pipelines?|data warehouses?|data modelling|data modeling|data ingestion|business intelligence|reporting|etl|elt|cuadros de mando|informes analiticos|modelado de datos|modelizacion de datos|analisis de datos|data analysis)\b/;
const specialistTitle = /\b(embedded|firmware|empotrado|embebido|fpga|asic|signal processing|procesamiento de senales|scientific computing|computacion cientifica|geospatial|geomatics|teledeteccion|remote sensing|computational physics|fisica computacional|optical|optica|opto|photonics|fotonica|robotics|robotica|hardware|laboratory|laboratorio|simulation|simulacion|biomedical|biomedic[oa]|biostatistician|bioinformatic[oa]|bioinformatics)\b/;
const scientificWork = /\b(fotonica|photonics|optical (?:systems?|design|instrumentation|measurements?|waveguides?)|sistemas opticos|diseno optico|instrumentacion|instrumentation|procesamiento de senales|signal processing|embedded systems?|sistemas embebidos|fpga|asic|hardware integration|integracion de hardware|robotic systems?|sistemas roboticos|scientific computing|computacion cientifica|(?:thermal|physical|electromagnetic|optical|energy|mechanical) simulation|simulacion (?:fisica|termica|electromagnetica|mecanica|optica|energetica)|scientific experiments?|experimentos|experimental testing|ensayos experimentales|laboratory (?:testing|experiments?|measurements?|instruments?)|(?:pruebas|ensayos|mediciones) de laboratorio|photolithography|fotolitografia|material characterization|caracterizacion de materiales|non destructive testing|ensayos no destructivos|medical devices|dispositivos medicos|energy (?:yield|production|performance)|(?:rendimiento|produccion) (?:energetic[oa]|de (?:plantas|parques))|geospatial analysis|analisis geoespacial|industrial automation|automatizacion industrial|manufacturing processes|procesos de fabricacion|clinical trials?|ensayos clinicos|remote sensing|teledeteccion)\b/;
const duties = /\b(design|develop|implement|build|simulate|validate|characterize|measure|model|analy[sz]e|perform|integrate|test|automatize|automate|disenar|desarrollar|implementar|construir|simular|validar|caracterizar|medir|modelar|analizar|realizar|integrar|probar|automatizar|optimizar|improvement|investigacion|research)\b/;

export function automaticDiscard(job) {
  const title = normalize(job.title);
  if (specialistTitle.test(title)) return null;
  const kind = softwareTitle.test(title) ? 'software' : dataTitle.test(title) ? 'data' : null;
  if (!kind) return null;
  const lines = job.description.split('\n').map(line => ({ text: line.trim(), normalized: normalize(line) })).filter(line => line.text);
  if (lines.some(({ normalized }) => scientificWork.test(normalized) && (duties.test(normalized) || /\b(experience (?:in|with)|experiencia (?:en|con)|knowledge of|conocimientos de)\b/.test(normalized)))) return null;
  const focus = kind === 'software' ? softwareWork : dataWork;
  const evidence = lines.find(({ normalized }) => focus.test(normalized) && duties.test(normalized)) || lines.find(({ normalized }) => focus.test(normalized));
  if (!evidence) return null;
  return {
    label: kind === 'software' ? 'Puesto centrado en desarrollo de software' : 'Puesto centrado en análisis o ingeniería de datos',
    quote: evidence.text,
  };
}

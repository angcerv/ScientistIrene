export function salaryFit(salary, { salary: desiredMin, salaryMax: desiredMax }) {
  if (!desiredMin && !desiredMax) return null;
  if (!salary) return 'Salario sin publicar';
  const text = salary.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const annual = /\b(?:annual(?:ly)?|anual(?:es)?|yearly|per (?:year|annum)|al ano|por ano)\b|\/\s*(?:ano|year|yr)\b/.test(text);
  if (!annual || !/(?:€|\beur\b)/.test(text) || /\b(?:net[oa]s?|net pay|net salary|after tax)\b/.test(text)) {
    return 'Salario bruto anual en euros por confirmar';
  }
  const amounts = [...text.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*k\b|\b(\d{1,3}(?:[., \u202f\u00a0]\d{3})+|\d{4,7})\b/g)]
    .map(match => match[1] ? Number(match[1].replace(',', '.')) * 1000 : Number(match[2].replace(/\D/g, '')));
  if (!amounts.length || amounts.length > 2) return 'Importe anual por confirmar';

  const single = amounts.length === 1;
  const onlyMaximum = single && /\b(hasta|up to|maximum|maximo)\b/.test(text);
  const onlyMinimum = single && /\b(desde|starting at|starts at|minimum|minimo|from)\b/.test(text);
  const offerMin = onlyMaximum ? null : Math.min(...amounts);
  const offerMax = onlyMinimum ? null : Math.max(...amounts);
  if (desiredMin && offerMax !== null && offerMax < desiredMin) return 'Por debajo del salario deseado';
  if (desiredMax && offerMin !== null && offerMin > desiredMax) return 'Por encima del salario deseado';
  if ((desiredMin && offerMin === null) || (desiredMax && offerMax === null)) return 'Podría encajar · rango de la oferta incompleto';
  if ((desiredMin && offerMin < desiredMin) || (desiredMax && offerMax > desiredMax)) return 'Coincide en parte con tu rango salarial';
  return 'Encaja con tu salario deseado';
}

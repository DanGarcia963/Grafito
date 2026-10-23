const UMBRAL_COINCIDENCIA = 50;

/**
 * Normaliza nombres para comparar únicamente su texto, sin distinguir
 * mayúsculas, acentos ni separadores tipográficos.
 */
export function normalizarNombreTramite(nombre: string): string {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function bigramas(texto: string): Set<string> {
  const acotado = ` ${texto} `;
  const resultado = new Set<string>();
  for (let i = 0; i < acotado.length - 1; i += 1) {
    resultado.add(acotado.slice(i, i + 2));
  }
  return resultado;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let interseccion = 0;
  for (const elemento of a) {
    if (b.has(elemento)) interseccion += 1;
  }
  return (2 * interseccion) / (a.size + b.size);
}

/** Devuelve la similitud aproximada de dos nombres en una escala de 0 a 100. */
export function porcentajeCoincidenciaNombre(a: string, b: string): number {
  const nombreA = normalizarNombreTramite(a);
  const nombreB = normalizarNombreTramite(b);
  if (!nombreA || !nombreB) return 0;
  if (nombreA === nombreB) return 100;

  const similitudCaracteres = dice(bigramas(nombreA), bigramas(nombreB));
  const similitudPalabras = dice(
    new Set(nombreA.split(' ')),
    new Set(nombreB.split(' ')),
  );

  return Math.round(
    (similitudCaracteres * 0.7 + similitudPalabras * 0.3) * 100,
  );
}

export const umbralCoincidenciaNombre = UMBRAL_COINCIDENCIA;

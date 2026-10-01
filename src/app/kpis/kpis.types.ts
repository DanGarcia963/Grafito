export interface Filters {
  year: string;
  from: string;
  to: string;
  cutoff: string;
  area: string;
  indicator: string;
  mode: "oficial" | "preliminar";
  comparison: string;
}
export interface Summary {
  expected: number;
  approved: number;
  evaluated: number;
  met: number;
  failed: number;
  pending: number;
  compliance: number | null;
  coverage: number | null;
  preliminaryEvaluated: number;
  preliminaryCompliance: number | null;
}
export interface Cell {
  start: string;
  end: string;
  due: string;
  resultId: number | null;
  configId: number | null;
  state: string;
  approved: boolean;
  na: boolean;
  valid: boolean;
  eligible: boolean;
  visible: boolean;
  value: number | string | null;
  evaluation: string;
  unit: string;
  target: string;
  min: number | null;
  max: number | null;
  type: string;
  rule: string;
  precision: number;
  version: number | null;
  evidenceCount: number;
  analysis: string | null;
  actions: string | null;
  observations: string | null;
  method: string | null;
  formula: string | null;
  source: string | null;
}
export interface Indicator {
  id: number;
  code: string;
  name: string;
  areaId: number;
  area: string;
  active: boolean;
  objective: string | null;
  cells: Cell[];
  warnings: string[];
}
export interface Dashboard {
  filters: Record<string, unknown>;
  generatedAt: string;
  summary: Summary;
  areas: (Summary & { id: number; name: string })[];
  rows: Indicator[];
  pendingConfiguration: number;
  notes: string[];
  comparison: {
    year: number;
    rows: Indicator[];
    summary: Summary;
    notes: string;
  } | null;
}
export interface Catalog {
  areas: { id: number; name: string }[];
  indicators: { id: number; areaId: number; name: string; active: boolean }[];
  years: number[];
}
export interface Evidence {
  id: number;
  nombre: string;
  mime: string;
  revision: number;
  bytes: string;
  descripcion: string | null;
}
export interface Detail {
  indicador: string;
  area: string;
  responsable: string | null;
  estado: string;
  revision_actual: number;
  configuracion_version: number;
  metodo_calculo: string;
  formula_descriptiva: string | null;
  fuente_datos: string | null;
  datos_base: unknown;
  referencia_origen: unknown;
  observaciones: string | null;
  analisis: string | null;
  acciones_propuestas: string | null;
  capturado_por: string | null;
  capturado_en: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
  history: {
    id_Historial: number;
    revision: number;
    accion: string;
    motivo: string;
    realizado_por: string;
    realizado_en: string;
    datos_revision: unknown;
  }[];
  evidence: Evidence[];
}

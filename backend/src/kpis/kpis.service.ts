import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { buildDashboard, Filters, iso, json, Row } from "./kpis.logic";
import { KpiScope } from "./kpis-access.guard";

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  private permitted(id: number, scope: KpiScope) {
    return scope.all || scope.areas.includes(Number(id));
  }

  private assertArea(id: number, scope: KpiScope) {
    if (!this.permitted(id, scope))
      throw new ForbiddenException("Área no autorizada.");
  }

  private async indicators(scope: KpiScope) {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT i.*, a.nombre AS area
      FROM kpi_indicadores i
      JOIN areas_organizacionales a ON a."id_Area" = i.area_id
      ORDER BY a.nombre, i.nombre
    `;

    return rows.filter((r) => this.permitted(r.area_id, scope));
  }

  async catalog(scope: KpiScope) {
    const indicators = await this.indicators(scope);

    const areas = await this.prisma.$queryRaw<Row[]>`
      SELECT "id_Area" AS id, nombre AS name
      FROM areas_organizacionales
      ORDER BY nombre
    `;

    const years = await this.prisma.$queryRaw<Row[]>`
      SELECT DISTINCT
        indicador_id,
        EXTRACT(YEAR FROM periodo_inicio)::integer AS year
      FROM kpi_resultados
    `;

    const ids = new Set(indicators.map((i) => i.id_Indicador));

    return {
      areas: areas.filter((a) => this.permitted(a.id, scope)),
      indicators: indicators.map((i) => ({
        id: i.id_Indicador,
        areaId: i.area_id,
        name: i.nombre,
        active: !!i.activo,
      })),
      years: [
        ...new Set([
          new Date().getUTCFullYear(),
          ...years
            .filter((y) => ids.has(y.indicador_id))
            .map((y) => Number(y.year)),
        ]),
      ].sort((a, b) => b - a),
    };
  }

  async dashboard(f: Filters, scope: KpiScope) {
    if (f.area) this.assertArea(f.area, scope);

    const indicators = await this.indicators(scope);

    if (f.indicator && !indicators.some((i) => i.id_Indicador === f.indicator))
      throw new NotFoundException("Indicador no disponible.");

    const start = `${f.year - (f.comparison ? 1 : 0)}-01-01`,
      end = `${f.year}-12-31`;

    // Consultas parametrizadas. No requieren modelos KPI generados en Prisma.
    // Sólo metadatos: los binarios se obtienen en el endpoint de evidencia.
    const [configs, results] = await Promise.all([
      this.prisma.$queryRaw<Row[]>`
        SELECT c.*, p.nombre AS responsable
        FROM kpi_configuraciones c
        LEFT JOIN personas p
          ON p."id_Persona" = c.responsable_persona_id
        WHERE c.vigente_desde <= CAST(${end} AS date)
          AND (
            c.vigente_hasta IS NULL
            OR c.vigente_hasta >= CAST(${start} AS date)
          )
      `,
      this.prisma.$queryRaw<Row[]>`
        SELECT r.*,
          (
            SELECT COUNT(*)
            FROM kpi_evidencias e
            JOIN kpi_resultado_historial h
              ON h."id_Historial" = e.historial_id
            WHERE h.resultado_id = r."id_Resultado"
              AND h.revision = r.revision_actual
          ) AS evidencias
        FROM kpi_resultados r
        WHERE r.periodo_inicio >= CAST(${start} AS date)
          AND r.periodo_fin <= CAST(${end} AS date)
      `,
    ]);

    const allowed = new Set(indicators.map((i) => i.id_Indicador));

    const cs = configs.filter((c) => allowed.has(c.indicador_id)),
      rs = results.filter((r) => allowed.has(r.indicador_id));

    const result = buildDashboard(indicators, cs, rs, f);

    const previous = f.comparison
      ? buildDashboard(indicators, cs, rs, {
          ...f,
          year: f.year - 1,
          comparison: false,
        })
      : null;

    return {
      ...result,
      comparison: previous
        ? {
            year: f.year - 1,
            rows: previous.rows,
            summary: previous.summary,
            notes:
              "Mismo rango del año anterior, con estados actuales. No es una fotografía histórica al mismo corte.",
          }
        : null,
    };
  }

  async detail(id: number, scope: KpiScope) {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        r.*,
        i.nombre AS indicador,
        i.area_id,
        a.nombre AS area,
        c.formula_descriptiva,
        c.fuente_datos,
        c.unidad,
        c.version AS configuracion_version,
        c.regla_evaluacion,
        c.meta_minima,
        c.meta_maxima,
        c.meta_opcion,
        c.meta_booleano,
        c.metodo_calculo,
        p.nombre AS responsable
      FROM kpi_resultados r
      JOIN kpi_indicadores i
        ON i."id_Indicador" = r.indicador_id
      JOIN areas_organizacionales a
        ON a."id_Area" = i.area_id
      JOIN kpi_configuraciones c
        ON c."id_Configuracion" = r.configuracion_id
      LEFT JOIN personas p
        ON p."id_Persona" = c.responsable_persona_id
      WHERE r."id_Resultado" = ${id}
    `;

    const r = rows[0];

    if (!r) throw new NotFoundException("Resultado no encontrado.");

    this.assertArea(r.area_id, scope);

    const history = await this.prisma.$queryRaw<Row[]>`
      SELECT
        "id_Historial",
        revision,
        accion,
        datos_revision,
        motivo,
        realizado_por,
        realizado_en
      FROM kpi_resultado_historial
      WHERE resultado_id = ${id}
      ORDER BY revision DESC
    `;

    const evidence = await this.prisma.$queryRaw<Row[]>`
      SELECT
        e."id_Evidencia" AS id,
        e.nombre_original AS nombre,
        e.tipo_mime AS mime,
        e.descripcion,
        e.subido_por,
        e.subido_en,
        h.revision,
        OCTET_LENGTH(e.contenido) AS bytes
      FROM kpi_evidencias e
      JOIN kpi_resultado_historial h
        ON h."id_Historial" = e.historial_id
      WHERE h.resultado_id = ${id}
      ORDER BY h.revision DESC, e."id_Evidencia"
    `;

    return safe({
      ...r,
      datos_base: json(r.datos_base),
      referencia_origen: json(r.referencia_origen),
      history: history.map((h) => ({
        ...h,
        datos_revision: json(h.datos_revision),
      })),
      evidence,
    });
  }

  async evidence(id: number, scope: KpiScope) {
    // Comprobar permiso antes de cargar el binario.
    const info = await this.prisma.$queryRaw<Row[]>`
      SELECT
        e."id_Evidencia",
        e.nombre_original,
        e.tipo_mime,
        i.area_id
      FROM kpi_evidencias e
      JOIN kpi_resultado_historial h
        ON h."id_Historial" = e.historial_id
      JOIN kpi_resultados r
        ON r."id_Resultado" = h.resultado_id
      JOIN kpi_indicadores i
        ON i."id_Indicador" = r.indicador_id
      WHERE e."id_Evidencia" = ${id}
    `;

    if (!info[0]) throw new NotFoundException("Evidencia no encontrada.");

    this.assertArea(info[0].area_id, scope);

    const blobs = await this.prisma.$queryRaw<Row[]>`
      SELECT contenido
      FROM kpi_evidencias
      WHERE "id_Evidencia" = ${id}
    `;

    if (!blobs[0]?.contenido?.length)
      throw new NotFoundException("Archivo vacío o no disponible.");

    return {
      nombre: String(info[0].nombre_original),
      mime: String(info[0].tipo_mime),
      buffer: Buffer.from(blobs[0].contenido),
    };
  }
}

/** Fechas y decimales JSON: mantiene precisión de datos base como texto. */
function safe(value: any): any {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(safe);

  if (typeof value === "object") {
    if (typeof value.toJSON === "function") return value.toJSON();

    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, safe(v)]),
    );
  }

  return value;
}
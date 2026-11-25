import { AuthGuard } from '../auth/auth.guard';
import {
  BadRequestException,
  Controller,
  Body,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { KpisService } from "./kpis.service";
import { KpisCapturaService } from "./kpis-captura.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { parseFilters } from "./kpis.logic";
import type { Row } from "./kpis.logic";
import { KpisAccessGuard } from "./kpis-access.guard";
import type { KpiRequest } from "./kpis-access.guard";
@Controller("api/kpis")
@UseGuards(AuthGuard, KpisAccessGuard)
export class KpisController {
  constructor(private readonly service: KpisService, private readonly captura: KpisCapturaService) {}
  @Get("catalogos")
  @Header("Cache-Control", "private, no-store")
  catalog(@Req() req: KpiRequest) {
    return this.service.catalog(req.kpiScope);
  }
  @Get("dashboard")
  @Header("Cache-Control", "private, no-store")
  dashboard(@Query() q: Row, @Req() req: KpiRequest) {
    let filters;
    try {
      filters = parseFilters(q);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : "Filtros inválidos.",
      );
    }
    return this.service.dashboard(filters, req.kpiScope);
  }
  @Post("capturas-historicas")
  @Header("Cache-Control", "private, no-store")
  @UseInterceptors(FileInterceptor("evidencia", {
    limits: { files: 1, fileSize: 8 * 1024 * 1024 },
  }))
  capturarHistorico(
    @Req() req: KpiRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ) {
    if (!req.usuario) throw new BadRequestException("La sesión expiró.");
    return this.captura.capturar(body, archivo, req.usuario);
  }

  @Post("resultados/:id/aprobar")
  @Header("Cache-Control", "private, no-store")
  aprobarHistorico(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: KpiRequest,
    @Body() body: Record<string, unknown>,
  ) {
    if (!req.usuario) throw new BadRequestException("La sesión expiró.");
    return this.captura.aprobar(id, body, req.usuario);
  }

  @Get("resultados/:id")
  @Header("Cache-Control", "private, no-store")
  detail(@Param("id", ParseIntPipe) id: number, @Req() req: KpiRequest) {
    if (id <= 0) throw new BadRequestException("ID inválido.");
    return this.service.detail(id, req.kpiScope);
  }
  @Get("evidencias/:id/archivo")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async evidence(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: KpiRequest,
  ) {
    if (id <= 0) throw new BadRequestException("ID inválido.");
    const doc = await this.service.evidence(id, req.kpiScope);
    const name = encodeURIComponent(
      doc.nombre.replace(/[\r\n\x00-\x1f\x7f]/g, ""),
    ).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16));
    const pdf = doc.buffer.subarray(0, 5).toString() === "%PDF-";
    return new StreamableFile(doc.buffer, {
      type: pdf ? "application/pdf" : "application/octet-stream",
      length: doc.buffer.length,
      disposition: `${pdf ? "inline" : "attachment"}; filename="evidencia-${id}${pdf ? ".pdf" : ""}"; filename*=UTF-8''${name}`,
    });
  }
}

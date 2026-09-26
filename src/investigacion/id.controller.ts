import { Controller, Get, Post, Put, Body, Req, Res, Param, Query, ParseIntPipe, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import 'multer';
import { Areas, AuthGuard } from '../auth/auth.guard';
import { InvestigacionService } from './id.service';
@Controller('api/investigacion')
@UseGuards(AuthGuard)
@Areas('id','ventas')
export class InvestigacionController {
 constructor(private servicio:InvestigacionService){}
 @Get('catalogos') catalogos(){return this.servicio.catalogos();}
 @Get('referencias') referencias(@Query('q') q:string){return this.servicio.referencias(q);}
 @Areas('id') @Put('catalogos/proceso') procesoCatalogo(@Body() body:any,@Req() req:any){return this.servicio.guardarCatalogo('proceso',body,req.usuario);}
 @Areas('id') @Put('catalogos/viabilidad') viabilidad(@Body() body:any,@Req() req:any){return this.servicio.guardarCatalogo('viabilidad',body,req.usuario);}
 @Areas('ventas') @Post('muestras') @UseInterceptors(FileInterceptor('ficha',{limits:{fileSize:10*1024*1024,files:1}}))
 crear(@Body() body:any,@UploadedFile() ficha:any,@Req() req:any){return this.servicio.crear(body,ficha,req.usuario);}
 @Get('muestras') listar(@Req() req:any,@Query('pagina') pagina:string){return this.servicio.listar(req.usuario,pagina);}
 @Get('muestras/:id') detalle(@Param('id',ParseIntPipe) id:number,@Req() req:any){return this.servicio.detalle(id,req.usuario);}
 @Get('muestras/:id/ficha') async ficha(@Param('id',ParseIntPipe) id:number,@Req() req:any,@Res() res:Response){const f=await this.servicio.ficha(id,req.usuario);res.setHeader('Content-Type',f.ficha_mime!);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.ficha_nombre!)}`);res.send(Buffer.from(f.ficha_contenido!));}
 @Areas('id') @Post('muestras/:id/plan') plan(@Param('id',ParseIntPipe) id:number,@Body() body:any,@Req() req:any){return this.servicio.planificar(id,body,req.usuario);}
 @Areas('id') @Post('muestras/:id/recibir') recibir(@Param('id',ParseIntPipe) id:number,@Req() req:any){return this.servicio.recibir(id,req.usuario);}
 @Areas('id') @Post('muestras/:id/procesos/:ejecucion/iniciar') iniciar(@Param('id',ParseIntPipe) id:number,@Param('ejecucion',ParseIntPipe) e:number,@Req() req:any){return this.servicio.proceso(id,e,'iniciar',{},req.usuario);}
 @Areas('id') @Post('muestras/:id/procesos/:ejecucion/terminar') terminar(@Param('id',ParseIntPipe) id:number,@Param('ejecucion',ParseIntPipe) e:number,@Body() body:any,@Req() req:any){return this.servicio.proceso(id,e,'terminar',body,req.usuario);}
 @Areas('id') @Post('muestras/:id/finalizar') finalizar(@Param('id',ParseIntPipe) id:number,@Body() body:any,@Req() req:any){return this.servicio.finalizar(id,body,req.usuario);}
 @Areas('id') @Get('reporte') reporte(@Query() q:{desde?:string;hasta?:string;pagina?:string}){return this.servicio.reporte(q);}
}

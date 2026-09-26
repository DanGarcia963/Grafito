import { Global, Module, Controller, Post, Body, Req, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
@Controller('api/auth')
class AuthController {
 constructor(private auth:AuthService){}
 @Post('login') login(@Body() body:any,@Req() req:any){return this.auth.login(body,req.ip||'local');}
 @UseGuards(AuthGuard) @Get('sesion') sesion(@Req() req:any){return req.usuario;}
 @UseGuards(AuthGuard) @Post('salir') salir(@Req() req:any){return this.auth.salir(String(req.headers.authorization).replace(/^Bearer /,''));}
}
@Global()
@Module({providers:[AuthService,AuthGuard],exports:[AuthService,AuthGuard],controllers:[AuthController]})
export class AuthModule {}

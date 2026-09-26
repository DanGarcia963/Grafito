import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from './auth/auth.service';
@WebSocketGateway({cors:{origin:true,methods:['GET','POST']}})
export class EventsGateway implements OnGatewayConnection {
 @WebSocketServer() server!:Server;
 constructor(private auth:AuthService){}
 handleConnection(client:Socket){
  try {
   const token=client.handshake.auth?.token,usuario=this.auth.verificar(token);
   client.join(usuario.area);
   // Revisar revocación y caducidad durante la conexión; no solo al conectarse.
   const check=setInterval(()=>{try{this.auth.verificar(token);}catch{client.disconnect(true);}},15000);
   client.once('disconnect',()=>clearInterval(check));
  }catch{client.disconnect(true);}
 }
 notificar(evento:string,data:unknown){
  const areas=evento.startsWith('ID_')?['id','ventas']:['calidad','produccion'];
  // Las pantallas recuperan datos autorizados desde el API al recibir esta señal.
  this.server?.to(areas).emit(evento,data);
  this.server?.to(areas).emit(evento.startsWith('ID_')?'ID_TRAZABILIDAD_ACTUALIZADA':'TRAZABILIDAD_ACTUALIZADA',data);
 }
}

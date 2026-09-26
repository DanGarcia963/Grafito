'use client';
import { createContext,useContext,useEffect,useState } from 'react';
import { io,Socket } from 'socket.io-client';
import { API_URL,sesionActual } from '@/utils/api';
const Context=createContext<Socket|null>(null);
export function SocketProvider({children}:{children:React.ReactNode}){
 const [socket,setSocket]=useState<Socket|null>(null);
 useEffect(()=>{
  let actual:Socket|null=null;
  const conectar=()=>{actual?.disconnect();const token=sesionActual()?.token;
   actual=token?io(API_URL,{auth:{token},transports:['polling','websocket'],reconnection:true}):null;setSocket(actual);};
  conectar();window.addEventListener('sesion-cambiada',conectar);window.addEventListener('storage',conectar);
  return()=>{actual?.disconnect();window.removeEventListener('sesion-cambiada',conectar);window.removeEventListener('storage',conectar);};
 },[]);
 return <Context.Provider value={socket}>{children}</Context.Provider>;
}
export const useSocket=()=>useContext(Context);

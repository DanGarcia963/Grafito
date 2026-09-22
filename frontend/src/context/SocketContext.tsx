'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

// Asegúrate de que esta IP sea la correcta de tu máquina servidor
const BACKEND_IP = '192.168.100.185'; 

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketInstance = io(`http://${BACKEND_IP}:4002`, {
      transports: ['websocket'], // Forzar transporte WebSocket directo
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      console.log('✅ Conectado al servidor WebSocket:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('❌ Error de conexión Socket.io:', err.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
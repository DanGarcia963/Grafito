// frontend/src/app/lotes/page.tsx
'use client';

import { useSocket } from '@/context/SocketContext';
import { useEffect, useState } from 'react';

export default function LotesPage() {
  const socket = useSocket();
  const [mensajes, setMensajes] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Escuchar evento de actualización de estado
    socket.on('LOTE_ESTADO_CAMBIADO', (data) => {
      setMensajes((prev) => [...prev, `[PROCESO]: ${data.noLote} -> ${data.mensaje}`]);
    });

    // Escuchar evento de lote finalizado
    socket.on('LOTE_CREADO', (lote) => {
      setMensajes((prev) => [...prev, `[ÉXITO]: Lote ${lote.noLote} creado con estado ${lote.estado}`]);
    });

    return () => {
      socket.off('LOTE_ESTADO_CAMBIADO');
      socket.off('LOTE_CREADO');
    };
  }, [socket]);

  const handleCrear = () => {
    if (socket) {
      socket.emit('crear_lote', { noLote: `LOTE-PROD-${Date.now().toString().slice(-4)}` });
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Módulo de Lotes con BullMQ + WebSockets</h1>
      <button onClick={handleCrear}>Crear Lote (Segundo plano)</button>

      <h3>Notificaciones en tiempo real:</h3>
      <ul>
        {mensajes.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
// frontend/src/components/EtiquetaLote.tsx
'use client';

import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface EtiquetaDatos {
  noLote: string;
  producto: string;
  operador: string;
  fechaFabricacion: string;
  estadoCalidad: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
}

interface Props {
  datos: EtiquetaDatos;
}

export const EtiquetaLote = forwardRef<HTMLDivElement, Props>(({ datos }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: '100mm',
        height: '70mm',
        padding: '10px',
        border: '2px solid #000',
        backgroundColor: '#fff',
        fontFamily: 'Arial, sans-serif',
        color: '#000',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Encabezado */}
      <div style={{ borderBottom: '2px solid #000', paddingBottom: '4px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          CONTROL DE CALIDAD Y LOTE
        </h2>
      </div>

      {/* Cuerpo principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <p style={{ margin: 0 }}><strong>Lote:</strong> {datos.noLote || 'N/A'}</p>
          <p style={{ margin: 0 }}><strong>Producto:</strong> {datos.producto || 'N/A'}</p>
          <p style={{ margin: 0 }}><strong>Operador:</strong> {datos.operador || 'N/A'}</p>
          <p style={{ margin: 0 }}><strong>Fecha:</strong> {datos.fechaFabricacion || 'N/A'}</p>
          <p style={{ margin: '4px 0 0 0' }}>
            <strong>Estado: </strong>
            <span style={{ 
              fontWeight: 'bold', 
              color: datos.estadoCalidad === 'APROBADO' ? 'green' : 'black' 
            }}>
              {datos.estadoCalidad}
            </span>
          </p>
        </div>

        {/* Código QR con los datos del lote */}
        <div style={{ textAlign: 'center' }}>
          <QRCodeSVG 
            value={JSON.stringify({ lote: datos.noLote, status: datos.estadoCalidad })} 
            size={70} 
          />
        </div>
      </div>

      {/* Pie de etiqueta */}
      <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '9px', textAlign: 'center' }}>
        Sistema Digital de Planta — Verificación Manual Requerida
      </div>
    </div>
  );
});

EtiquetaLote.displayName = 'EtiquetaLote';
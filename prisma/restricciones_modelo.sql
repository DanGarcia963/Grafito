-- COMPLEMENTO del modelo objetivo, NO migración desde la base actual.
-- Ejecutar solo DESPUÉS de crear/adaptar las tablas del schema.prisma entregado.
-- No crea ni borra tablas. No modifica Legal ni KPI.
-- No incluye permisos/RLS ni operaciones transaccionales de negocio.
BEGIN;
ALTER TABLE "crm_perfiles_comerciales" ADD CONSTRAINT "ck_crm_perfiles_comerciales_frecuencia" CHECK (frecuencia_esperada_dias IS NULL OR frecuencia_esperada_dias > 0);
ALTER TABLE "crm_cotizaciones" ADD CONSTRAINT "ck_crm_cotizaciones_cantidad" CHECK (cantidad > 0);
ALTER TABLE "crm_cotizaciones" ADD CONSTRAINT "ck_crm_cotizaciones_version" CHECK (version > 0);
ALTER TABLE "crm_cotizaciones" ADD CONSTRAINT "ck_crm_cotizaciones_importes" CHECK (subtotal >= 0 AND impuestos >= 0 AND total > 0 AND total = subtotal + impuestos);
ALTER TABLE "crm_ordenes_venta" ADD CONSTRAINT "ck_crm_ordenes_venta_cantidad" CHECK (cantidad > 0);
ALTER TABLE "crm_ordenes_venta" ADD CONSTRAINT "ck_crm_ordenes_venta_importes" CHECK (subtotal >= 0 AND impuestos >= 0 AND importe_total > 0 AND importe_total = subtotal + impuestos);
ALTER TABLE "crm_ordenes_venta" ADD CONSTRAINT "ck_crm_ordenes_venta_cancelacion" CHECK ((estado = 'CANCELADA' AND fecha_cancelacion IS NOT NULL AND NULLIF(btrim(motivo_cancelacion),'') IS NOT NULL) OR (estado = 'CONFIRMADA' AND fecha_cancelacion IS NULL));
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ck_ordenes_produccion_cantidad" CHECK ("cantidad_Planificada" > 0);
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ck_ordenes_produccion_fechas" CHECK ("fecha_Termino_Plan" IS NULL OR "fecha_Inicio_Plan" IS NULL OR "fecha_Termino_Plan" >= "fecha_Inicio_Plan");
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ck_ordenes_produccion_cierre" CHECK ("fecha_Termino_Real" IS NULL OR ("fecha_Inicio_Produccion" IS NOT NULL AND "fecha_Termino_Real" >= "fecha_Inicio_Produccion"));
ALTER TABLE "lotes_produccion" ADD CONSTRAINT "ck_lotes_produccion_fechas" CHECK (fecha_fin IS NULL OR (fecha_inicio IS NOT NULL AND fecha_fin >= fecha_inicio));
ALTER TABLE "equipos_tanques" ADD CONSTRAINT "ck_equipos_tanques_capacidad" CHECK (capacidad > 0);
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "ck_lotes_inventario_propietario" CHECK ((propiedad = 'PROPIO' AND propietario_id IS NULL) OR (propiedad = 'DE_CLIENTE' AND propietario_id IS NOT NULL));
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "ck_lotes_inventario_origen" CHECK ((origen = 'RECEPCION' AND recepcion_id IS NOT NULL AND lote_produccion_id IS NULL) OR (origen = 'PRODUCCION' AND lote_produccion_id IS NOT NULL AND recepcion_id IS NULL) OR (origen = 'APERTURA' AND recepcion_id IS NULL AND lote_produccion_id IS NULL));
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "ck_lotes_inventario_calidad" CHECK ((origen = 'PRODUCCION' AND estado_calidad_recepcion IS NULL AND liberado_por IS NULL AND liberado_en IS NULL) OR (origen <> 'PRODUCCION' AND estado_calidad_recepcion IS NOT NULL));
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "ck_lotes_inventario_compra" CHECK (requisicion_compra_id IS NULL OR (origen = 'RECEPCION' AND propiedad = 'PROPIO'));
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "ck_lotes_inventario_venta_origen" CHECK (orden_venta_id IS NULL OR (origen = 'RECEPCION' AND propiedad = 'DE_CLIENTE'));
ALTER TABLE "inventario_ubicaciones" ADD CONSTRAINT "ck_inventario_ubicaciones_tanque" CHECK ((tipo='TANQUE' AND tanque_id IS NOT NULL) OR (tipo<>'TANQUE' AND tanque_id IS NULL));
ALTER TABLE "inventario_reservas" ADD CONSTRAINT "ck_inventario_reservas_cantidad" CHECK (cantidad > 0);
ALTER TABLE "inventario_reservas" ADD CONSTRAINT "ck_inventario_reservas_cierre" CHECK ((estado='ACTIVA' AND cerrado_en IS NULL) OR (estado<>'ACTIVA' AND cerrado_en IS NOT NULL));
ALTER TABLE "entrega_materiales" ADD CONSTRAINT "ck_entrega_materiales_cantidad" CHECK (cantidad > 0);
ALTER TABLE "entrega_materiales" ADD CONSTRAINT "ck_entrega_materiales_recibida" CHECK (cantidad_recibida IS NULL OR (cantidad_recibida >= 0 AND cantidad_recibida <= cantidad));
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "ck_movimientos_inventario_cantidad" CHECK (cantidad > 0);
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "ck_movimientos_inventario_ubicaciones" CHECK ((ubicacion_origen_id IS NOT NULL OR ubicacion_destino_id IS NOT NULL) AND (ubicacion_origen_id IS NULL OR ubicacion_destino_id IS NULL OR ubicacion_origen_id <> ubicacion_destino_id));
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "ck_movimientos_inventario_direccion" CHECK ((tipo IN ('ENTRADA_RECEPCION','ENTRADA_PRODUCCION','APERTURA','AJUSTE_ENTRADA') AND ubicacion_origen_id IS NULL AND ubicacion_destino_id IS NOT NULL) OR (tipo IN ('SALIDA_CONSUMO','SALIDA_ENTREGA','SALIDA_RESIDUO','MERMA','AJUSTE_SALIDA') AND ubicacion_origen_id IS NOT NULL AND ubicacion_destino_id IS NULL) OR (tipo='TRANSFERENCIA' AND ubicacion_origen_id IS NOT NULL AND ubicacion_destino_id IS NOT NULL) OR tipo='REVERSION');
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "ck_movimientos_inventario_reversion" CHECK ((tipo='REVERSION' AND reversa_de_id IS NOT NULL AND reversa_de_id <> "id_Movi_Invent") OR (tipo<>'REVERSION' AND reversa_de_id IS NULL));
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "ck_movimientos_inventario_referencias" CHECK ((tipo='SALIDA_CONSUMO' AND lote_produccion_id IS NOT NULL AND reserva_id IS NOT NULL AND entrega_material_id IS NULL AND control_residuo_id IS NULL) OR (tipo='ENTRADA_PRODUCCION' AND lote_produccion_id IS NOT NULL AND reserva_id IS NULL AND entrega_material_id IS NULL AND control_residuo_id IS NULL) OR (tipo='SALIDA_ENTREGA' AND entrega_material_id IS NOT NULL AND lote_produccion_id IS NULL AND reserva_id IS NULL AND control_residuo_id IS NULL) OR (tipo='SALIDA_RESIDUO' AND control_residuo_id IS NOT NULL AND lote_produccion_id IS NULL AND reserva_id IS NULL AND entrega_material_id IS NULL) OR (tipo IN ('ENTRADA_RECEPCION','TRANSFERENCIA','MERMA','AJUSTE_ENTRADA','AJUSTE_SALIDA','APERTURA') AND lote_produccion_id IS NULL AND reserva_id IS NULL AND entrega_material_id IS NULL AND control_residuo_id IS NULL) OR (tipo='REVERSION' AND lote_produccion_id IS NULL AND reserva_id IS NULL AND entrega_material_id IS NULL AND control_residuo_id IS NULL));
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "ck_movimientos_inventario_motivo" CHECK (tipo NOT IN ('AJUSTE_ENTRADA','AJUSTE_SALIDA','MERMA','REVERSION','APERTURA') OR NULLIF(btrim(motivo),'') IS NOT NULL);
ALTER TABLE "facturas_venta" ADD CONSTRAINT "ck_facturas_venta_importes" CHECK (subtotal >= 0 AND impuestos >= 0 AND total > 0 AND total = subtotal + impuestos);
ALTER TABLE "facturas_venta" ADD CONSTRAINT "ck_facturas_venta_cancelacion" CHECK ((estado='CANCELADA' AND cancelado_en IS NOT NULL AND NULLIF(btrim(motivo_cancelacion),'') IS NOT NULL) OR (estado='REGISTRADA' AND cancelado_en IS NULL));
ALTER TABLE "pagos_venta" ADD CONSTRAINT "ck_pagos_venta_importe" CHECK (importe > 0);
ALTER TABLE "pagos_venta" ADD CONSTRAINT "ck_pagos_venta_confirmado" CHECK (estado <> 'CONFIRMADO' OR (confirmado_en IS NOT NULL AND NULLIF(btrim(confirmado_por),'') IS NOT NULL));
ALTER TABLE "pagos_venta" ADD CONSTRAINT "ck_pagos_venta_anulado" CHECK ((estado='ANULADO' AND anulado_en IS NOT NULL AND NULLIF(btrim(motivo_anulacion),'') IS NOT NULL) OR (estado<>'ANULADO' AND anulado_en IS NULL));
ALTER TABLE "aplicaciones_pago" ADD CONSTRAINT "ck_aplicaciones_pago_importe" CHECK (importe > 0);
ALTER TABLE "aplicaciones_pago" ADD CONSTRAINT "ck_aplicaciones_pago_anulacion" CHECK (anulado_en IS NULL OR NULLIF(btrim(motivo_anulacion),'') IS NOT NULL);

-- Solo una versión comercial activa y un reporte publicado por oportunidad.
CREATE UNIQUE INDEX uq_reporte_publicado_por_oportunidad ON id_reportes_oportunidad(oportunidad_id) WHERE estado = 'PUBLICADO';
CREATE UNIQUE INDEX uq_cotizacion_activa_por_oportunidad ON crm_cotizaciones(oportunidad_id) WHERE estado IN ('BORRADOR','ENVIADA','ACEPTADA');
COMMIT;

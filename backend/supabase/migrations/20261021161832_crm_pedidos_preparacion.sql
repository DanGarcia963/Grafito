CREATE TYPE "crm_pedido_preparacion_estado" AS ENUM (
  'ENVIADO',
  'RECIBIDO',
  'EN_PREPARACION',
  'PARCIAL',
  'PREPARADO',
  'CANCELADO'
);

CREATE TABLE "crm_pedidos_preparacion" (
  "id" SERIAL NOT NULL,
  "folio" VARCHAR(50) NOT NULL,
  "cliente_id" INTEGER NOT NULL,
  "vendedor_id" INTEGER NOT NULL,
  "estado" "crm_pedido_preparacion_estado" NOT NULL DEFAULT 'ENVIADO',
  "fecha_requerida" DATE,
  "observaciones" TEXT,
  "respuesta_produccion" TEXT,
  "actualizado_produccion_por" VARCHAR(100),
  "recibido_en" TIMESTAMPTZ(6),
  "preparado_en" TIMESTAMPTZ(6),
  "creado_por" VARCHAR(100) NOT NULL,
  "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "crm_pedidos_preparacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_crm_pedido_preparacion_folio" UNIQUE ("folio"),
  CONSTRAINT "fk_crm_pedido_preparacion_cliente"
    FOREIGN KEY ("cliente_id") REFERENCES "personas"("id_Persona") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fk_crm_pedido_preparacion_vendedor"
    FOREIGN KEY ("vendedor_id") REFERENCES "personas"("id_Persona") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "crm_pedidos_preparacion_detalles" (
  "id" SERIAL NOT NULL,
  "pedido_id" INTEGER NOT NULL,
  "producto_id" INTEGER NOT NULL,
  "tipo_prensa" VARCHAR(80),
  "cantidad_solicitada" DECIMAL(18,4) NOT NULL,
  "contenedores_solicitados" INTEGER,
  "peso_estimado_contenedor" DECIMAL(18,4),
  "cantidad_preparada" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "observaciones" TEXT,
  CONSTRAINT "crm_pedidos_preparacion_detalles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_crm_pedido_detalle_cantidad_solicitada" CHECK ("cantidad_solicitada" > 0),
  CONSTRAINT "ck_crm_pedido_detalle_contenedores" CHECK ("contenedores_solicitados" IS NULL OR "contenedores_solicitados" > 0),
  CONSTRAINT "ck_crm_pedido_detalle_peso_contenedor" CHECK ("peso_estimado_contenedor" IS NULL OR "peso_estimado_contenedor" > 0),
  CONSTRAINT "ck_crm_pedido_detalle_cantidad_preparada" CHECK ("cantidad_preparada" >= 0),
  CONSTRAINT "fk_crm_pedido_preparacion_detalle_pedido"
    FOREIGN KEY ("pedido_id") REFERENCES "crm_pedidos_preparacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fk_crm_pedido_preparacion_detalle_producto"
    FOREIGN KEY ("producto_id") REFERENCES "productos_materiales"("id_Produc_Mater") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_crm_pedido_preparacion_estado_fecha"
  ON "crm_pedidos_preparacion"("estado", "creado_en");
CREATE INDEX "idx_crm_pedido_preparacion_vendedor_estado"
  ON "crm_pedidos_preparacion"("vendedor_id", "estado");
CREATE INDEX "idx_crm_pedido_preparacion_cliente_fecha"
  ON "crm_pedidos_preparacion"("cliente_id", "creado_en");
CREATE INDEX "idx_crm_pedido_preparacion_detalle_pedido"
  ON "crm_pedidos_preparacion_detalles"("pedido_id");
CREATE INDEX "idx_crm_pedido_preparacion_detalle_producto_prensa"
  ON "crm_pedidos_preparacion_detalles"("producto_id", "tipo_prensa");

ALTER TABLE "crm_ordenes_venta"
  ADD COLUMN "pedido_preparacion_detalle_id" INTEGER,
  ADD CONSTRAINT "fk_crm_orden_venta_pedido_detalle"
    FOREIGN KEY ("pedido_preparacion_detalle_id")
    REFERENCES "crm_pedidos_preparacion_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_crm_ov_pedido_preparacion_detalle"
  ON "crm_ordenes_venta"("pedido_preparacion_detalle_id");

-- Estas tablas se operan mediante NestJS/Prisma con el usuario autenticado del sistema.
-- No se habilita acceso directo a las filas desde Supabase Data API.
ALTER TABLE "crm_pedidos_preparacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_pedidos_preparacion_detalles" ENABLE ROW LEVEL SECURITY;

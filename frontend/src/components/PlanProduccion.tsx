"use client";
import { useEffect, useState } from "react";
import { pedir } from "@/utils/api";
export default function PlanProduccion({
  venta,
  onDone,
  onClose,
}: {
  venta?: any;
  onDone: () => void;
  onClose: () => void;
}) {
  const [stock, setStock] = useState<any[]>([]),
    [cat, setCat] = useState<any>({ productos: [], personas: [] }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([
      pedir(
        venta
          ? `/api/ventas/crm/ordenes/${venta.id}/materiales`
          : "/api/produccion/existencias",
        undefined,
        "GET",
      ),
      pedir("/api/produccion/catalogos", undefined, "GET"),
    ])
      .then(([s, c]) => {
        setStock(s.data.filter((x: any) => Number(x.disponible) > 0));
        setCat(c);
      })
      .catch((e) => setError(e.message));
  }, [venta]);
  return (
    <section className="p-5 border rounded-xl bg-white text-slate-900">
      <h2 className="font-bold">
        Crear orden de producción{" "}
        {venta ? `para OV #${venta.id}` : "independiente"}
      </h2>
      <p>
        Reserva todos los materiales requeridos. Cada ejecución del tanque
        consumirá parte de esta reserva.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await pedir(
              venta
                ? `/api/ventas/crm/ordenes/${venta.id}/produccion`
                : "/api/produccion/ordenes",
              {
                ...Object.fromEntries(f),
                materiales_completos: true,
                materiales: stock
                  .map((s, i) => ({ ...s, cantidad: f.get(`material-${i}`) }))
                  .filter((s) => Number(s.cantidad) > 0),
              },
            );
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="grid gap-3 mt-3">
          <label>
            Folio OP{" "}
            <input
              required
              name="no_Orden_Produc"
              maxLength={50}
              className="border p-2"
            />
          </label>
          {!venta && (
            <label>
              Producto{" "}
              <select required name="producto_id" className="border p-2">
                <option value="">Selecciona</option>
                {cat.productos.map((p: any) => (
                  <option key={p.id_Produc_Mater} value={p.id_Produc_Mater}>
                    {p.nombre_Producto} · {p.UM}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Cantidad planificada {venta?.unidad}
            <input
              required
              type="number"
              step="0.0001"
              min="0.0001"
              name="cantidad"
              className="border p-2"
            />
          </label>
          <label>
            Operación técnica{" "}
            <input
              required
              name="tipo_Operacion"
              maxLength={100}
              className="border p-2"
            />
          </label>
          <label>
            Línea{" "}
            <input
              required
              name="linea_Produccion"
              defaultValue="GRAFITO"
              className="border p-2"
            />
          </label>
          <label>
            Responsable{" "}
            <select required name="responsable_id" className="border p-2">
              <option value="">Selecciona</option>
              {cat.personas.map((p: any) => (
                <option key={p.id_Persona} value={p.id_Persona}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <h3 className="font-bold">Materiales liberados disponibles</h3>
          {stock.map((s, i) => (
            <label key={`${s.lote_inventario_id}:${s.ubicacion_id}`}>
              {s.folio} · {s.producto} · {s.ubicacion} · {s.propiedad} ·
              disponible {s.disponible} {s.unidad}
              <input
                aria-label={`Reservar ${s.folio}`}
                name={`material-${i}`}
                type="number"
                min="0"
                max={s.disponible}
                step="0.0001"
                defaultValue="0"
                className="border p-2 ml-2"
              />
            </label>
          ))}
          {!stock.length && (
            <p>
              No hay materiales liberados disponibles. Registra su recepción y
              dictamen antes de planificar.
            </p>
          )}
          <label>
            <input required type="checkbox" /> Confirmo que la selección incluye
            todos los materiales necesarios.
          </label>
          <div>
            <button disabled={!stock.length} className="border p-2">
              {busy ? "Guardando…" : "Crear y reservar"}
            </button>
            <button type="button" onClick={onClose} className="border p-2 ml-2">
              Cerrar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

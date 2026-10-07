"use client";
import { useState } from "react";

type Config = {
  campos?: {
    clave: string;
    etiqueta: string;
    opciones: string[];
    requerido?: boolean;
  }[];
  peso_min_kg?: number;
  peso_max_kg?: number;
};
export default function EspecificacionesMaterial({
  config,
  unidad,
}: {
  config?: Config | null;
  unidad?: string;
}) {
  const [atributos, setAtributos] = useState<Record<string, string>>({});
  const [contenedores, setContenedores] = useState<
    { codigo: string; peso_kg: string }[]
  >([]);
  return (
    <section className="border border-slate-500 rounded-xl p-4 grid gap-3">
      <h3 className="font-bold">Especificaciones del material</h3>
      <input
        type="hidden"
        name="especificaciones"
        value={JSON.stringify({ version: 1, atributos, contenedores })}
      />
      {(config?.campos ?? []).map((c) => (
        <label key={c.clave}>
          {c.etiqueta}
          <select
            className="block w-full p-2 bg-transparent border rounded"
            required={c.requerido}
            value={atributos[c.clave] ?? ""}
            onChange={(e) =>
              setAtributos({ ...atributos, [c.clave]: e.target.value })
            }
          >
            <option value="">Selecciona</option>
            {c.opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      ))}
      {unidad === "Kilogramos" && (
        <>
          <p>
            Registra el peso real de cada contenedor en kg. Su suma debe
            coincidir con la cantidad total. El detalle describe esta entrada;
            los consumos posteriores se controlan por kg del lote.
          </p>
          {contenedores.map((c, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                aria-label={`Identificador contenedor ${i + 1}`}
                placeholder="Identificador"
                required
                maxLength={100}
                className="border bg-transparent p-2"
                value={c.codigo}
                onChange={(e) =>
                  setContenedores(
                    contenedores.map((x, j) =>
                      j === i ? { ...x, codigo: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                aria-label={`Peso kg contenedor ${i + 1}`}
                placeholder="Peso kg"
                required
                type="number"
                step="0.0001"
                min={config?.peso_min_kg ?? 0.0001}
                max={config?.peso_max_kg}
                className="border bg-transparent p-2"
                value={c.peso_kg}
                onChange={(e) =>
                  setContenedores(
                    contenedores.map((x, j) =>
                      j === i ? { ...x, peso_kg: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  setContenedores(contenedores.filter((_, j) => j !== i))
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <p>
            {contenedores.length} contenedores ·{" "}
            {contenedores
              .reduce((a, c) => a + Number(c.peso_kg), 0)
              .toLocaleString("es-MX")}{" "}
            kg
          </p>
          <button
            type="button"
            disabled={contenedores.length >= 500}
            className="border p-2 rounded"
            onClick={() =>
              setContenedores([
                ...contenedores,
                { codigo: `C${contenedores.length + 1}`, peso_kg: "" },
              ])
            }
          >
            Añadir contenedor
          </button>
        </>
      )}
    </section>
  );
}

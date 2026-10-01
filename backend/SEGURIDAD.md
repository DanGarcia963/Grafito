# Matriz legal y KPIs — Seguridad

La sesión del área `seguridad` abre `/matriz`. Ambas pantallas comparten navegación a `/matriz` y `/kpis`, verificación de sesión y cierre de sesión. `/seguridad` redirige a `/matriz`.

Las API `/api/seguridad/*` y `/api/kpis/*` requieren el token Bearer existente y una sesión del área Seguridad. Seguridad consulta los indicadores de todas las áreas. La matriz conserva el catálogo, listado, registro con PDF y descarga del módulo original; KPIs conserva sus filtros, comparativas, detalle y evidencias. Los eventos de trámites se publican desde el servidor únicamente a Seguridad.

## Railway

- Mantener `DATABASE_URL` y `DIRECT_URL` de PostgreSQL/Supabase en el backend.
- `CORS_ORIGINS=https://siust.netlify.app` (añadir otros orígenes existentes separados por comas si se utilizan).
- Para habilitar la cuenta, ejecutar desde backend `node scripts/crear-cuenta.cjs seguridad ID_PERSONA seguridad`, sustituyendo `ID_PERSONA` por un ID real de `personas`.
- Agregar el objeto generado al arreglo de `UST_USUARIOS_JSON` sin borrar las cuentas existentes. Entregar la contraseña por un medio privado; no subirla a Git.
- Para una cuenta existente, se puede agregar `seguridad` a su arreglo `areas`, conservando su hash y salt.
- Compilar antes de iniciar: `npx prisma generate && npm run build`; inicio `npm run start:prod`. Las sesiones actuales viven en memoria y se pierden al reiniciar el servicio.

## Netlify

- Rama `frontend-deploy`, directorio base raíz de esa rama.
- `NEXT_PUBLIC_API_URL=https://grafito-production.up.railway.app`.
- Build `npm run build`, publicación `.next`, usando la integración Next.js existente.
- Reconstruir al cambiar la variable pública. No colocar claves de base de datos en el frontend.

## Validación local

Backend: `npx prisma generate`, `npm run build`, `node --test test/seguridad.integration.cjs`.
Frontend: `npm run build`.

La prueba de integración usa Prisma simulado: valida sesiones, restricciones por área, endpoints y entrega de PDF sin modificar Supabase. El schema existente ya contiene los modelos KPI y legales; esta integración no ejecuta migraciones ni carga datos. Confirmar las operaciones con datos reales después del despliegue.

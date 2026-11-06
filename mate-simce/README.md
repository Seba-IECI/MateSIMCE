# Aplicación MateSIMCE

Los comandos se ejecutan desde esta carpeta; la raíz de Git está un nivel arriba.

Consulta el [README principal](../README.md) para funcionalidades actuales, Node.js 22, instalación con `npm ci`, variables de entorno, arquitectura, CI y preparación de Vercel.

- `npm run dev`: desarrollo en http://localhost:3000.
- `npm run lint` y `npm run typecheck`: calidad y tipos.
- `npm test` y `npm run test:node`: regresiones locales sin servicios remotos.
- `npm run build` y `npm run start`: versión de producción.
- [tests/README.md](tests/README.md): evidencias unitarias, integración y Cypress.

Los SQL base de `supabase/schema.sql` y `seed.sql` pertenecen a un modelo anterior; no ejecutarlos sobre la base actual. El banco y las soluciones permanecen en directorios privados ignorados.

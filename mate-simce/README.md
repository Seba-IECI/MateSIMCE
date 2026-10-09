# MateSIMCE


Aplicacion web en Next.js para apoyar el aprendizaje de matematica de segundo
medio en Chile y la preparacion para el SIMCE mediante un tutor con IA.


## Stack
Jamstack serverless:

- Next.js 16 con App Router, TypeScript y Tailwind CSS 4
- shadcn/ui para componentes de interfaz
- Supabase para autenticacion, PostgreSQL y almacenamiento futuro de vectores
- Vercel AI SDK con Google Gemini
- KaTeX mediante `react-katex` para expresiones matematicas


## Instalacion local

Desde esta carpeta:

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Variables de entorno

Archivo `.env` en la raiz del proyecto. 

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```


Las variables `NEXT_PUBLIC_*` son necesarias para el cliente de Supabase.
`GEMINI_API_KEY` debe utilizarse unicamente en codigo del servidor y nunca debe
tener el prefijo `NEXT_PUBLIC_`.

## Modelo de acceso y datos

Solo profesores y administradores tienen cuentas en Supabase Auth. Los estudiantes
se representan como participantes con códigos estables y credenciales privadas;
las sesiones de acceso son temporales y el historial se conserva por participante.
El flujo de ingreso y las rutas de servidor todavía deben implementarse.

Consulta [supabase/README.md](supabase/README.md) para el contrato de sesiones,
los permisos y el plan de adaptación de la base existente.
`supabase/schema.sql` es exclusivo para bases nuevas: no ejecutarlo sobre la base
actual. No hay una migración verificada para esa instancia.


## Carpetas principales

- app/
  - api/
    - auth/
    - exercises/
    - tutor/
  - dashboard/
  - ejercicios/
- components/
  - ui/
  - dashboard/
  - tutor/
- lib/
  - ai/
  - math/
  - services/
- supabase/
- types/

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run lint     # comprobacion de ESLint
npm run build    # compilacion de produccion
npm run start    # servidor de produccion
```


## Repositorio y sincronizacion con GitHub

El repositorio es https://github.com/Seba-IECI/MateSIMCE. Su raiz local es
`Tesis/MateSIMCE`; la aplicacion esta en `Tesis/MateSIMCE/mate-simce`.
Ejecuta los comandos de npm desde la carpeta de la aplicacion y los comandos
de Git desde la raiz del repositorio. No inicialices otro repositorio en
`Tesis` ni dentro de `mate-simce`.

Para sincronizar la rama actual, con el arbol de trabajo limpio:

```bash
git status
git pull --ff-only
```

Si hay cambios locales, revisalos y guardalos antes de sincronizar.

No incluyas `.env`, `node_modules`, `.next` ni otros archivos ignorados.

## Integracion y despliegue continuo

El proyecto usa GitHub Actions para validar automaticamente cada cambio. El
workflow se encuentra en `.github/workflows/ci.yml` y ejecuta `npm ci`,
`npm run lint` y `npm run build` en un runner `ubuntu-latest` con Node.js 20.

La validacion se ejecuta cuando:


- se hace push a `main`;
- se hace push a una rama `feat/**`;
- se abre o actualiza un Pull Request hacia `main`.


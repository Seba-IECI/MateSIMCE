# MateSIMCE

Aplicacion web en Next.js para apoyar el aprendizaje de matematica de 2° medio con un tutor IA.

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

## Integracion y despliegue continuo

El proyecto usa GitHub Actions para validar automaticamente cada cambio. El
workflow se encuentra en `.github/workflows/ci.yml` y ejecuta `npm ci`,
`npm run lint` y `npm run build` en un runner `ubuntu-latest` con Node.js 20.

La validacion se ejecuta cuando:

- se hace push a `main`;
- se hace push a una rama `feat/**`;
- se abre o actualiza un Pull Request hacia `main`.


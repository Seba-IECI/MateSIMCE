# MateSIMCE

Aplicacion web en Next.js para apoyar el aprendizaje de matematica de nivel de
preparatoria mediante un tutor con IA.

## Stack

- Next.js 16 con App Router, TypeScript y Tailwind CSS 4
- shadcn/ui para componentes de interfaz
- Supabase para autenticacion, PostgreSQL y almacenamiento futuro de vectores
- Vercel AI SDK con Google Gemini
- KaTeX mediante `react-katex` para expresiones matematicas

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- Un proyecto de Supabase
- Una API key de Gemini para las funcionalidades de IA

## Instalacion local

Desde esta carpeta:

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Variables de entorno

Crea un archivo `.env` en la raiz del proyecto. El archivo ya existente no se
debe publicar ni compartir:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

Las variables `NEXT_PUBLIC_*` son necesarias para el cliente de Supabase.
`GEMINI_API_KEY` debe utilizarse unicamente en codigo del servidor y nunca debe
tener el prefijo `NEXT_PUBLIC_`.

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run lint     # comprobacion de ESLint
npm run build    # compilacion de produccion
npm run start    # servidor de produccion
```

## Publicar en GitHub

Si el repositorio remoto representa solamente esta aplicacion, ejecuta los
comandos desde `MateSIMCE/mate-simce`:

```bash
git init
git add .
git commit -m "Initial project setup"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

No incluyas `.env`, `node_modules`, `.next` ni otros archivos ignorados.

## Despliegue en Vercel

Importa el repositorio en Vercel y configura las mismas variables de entorno
en Project Settings. El despliegue continuo se activara con cada push a la
rama configurada.

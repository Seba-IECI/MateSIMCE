# MateSIMCE

Plataforma educativa de Matemática para estudiantes de II medio en Chile. Permite practicar por eje, comprender errores y rendir ensayos breves. Los resultados expresan aciertos y porcentajes; no equivalen a un puntaje oficial SIMCE.

## Funcionalidades actuales

- Registro de alumnos, confirmación por correo, login y logout con Supabase Auth SSR.
- Acceso diferenciado para alumnos activos y administradores; panel administrativo con estadísticas reales y publicación de ejercicios.
- Práctica por los cuatro ejes, corrección determinista en servidor, intentos persistentes, diagnóstico y opción de volver a intentar.
- Pistas durante la resolución y tutor contextualizado con Gemini después de responder; respaldo basado en contenido verificado cuando la generación no está disponible.
- Ensayos de 12 preguntas, tres por eje, con respuestas persistentes, finalización idempotente y revisión posterior. Las soluciones se habilitan únicamente después de finalizar.
- Interfaz Dark Academic con notación matemática KaTeX.

El responsable confirmó 65 ejercicios publicados en el entorno actual. Ese contenido y sus solucionarios no forman parte de la instalación pública. El despliegue en Vercel está pendiente.

## Stack y arquitectura

Next.js 16.4.1 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Supabase Auth/PostgreSQL con RLS, KaTeX y el SDK oficial `@google/genai`.

La interfaz, las Server Actions y los Route Handlers pertenecen a la misma aplicación Next.js. No hay un servidor backend independiente. Supabase autentica y persiste datos; la corrección se calcula en servidor con soluciones verificadas. Gemini ayuda a explicar y no determina calificaciones.

## Instalación local

Requisitos: Node.js **22.13 o superior dentro de la rama 22**, npm y acceso a un proyecto Supabase configurado para la aplicación.

```bash
git clone https://github.com/Seba-IECI/MateSIMCE.git
cd MateSIMCE/mate-simce
npm ci
```

Crear `mate-simce/.env.local` con las variables que correspondan y ejecutar `npm run dev`. Abrir http://localhost:3000. En PowerShell se puede usar `npm.cmd` si la política local bloquea `npm.ps1`.

### Variables de entorno

| Nombre | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon/publishable; nunca una clave administrativa. |
| `SUPABASE_SECRET_KEY` | Exclusiva del servidor: lectura de soluciones y guardado de correcciones de práctica, después de autorizar al alumno. |
| `GEMINI_API_KEY` | Exclusiva del servidor; opcional para el respaldo determinista. |
| `GEMINI_MODEL` | Modelo habilitado para el proyecto; verificar su disponibilidad antes de desplegar. |
| `GEMINI_TUTOR_ENABLED` | Solo el valor `true` habilita generación externa; mantener deshabilitada hasta verificar configuración y condiciones de uso. |

No guardar valores en Git ni compartir archivos `.env`. La selección del modelo y los límites del proveedor se revisan en cada entorno. Los controles de consumo en memoria no garantizan un límite global entre instancias de Vercel.

### Base de datos

El entorno requiere el esquema vigente con perfiles de Supabase Auth, roles, contenidos, respuestas e intentos. **`supabase/schema.sql`, `seed.sql` y su README documentan un modelo anterior de participantes y no son una instalación compatible del MVP actual. No ejecutarlos sobre la base vigente.**

Los scripts de `supabase/admin/` y `supabase/exams/` se conservan para las operaciones específicas que describen; requieren revisión y ejecución manual por el responsable. No sustituyen una migración base reproducible. No contienen el banco privado y no deben ejecutarse automáticamente desde CI.

## Comandos

Desde `mate-simce/`:

| Comando | Comprobación |
| --- | --- |
| `npm run dev` | Desarrollo local. |
| `npm run lint` | ESLint de la aplicación y pruebas. |
| `npm run typecheck` | Generación de tipos de rutas y TypeScript sin emitir JavaScript. |
| `npm test` | Vitest con dependencias externas simuladas; sin cuota de Gemini. |
| `npm run test:node` | Regresiones locales de autenticación y componentes; no depende del banco privado. |
| `npm run test:http` | Next.js por HTTP real; lecturas autenticadas de Supabase solo con cuenta de pruebas. |
| `npm run test:e2e:types` | Tipos de las pruebas Cypress. |
| `npm run test:e2e` | Navegador Cypress con una cuenta adulta y entorno aislado. Crea intentos de prueba. |
| `npm run build` / `npm run start` | Compilar y servir producción. |
| `node tests/check-browser-secrets.cjs` | Tras el build, buscar las credenciales privadas configuradas en los archivos públicos generados. |

Los casos representativos, sus dependencias y las instrucciones de integración/E2E están en [tests/README.md](mate-simce/tests/README.md).

## Estructura

```text
.github/workflows/ci.yml      CI en la raíz de Git
mate-simce/
  app/                       Páginas, Server Actions y rutas HTTP
  components/                Autenticación, práctica, ensayos y administración
  lib/                       Autorización, acceso a datos, corrección y tutor
  cypress/                   Recorridos reales de navegador
  tests/                     Vitest, Node e integraciones HTTP
  supabase/admin/            Asignación controlada de administrador
  supabase/exams/            Habilitación y selección de ensayos
  private/                   Material local ignorado; no distribuir
```

## Integración continua y despliegue

[GitHub Actions](.github/workflows/ci.yml) usa un runner `ubuntu-latest`, Node.js 22 y `npm ci`. Ejecuta ESLint, tipos de aplicación y Cypress, Vitest, regresiones Node, build y contratos HTTP sin sesión sobre Next.js real. Las etapas distinguen comprobaciones de interfaz y lógica de servidor sin inventar otro backend.

Se activa con push a `main`, `feat/**` o `chore/**` y con Pull Requests a `main`. Los PR públicos no reciben credenciales de Supabase: las integraciones autenticadas figuran como omitidas y Cypress real se ejecuta en el entorno aislado autorizado. Un workflow modificado localmente requiere una ejecución posterior en GitHub para acreditar su estado remoto.

Para Vercel: configurar **Root Directory: `mate-simce`**, Node.js 22 y variables separadas para Preview/Production. Revisar Site URL, Redirect URLs y la plantilla de confirmación de Supabase Auth para el dominio HTTPS definitivo. El despliegue y su comprobación siguen pendientes; este repositorio no configura entrega automática a producción.

## Trabajo con Git

Usar ramas cortas, Pull Requests hacia `main` y Conventional Commits (`feat`, `fix`, `chore`, `test`, `docs`). Revisar todos los archivos del commit y añadir rutas explícitas. No reescribir historial compartido ni versionar entornos, bancos, solucionarios, PDF privados o artefactos generados. La carpeta `private/`, las referencias locales y los SQL privados del banco están ignorados.

La licencia MIT del [código](mate-simce/LICENSE) no convierte el material privado ni sus documentos de referencia en contenido redistribuible.

# Pruebas y evidencia para la evaluación

Ejecutar desde `mate-simce/` con Node.js 22. Las categorías se distinguen por las dependencias que realmente ejecutan; las pruebas con mocks no acreditan acceso remoto ni RLS.

## Casos representativos

| Nivel | Archivo y nombre del caso | Qué comprueba | Dependencias |
| --- | --- | --- | --- |
| Unitaria U1 | `unit/progress.test.ts`: `calcula intentos, aciertos y porcentaje de cada eje sin mezclar resultados` | Regla pura de diagnóstico y redondeo por eje. | Vitest y `summarizePractice`; sin red. |
| Unitaria U2 | `unit/exam.test.ts`: `calcula 12 preguntas, 3 por eje, y separa incorrectas de omitidas` | Totales, omisiones, porcentajes y distribución del resultado. | Vitest y `summarizeExam`; sin red. |
| Integración I3 | `http/catalog.test.ts`: `I3 GET /api/ejercicios: acceso, paginación y listado real sin soluciones` | HTTP 200, catálogo publicado real, paginación y exclusión de campos privados. | Next.js real, Supertest, Supabase Auth SSR y PostgreSQL/RLS del entorno aislado. |
| Integración I4 | `http/catalog.test.ts`: `I4 GET /api/ejercicios/[id]: detalle publicado real sin soluciones y 404` | Detalle 200 de un ejercicio descubierto en el catálogo, alternativas y 404 real. | Las mismas dependencias reales; no usa mocks ni escribe datos académicos. |
| E2E E1 | `../cypress/e2e/authentication.cy.ts`: `inicia sesión, conserva acceso al recargar y lo pierde al cerrar sesión` | Formulario, dashboard, persistencia de sesión y logout. | Electron/Cypress, Next.js y Supabase reales. |
| E2E E2 | `../cypress/e2e/exam.cy.ts`: `guarda una selección, la recupera al recargar y finaliza el intento` | 12 preguntas, tres por eje, ausencia de soluciones en curso, selección persistente, revisión y finalización repetida. | Electron/Cypress, Next.js y RPC PostgreSQL existentes; crea un intento en la cuenta de pruebas. |

`exercise-catalog.cy.ts` aporta un recorrido adicional de práctica: los cuatro ejes, distribución 2 × 2, pista previa, dos intentos independientes, siguiente ejercicio y diagnóstico persistente. No llama a Gemini. La suite aislada de Gemini usa mocks para comprobar generación, límites, formato y respaldo.

## Verificación local del 6 de noviembre de 2026

- ESLint, tipos de aplicación/Cypress y build: aprobados. El build necesitó acceso de red para descargar Geist.
- Vitest: 161 casos aprobados en nueve archivos. Node: 83 casos aprobados.
- HTTP real con la cuenta y el proyecto aislados confirmados por el responsable: I0–I4 aprobadas, incluido detalle positivo. Sin credenciales: I0 aprobada e I1–I4 omitidas explícitamente.
- Cypress: cuatro casos aprobados en los tres archivos, sin omisiones; viewport 1366 × 768. Se guardaron dos intentos de práctica y un ensayo de prueba; no se modificaron intentos anteriores.
- Se revisaron seis capturas de las pantallas de alumno. El panel de administrador no se abrió con una cuenta real en esta ejecución; sus reglas se comprobaron con la suite aislada.
- El análisis del build no encontró las credenciales privadas configuradas en sus 16 archivos públicos inspeccionados. Esto no sustituye una auditoría del historial de Git ni de todos los secretos posibles.
- Workflow validado como YAML; ejecución en GitHub y despliegue Vercel pendientes. No hubo llamadas reales a Gemini, SQL remoto, commits ni push.

## Pruebas locales sin servicios externos

```bash
npm run lint
npm run typecheck
npm test
npm run test:node
npm run test:e2e:types
npm run build
node tests/check-browser-secrets.cjs
```

Para demostrar solo las dos unitarias seleccionadas:

```bash
npm test -- tests/unit/progress.test.ts -t "calcula intentos"
npm test -- tests/unit/exam.test.ts -t "calcula 12 preguntas"
```

Vitest ejecuta `tests/unit/`. Las pruebas Node de autenticación y ejercicios ejecutan módulos de producción con adaptadores en memoria; no se presentan como integración con Supabase. `test:node` no requiere archivos privados del banco. `tests/auth-eslint.config.mjs` conserva una comprobación opcional más estricta de autenticación y no sustituye el lint general.

## Integraciones HTTP reales

Configurar exclusivamente una cuenta adulta activa de alumno en un proyecto Supabase **aislado de pruebas**, mediante `MATESIMCE_TEST_EMAIL` y `MATESIMCE_TEST_PASSWORD` en `.env.test.local` (ignorado). No mostrar ni copiar sus valores a reportes. Se usa la clave pública; no `service_role`.

Terminal 1:

```bash
npm run start -- --hostname 127.0.0.1 --port 3100
```

Terminal 2 (PowerShell):

```powershell
$env:MATESIMCE_TEST_BASE_URL = 'http://127.0.0.1:3100'
npm.cmd run test:http
```

La suite abre una sesión SSR real y la cierra al terminar. I1 verifica el curso; I2, al menos cuatro temas; I3 exige un listado no vacío; I4 descubre un ejercicio publicado y exige detalle positivo, además del 404. `MATESIMCE_TEST_TOPIC_ID` y `MATESIMCE_TEST_EXERCISE_ID` son filtros opcionales, no necesarios para la evidencia positiva.

Sin credenciales, I1–I4 aparecen **omitidas**. Solo I0 comprueba los rechazos HTTP sin sesión y la página inválida; no cuenta como integración autenticada de la pauta.

## Cypress real a 1366 × 768

Con el servidor anterior activo y el entorno aislado preparado:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm.cmd run test:e2e -- --config baseUrl=http://127.0.0.1:3100
```

Para demostrar únicamente los dos recorridos seleccionados:

```powershell
npm.cmd run test:e2e -- --config baseUrl=http://127.0.0.1:3100 --spec 'cypress/e2e/authentication.cy.ts,cypress/e2e/exam.cy.ts'
```

Los tests usan el formulario real y no simulan Auth. El ensayo no finaliza un intento pendiente para preparar su estado: si encuentra uno, se detiene para conservarlo. La práctica registra dos intentos y el ensayo registra uno nuevo; nunca usar cuentas ni bases de producción. No ejecutan SQL administrativo, importaciones ni llamadas generativas. Las capturas explícitas quedan en `cypress/screenshots/`, ignorado por Git; revisar su contenido antes de compartirlas.

## CI y límites de la evidencia

El workflow real es `../../.github/workflows/ci.yml`. Usa Node.js 22 y `npm ci`, ejecuta calidad, tipos, Vitest, Node, build y HTTP sin sesión con configuración sintética. No recibe credenciales en PR públicos. Cypress y las cuatro integraciones autenticadas se ejecutan por separado en el entorno aislado autorizado.

Un resultado local no acredita una ejecución del workflow en GitHub, el despliegue en Vercel ni una auditoría completa de políticas remotas. Los tests no garantizan ausencia de alucinaciones del tutor; comprobar una explicación con la referencia verificada durante la validación manual, sin llamadas masivas.

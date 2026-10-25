# Pruebas del proyecto

Para la evaluación del 27 de octubre, consultar `GUIA_EVALUACION.txt`: comandos comprobados, diez casos y limitaciones. El 24 de octubre se ejecutaron U1–U4, I1–I4 y E1–E2 con Next.js 16.4.1; todos pasaron. E2 consultó los temas reales vacíos: el detalle positivo sigue pendiente, al igual que I4 con contenido publicado. Cypress 16.2.0 usa una configuración TypeScript separada y la cuenta adulta exclusiva de pruebas confirmada por el responsable. No se ejecutó SQL ni se publicó contenido.

## Pruebas unitarias con Vitest

### Evaluación: backend y HTTP real

Desde `mate-simce/`, ejecutar `npm.cmd run test:backend` para U1–U4. Importan funciones reales y simulan solo dependencias externas; no conectan a Supabase.

Para I1–I4, abrir dos terminales PowerShell:

```powershell
# Terminal 1: servidor real Next.js
npm.cmd run dev -- --hostname 127.0.0.1 --port 3100
```

```powershell
# Terminal 2: peticiones reales mediante Supertest + Vitest
npm.cmd run test:http
```

Sin credenciales, los cuatro casos solo comprueban rechazo HTTP 401 y el listado también valida el error 400 de página cero. Esto NO acredita lecturas autenticadas.

Para probarlas, configurar manualmente `MATESIMCE_TEST_EMAIL` y `MATESIMCE_TEST_PASSWORD` en `.env.test.local` (ignorado por Git), con una cuenta de alumno activa y autorizada. La suite inicia una sesión real mediante Supabase SSR, conserva cookies solo en memoria y cierra esa sesión al terminar. No imprime credenciales. Requiere acceso de red a Supabase; no usa `service_role`, SQL ni inserciones académicas.

Opcional: `MATESIMCE_TEST_TOPIC_ID` fija un tema activo conocido. `MATESIMCE_TEST_EXERCISE_ID` fija un ejercicio publicado para probar detalle 200; sin él, I4 verifica 404 para un UUID reservado de prueba y deja explícitamente pendiente el detalle positivo. Un listado vacío puede ser correcto, pero no demuestra visualización de ejercicios publicados. Nunca se publican datos desde estas pruebas.

`MATESIMCE_TEST_BASE_URL` permite otro puerto local. Los endpoints son `/api/cursos/actual`, `/api/temas`, `/api/ejercicios?temaId=UUID&page=1` y `/api/ejercicios/UUID`. No son Server Actions y no dependen del matcher del proxy. Sus respuestas no se almacenan en caché compartida.

Resultado real del 22 de octubre de 2026: U1–U4 aprobadas; I1–I4 aprobadas contra Next.js y Supabase reales con cuenta autorizada, incluyendo los cuatro rechazos sin sesión. I4 comprobó 404; NO se probó detalle positivo de un ejercicio publicado. También pasaron las nueve unitarias totales, las 112 pruebas anteriores, ESLint y TypeScript. El build finalizó con salida 0 tras repetir el comando por un aviso de seguridad de Next.js 16.4.0; el aviso requiere revisión separada, no se actualizaron dependencias de producción. Las ejecuciones iniciales restringidas fallaron por acceso de red; la ejecución autenticada final necesitó red tanto en el servidor como en el runner. No se ejecutó SQL ni se cargó el seed.

Ejecutar desde `mate-simce/`, con Node.js 22.22.2 y los tipos de Node 22:

```powershell
npm.cmd test
npm.cmd run test:watch
npm.cmd test -- tests/unit/utils.test.ts
npm.cmd run test:node
```

`npm.cmd test` ejecuta Vitest una vez; `test:watch` mantiene la observación de cambios. `vitest.config.mts` configura el entorno Node y el alias `@/`, y limita Vitest a `tests/unit/`. Instalar Vitest no genera automáticamente este archivo de configuración.

`tests/unit/utils.test.ts` comprueba la utilidad real `cn` de `lib/utils.ts`: composición, condiciones y conflictos de clases Tailwind. Sustituye el ejemplo de bcrypt, cuyo helper no existe en el proyecto; no se añade autenticación propia.

`npm.cmd run test:node` conserva el runner `node:test` para las 73 pruebas existentes de autenticación y catálogo. Son pruebas locales con adaptadores; este comando no ejecuta SQL ni conecta a PostgreSQL o Supabase. El commit público no depende de las pruebas privadas del banco.

No se requiere PostgreSQL local para el MVP. El banco y sus comprobaciones se mantienen localmente, fuera del repositorio público; no son necesarios para ejecutar las pruebas de evaluación.

Los comandos se definen en `scripts` de `package.json`, no en `package-lock.json`. Vitest es una dependencia de desarrollo. Si se necesita reinstalar, utilizar `npm.cmd install` sin `--force`; el lockfile se actualiza mediante npm.

## Verificación del acceso de estudiantes

Ejecutar desde `mate-simce/` con Node.js 22. En PowerShell puede utilizarse `npm.cmd` si la política local bloquea `npm.ps1`.

```powershell
node --test tests/auth.test.cjs
node node_modules/next/dist/bin/next typegen
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint
node node_modules/eslint/bin/eslint.js --config tests/auth-eslint.config.mjs app/login app/alumno app/auth components/auth lib/auth lib/supabase proxy.ts
npm.cmd run build
node tests/check-browser-secrets.cjs
```

`auth.test.cjs` ejecuta el código de producción con adaptadores simulados de Next.js y Supabase. No accede a Supabase ni crea cuentas. Estas pruebas no certifican los permisos remotos ni sustituyen las comprobaciones en un navegador.

El comando con `auth-eslint.config.mjs` comprueba variables sin uso y tipos `any` explícitos en los archivos de autenticación; es opcional y no sustituye `npm.cmd run lint`. El lint general conserva las reglas de Next.js y TypeScript, con permisos explícitos para los imports CommonJS de los runners `.cjs` y sus módulos de prueba.

El import `shadcn/tailwind.css` requiere la versión 4.21.0 fijada en el proyecto. `eslint-config-next` está alineado con Next.js 16.4.1. Se mantiene Tailwind CSS 4 y se utiliza `react-katex` 3.1.0, compatible con React 19. El análisis de credenciales debe ejecutarse después de un build completo.

## Prueba real pendiente

Utilizar exclusivamente cuentas existentes y autorizadas. No crear usuarios en producción para verificar esta implementación.

1. Abrir `/` y `/alumno` sin sesión: deben redirigir a `/login` sin mostrar la portada protegida.
2. Iniciar sesión con un alumno activo. Debe llegar a `/` y persistir el acceso tras recargar; abrir `/login` o `/alumno` con esa sesión debe redirigir a `/`.
3. Comprobar contraseña incorrecta: mensaje genérico y sin acceso nuevo.
4. Comprobar cuentas de prueba de otro rol, inactivas o sin perfil: acceso rechazado. No desactivar cuentas reales para probar.
5. Cerrar sesión desde la portada: regresar a `/login`, comprobar que se eliminan las cookies de este proyecto y que `/` y `/alumno` vuelven a redirigir.
6. Repetir el flujo en `http://localhost:3000` y `http://192.168.1.8:3000`. El WebSocket `/_next/hmr` debe conectar sin bloqueo de origen y el formulario debe salir del estado de carga ante errores.
7. Probar Atrás/Adelante y el cambio de estudiante en un dispositivo compartido. La portada conserva exclusivamente datos de demostración.

La autorización requiere lectura del propio perfil (`id`, `nombre`, `activo`) y ejecución de la función auditada `usuario_tiene_rol(text[])` con el JWT del usuario. Si los permisos remotos no lo permiten, se rechaza el acceso; la aplicación no utiliza una clave privilegiada como alternativa.

El logout afecta a la sesión de este dispositivo. Si falla la revocación remota, se eliminan igualmente las cookies locales y se informa de esa limitación. Los JWT previamente copiados pueden conservar su validez hasta expirar.

Los clientes oficiales SSR guardan tokens de sesión en cookies accesibles al cliente. La clave `anon` es pública; las claves de servicio y del proveedor de IA permanecen fuera del código del navegador. La comprobación del servidor no confía en el objeto de sesión del navegador.

## Consulta de ejercicios — Fase 5C.1

```powershell
node --test tests/auth.test.cjs tests/exercises.test.cjs
```

Las pruebas de ejercicios ejecutan los módulos reales con adaptadores de Supabase y React en memoria. Comprueban autorización, filtros de publicación/activación, selección de contenidos, paginación, detalle, errores y estados vacíos. No son pruebas de navegador ni certifican RLS remoto; no insertan contenido.

Las consultas usan las columnas y relaciones remotas proporcionadas por el propietario el 18 de octubre de 2026. En esa comprobación, `authenticated` tenía SELECT por columna sobre `ejercicios`, aunque el permiso SELECT de tabla figuraba como falso. Las políticas permiten cursos activos, temas activos de cursos activos y ejercicios publicados; el servicio aplica además filtros explícitos sobre todos los ancestros. No consulta soluciones ni utiliza una clave privilegiada.

El conteo remoto proporcionado en esa fecha fue de **0 ejercicios publicados**. No se observó el formato interno de `opciones`: por seguridad solo se muestran arrays de cadenas de texto; los objetos y otros formatos se omiten sin serializarlos al cliente. Antes de publicar alternativas con objetos, hay que confirmar el contrato de sus campos visibles. Las imágenes solo se admiten desde almacenamiento público HTTPS del mismo proyecto Supabase.

Prueba manual con una cuenta de alumno ya autorizada:

1. Iniciar sesión en `/` y pulsar «Ejercicios» o «Consultar ejercicios» en la vista de práctica.
2. Los temas de 2.º medio deben cargarse automáticamente, sin selector de curso. Seleccionar un tema real; si no hay contenidos, debe aparecer el estado vacío correspondiente, sin ejercicios inventados.
3. Regresar con «Inicio» y comprobar que la portada mantiene sus tarjetas y etiquetas de demostración.
4. Cerrar sesión y comprobar que `/` vuelve al login. No se han cambiado las acciones de autenticación ni las redirecciones.
5. Cuando existan ejercicios publicados, comprobar con esa cuenta el detalle, el texto matemático y las alternativas. Actualmente esas vistas solo pueden comprobarse con los datos simulados de las pruebas; no publicar ejercicios para ejecutar esta fase.

El servidor resuelve un único curso con `activo = true` y `nivel = '2_medio'` antes de consultar temas, listados o detalles. No usa UUID fijos ni `usuarios.curso_actual_id`, que es editable por el usuario. Si no encuentra un curso coincidente o hay varios, devuelve un estado explícito sin seleccionar el primero ni consultar contenidos. Las consultas de temas y ejercicios restringen además el curso y su nivel; enviar IDs de otros cursos no amplía el alcance. Las pruebas simulan ausencia, duplicidad, otros niveles y diferentes UUID de instalación sin ejecutar SQL.

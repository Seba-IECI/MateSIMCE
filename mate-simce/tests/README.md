# Verificación del acceso de estudiantes

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

El import `shadcn/tailwind.css` requiere la versión 4.21.0 fijada en el proyecto. `eslint-config-next` está alineado con Next.js 16.4.0. Se mantiene Tailwind CSS 4 y se utiliza `react-katex` 3.1.0, compatible con React 19. El análisis de credenciales debe ejecutarse después de un build completo.

## Prueba real pendiente

Utilizar exclusivamente cuentas existentes y autorizadas. No crear usuarios en producción para verificar esta implementación.

1. Abrir `/alumno` sin sesión: debe redirigir a `/login` sin mostrar datos.
2. Iniciar sesión con un alumno activo. Debe aparecer su nombre en `/alumno` y persistir el acceso tras recargar.
3. Comprobar contraseña incorrecta: mensaje genérico y sin acceso nuevo.
4. Comprobar cuentas de prueba de otro rol, inactivas o sin perfil: acceso rechazado. No desactivar cuentas reales para probar.
5. Cerrar sesión: regresar a `/login`, comprobar que se eliminan las cookies de este proyecto y que `/alumno` vuelve a redirigir.
6. Probar Atrás/Adelante y el cambio de estudiante en un dispositivo compartido: no debe recuperarse el nombre anterior.

La autorización requiere lectura del propio perfil (`id`, `nombre`, `activo`) y ejecución de la función auditada `usuario_tiene_rol(text[])` con el JWT del usuario. Si los permisos remotos no lo permiten, se rechaza el acceso; la aplicación no utiliza una clave privilegiada como alternativa.

El logout afecta a la sesión de este dispositivo. Si falla la revocación remota, se eliminan igualmente las cookies locales y se informa de esa limitación. Los JWT previamente copiados pueden conservar su validez hasta expirar.

Los clientes oficiales SSR guardan tokens de sesión en cookies accesibles al cliente. La clave `anon` es pública; las claves de servicio y del proveedor de IA permanecen fuera del código del navegador. La comprobación del servidor no confía en el objeto de sesión del navegador.

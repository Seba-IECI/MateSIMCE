# Modelo de acceso y aprendizaje

## Estado de estos archivos

`schema.sql` define el modelo objetivo para una **base nueva**. Aborta si ya existe `public.usuarios`; no es una migración y no debe ejecutarse sobre la base actual. `seed.sql` carga solo roles docentes, curso y temas. Ninguno de estos archivos se ha ejecutado en el Supabase del proyecto durante esta revisión.

La aplicación todavía necesita implementar las rutas de servidor y las pantallas de este flujo. El SQL por sí solo no habilita el ingreso con códigos.

## Identidades y sesiones

- `usuarios` contiene únicamente cuentas autorizadas de profesores y administradores vinculadas a Supabase Auth. El rol se asigna desde un proceso administrativo del servidor; registrarse en Auth no otorga acceso docente.
- `grupos` relaciona un profesor con un curso curricular y define una fecha de conservación. Cada profesor consulta sus propios grupos; los administradores pueden supervisarlos.
- `participantes` identifica una trayectoria con UUID y código aleatorio estable. No tiene nombre, apellido, correo, RUT, fecha de nacimiento ni vínculo con `auth.users`.
- `credenciales_participante` guarda únicamente el hash de una credencial privada, con expiración y revocación. El código visible no sirve como contraseña.
- `actividades` abre una práctica o ensayo para un grupo durante un intervalo. `actividades_ejercicios` define los ejercicios asignados a una práctica.
- `sesiones_acceso` autoriza temporalmente a un participante para una actividad. Cambiar o revocar la credencial revoca sus sesiones existentes.
- Respuestas, intentos, progreso, retroalimentación, tutorías y recomendaciones se relacionan con `participante_id`. Las notificaciones de gestión siguen asociadas al usuario docente.
- `pasos_resolucion` registra el procedimiento y las pistas usadas por paso, además de la respuesta final.

Las claves compuestas impiden asociar una sesión a participantes de otro grupo, una respuesta a otro participante/intento o una pregunta a un ensayo distinto. Los profesores no tienen permisos de escritura sobre los resultados académicos ni de lectura sobre las tablas de credenciales, tokens o soluciones.

## Contrato del servidor pendiente de implementación

1. Autenticar al profesor con Supabase Auth y comprobar su rol y la propiedad del grupo en cada operación.
2. Generar la credencial privada y los tokens de sesión con al menos 32 bytes aleatorios criptográficos. Guardar SHA-256 en hexadecimal; nunca el secreto en texto plano. Esto presupone secretos de alta entropía, no PINs cortos.
3. Canjear la credencial mediante una ruta protegida contra intentos masivos. Comprobar participante/grupo activos, conservación vigente, credencial vigente y actividad abierta antes de crear la sesión.
4. Entregar el token de sesión en una cookie `HttpOnly`, `Secure` y `SameSite` apropiado, con vencimiento. Aplicar controles de origen/CSRF a operaciones que usan cookies. No colocar tokens en URLs, logs ni almacenamiento público.
5. En cada petición del participante, calcular el hash del token y llamar a `validar_sesion_participante`. Esa función valida sesión, credencial, grupo, participante y ventana de actividad. Derivar la identidad de su resultado, nunca de un `participante_id` enviado libremente por el navegador.
6. Validar que los ejercicios/preguntas estén asignados a la actividad y publicados. Corregir respuestas y calcular puntajes y progreso desde el servidor. Los triggers también bloquean nuevas respuestas, pasos, intentos y mensajes cuando la sesión ya no es válida.
7. Usar la clave privilegiada de Supabase únicamente en el servidor. **Omite RLS**: las rutas deben limitar explícitamente los registros y las operaciones a la sesión validada. No conceder acceso público a las tablas para simplificar el ingreso.
8. Al cerrar sesión, revocar el registro y eliminar la cookie. Mantener la misma identidad de participante al volver a entrar con la credencial; no generar un participante nuevo en cada visita.
9. Al recuperar una credencial perdida, el profesor autoriza la rotación para el participante correspondiente. La app conserva el historial y revoca las sesiones anteriores. No hay recuperación mediante correo del estudiante.

`sesiones_acceso` y `sesiones_tutor` tienen funciones diferentes: la primera autoriza el acceso; la segunda guarda una conversación pedagógica.

## Conservación y minimización

`conservar_hasta` es obligatorio y bloquea el acceso tras vencer; **no elimina automáticamente los datos**. Hace falta un trabajo de servidor para borrar o agregar el historial al terminar el período acordado. Para borrar un grupo, primero deben eliminarse sus participantes y dependencias; el esquema evita borrar accidentalmente un grupo completo desde el panel.

No registrar una correspondencia código–nombre en esta base. Evitar información identificadora en títulos, respuestas abiertas, conversaciones, analítica y logs; filtrar lo enviado al proveedor de IA. Los códigos estables constituyen seudonimización y no garantizan anonimato ni sustituyen la autorización institucional.

## Adaptación de la base existente

Antes de preparar una migración ejecutable:

1. Obtener las definiciones actuales de tablas, restricciones y políticas mediante una exportación de esquema o una conexión de solo lectura, sin registros de estudiantes.
2. Revisar cuentas y roles existentes y definir qué cuentas docentes quedan autorizadas. No convertir automáticamente todos los usuarios actuales en profesores.
3. Definir los grupos y una asignación explícita de los identificadores antiguos de alumnos a nuevos participantes. No inventar asociaciones ni usar nombres/RUT para generar códigos.
4. Preparar una migración transaccional que agregue las entidades nuevas, traslade las relaciones del historial y reemplace políticas/triggers. Los registros antiguos no tienen actividad ni sesión de acceso: necesitan un tratamiento histórico explícito, sin fingir sesiones vigentes.
5. Comprobar cantidades y referencias antes de retirar las relaciones antiguas. La eliminación de campos personales y cuentas antiguas necesita una decisión explícita de conservación; no debe hacerse por un `DROP` improvisado.
6. Validar primero en una copia de pruebas. No aplicar `schema.sql` ni `seed.sql` del nuevo modelo directamente sobre el modelo anterior.

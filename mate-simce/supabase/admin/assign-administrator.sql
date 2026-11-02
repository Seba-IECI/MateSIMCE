-- Preparado para revisión. NO ejecutado automáticamente.
-- El rol administrador activo ya existe: no se crean roles ni se cambian permisos.
-- Copia el script al SQL Editor y reemplaza NULL por el UUID de TU cuenta elegida.
-- Obtén ese UUID desde Authentication > Users; no uses un correo supuesto.
-- No guardes el UUID real en este archivo ni en Git. La cuenta debe estar confirmada.
BEGIN;

DO $assign_administrator$
DECLARE
  target_user_id uuid := NULL; -- Sustituir SOLO en el SQL Editor: 'UUID_ELEGIDO'::uuid
  admin_role_id uuid;
  student_role_id uuid;
  current_role_id uuid;
  profile_active boolean;
  email_confirmed boolean;
  changed integer;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar el UUID de una cuenta existente únicamente en el SQL Editor.';
  END IF;
  SELECT id INTO admin_role_id FROM public.roles
    WHERE nombre = 'administrador' AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe un rol administrador activo.'; END IF;
  SELECT id INTO student_role_id FROM public.roles
    WHERE nombre = 'alumno' AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe un rol alumno activo.'; END IF;

  SELECT usuario.rol_id, usuario.activo, cuenta.email_confirmed_at IS NOT NULL
    INTO current_role_id, profile_active, email_confirmed
    FROM public.usuarios AS usuario
    JOIN auth.users AS cuenta ON cuenta.id = usuario.id
    WHERE usuario.id = target_user_id
    FOR UPDATE OF usuario;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no existe o no tiene perfil.'; END IF;
  IF NOT profile_active OR NOT email_confirmed THEN
    RAISE EXCEPTION 'La cuenta debe tener perfil activo y correo confirmado.';
  END IF;
  IF current_role_id = admin_role_id THEN
    RAISE NOTICE 'La cuenta ya tiene el rol administrador activo; no se cambia nada.';
  ELSE
    IF current_role_id <> student_role_id THEN
      RAISE EXCEPTION 'Solo se admite promover una cuenta alumno; revisa la selección.';
    END IF;
    UPDATE public.usuarios SET rol_id = admin_role_id
      WHERE id = target_user_id AND rol_id = student_role_id AND activo;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'La asignación no afectó exactamente un perfil.'; END IF;
    RAISE NOTICE 'Rol administrador asignado a la cuenta verificada.';
  END IF;
END;
$assign_administrator$;

COMMIT;

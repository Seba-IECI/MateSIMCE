-- Modelo de participantes seudonimos y cuentas docentes.
-- SOLO para una base nueva: no ejecutar sobre la base existente.
-- Consultar supabase/README.md para el plan de migracion y contrato del servidor.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    RAISE EXCEPTION 'La base ya contiene usuarios. Este archivo no es una migracion.';
  END IF;
END;
$$;

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE CHECK (nombre IN ('profesor', 'administrador')),
  descripcion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  rol_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Solo cuentas docentes/administrativas autorizadas, provisionadas desde servidor.
-- No hay trigger que convierta cualquier registro de Auth en profesor.

CREATE TABLE public.cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nivel TEXT NOT NULL CHECK (nivel IN ('1_medio', '2_medio', '3_medio', '4_medio')),
  descripcion TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nivel, nombre)
);

CREATE TABLE public.temas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (
    categoria IN ('numeros', 'geometria', 'algebra_y_funciones', 'estadistica_y_probabilidades')
  ),
  descripcion TEXT NOT NULL DEFAULT '',
  orden INTEGER NOT NULL DEFAULT 1 CHECK (orden > 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (curso_id, nombre)
);

CREATE TABLE public.ejercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id UUID NOT NULL REFERENCES public.temas(id) ON DELETE RESTRICT,
  titulo TEXT NOT NULL,
  enunciado TEXT NOT NULL,
  instrucciones TEXT,
  tipo_respuesta TEXT NOT NULL CHECK (tipo_respuesta IN ('opcion_multiple', 'respuesta_abierta', 'calculo')),
  opciones JSONB,
  dificultad TEXT NOT NULL DEFAULT 'media' CHECK (dificultad IN ('facil', 'media', 'dificil')),
  nivel_desafio TEXT NOT NULL DEFAULT 'inicial' CHECK (nivel_desafio IN ('inicial', 'intermedio', 'avanzado')),
  tiempo_estimado_segundos INTEGER CHECK (tiempo_estimado_segundos IS NULL OR tiempo_estimado_segundos > 0),
  imagen_url TEXT,
  publicado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (opciones IS NULL OR jsonb_typeof(opciones) = 'array'),
  CHECK (tipo_respuesta <> 'opcion_multiple' OR opciones IS NOT NULL)
);

CREATE TABLE public.soluciones_ejercicios (
  ejercicio_id UUID PRIMARY KEY REFERENCES public.ejercicios(id) ON DELETE CASCADE,
  respuesta_correcta JSONB NOT NULL,
  desarrollo_paso_a_paso TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ensayos_simce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  tiempo_limite_minutos INTEGER CHECK (tiempo_limite_minutos IS NULL OR tiempo_limite_minutos > 0),
  publicado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.preguntas_ensayo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ensayo_id UUID NOT NULL REFERENCES public.ensayos_simce(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES public.temas(id) ON DELETE SET NULL,
  numero_pregunta INTEGER NOT NULL CHECK (numero_pregunta > 0),
  enunciado TEXT NOT NULL,
  tipo_respuesta TEXT NOT NULL CHECK (tipo_respuesta IN ('opcion_multiple', 'respuesta_abierta', 'calculo')),
  opciones JSONB,
  puntaje_maximo NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (puntaje_maximo > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ensayo_id, numero_pregunta),
  CHECK (opciones IS NULL OR jsonb_typeof(opciones) = 'array'),
  CHECK (tipo_respuesta <> 'opcion_multiple' OR opciones IS NOT NULL)
);

CREATE TABLE public.soluciones_preguntas_ensayo (
  pregunta_id UUID PRIMARY KEY REFERENCES public.preguntas_ensayo(id) ON DELETE CASCADE,
  respuesta_correcta JSONB NOT NULL,
  desarrollo_paso_a_paso TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 100),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  conservar_hasta TIMESTAMPTZ NOT NULL CHECK (conservar_hasta > creado_en)
);

CREATE TABLE public.participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE RESTRICT,
  codigo TEXT NOT NULL DEFAULT ('P-' || replace(gen_random_uuid()::text, '-', ''))
    CHECK (codigo ~ '^P-[0-9a-f]{32}$'),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (codigo),
  UNIQUE (id, grupo_id)
);
-- codigo es un identificador visible, NUNCA una credencial de acceso.

CREATE TABLE public.credenciales_participante (
  participante_id UUID PRIMARY KEY REFERENCES public.participantes(id) ON DELETE CASCADE,
  secreto_hash TEXT NOT NULL UNIQUE CHECK (secreto_hash ~ '^[0-9a-f]{64}$'),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en TIMESTAMPTZ NOT NULL CHECK (expira_en > creada_en),
  revocada_en TIMESTAMPTZ CHECK (revocada_en IS NULL OR revocada_en >= creada_en)
);
-- SHA-256 de un secreto aleatorio de al menos 256 bits generado en el servidor.
-- No guardar PINs cortos ni secretos/token en texto plano.

CREATE TABLE public.actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE RESTRICT,
  tema_id UUID REFERENCES public.temas(id) ON DELETE RESTRICT,
  ensayo_id UUID REFERENCES public.ensayos_simce(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('practica', 'ensayo')),
  titulo TEXT NOT NULL,
  abre_en TIMESTAMPTZ NOT NULL,
  cierra_en TIMESTAMPTZ NOT NULL CHECK (cierra_en > abre_en),
  activa BOOLEAN NOT NULL DEFAULT true,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, grupo_id),
  UNIQUE (id, ensayo_id),
  CHECK ((tipo = 'practica' AND tema_id IS NOT NULL AND ensayo_id IS NULL)
      OR (tipo = 'ensayo' AND ensayo_id IS NOT NULL AND tema_id IS NULL))
);

CREATE TABLE public.actividades_ejercicios (
  actividad_id UUID NOT NULL REFERENCES public.actividades(id) ON DELETE CASCADE,
  ejercicio_id UUID NOT NULL REFERENCES public.ejercicios(id) ON DELETE RESTRICT,
  orden INTEGER NOT NULL CHECK (orden > 0),
  PRIMARY KEY (actividad_id, ejercicio_id),
  UNIQUE (actividad_id, orden)
);

CREATE TABLE public.sesiones_acceso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL,
  grupo_id UUID NOT NULL,
  actividad_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en TIMESTAMPTZ NOT NULL CHECK (expira_en > creada_en),
  revocada_en TIMESTAMPTZ CHECK (revocada_en IS NULL OR revocada_en >= creada_en),
  FOREIGN KEY (participante_id, grupo_id)
    REFERENCES public.participantes(id, grupo_id) ON DELETE CASCADE,
  FOREIGN KEY (actividad_id, grupo_id)
    REFERENCES public.actividades(id, grupo_id) ON DELETE RESTRICT,
  UNIQUE (id, participante_id, actividad_id)
);
-- La sesion temporal pertenece a un participante estable, nunca a auth.users.
-- Sus tokens solo se canjean/verifican desde el servidor.

CREATE TABLE public.intentos_ensayo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  actividad_id UUID NOT NULL,
  sesion_acceso_id UUID NOT NULL,
  ensayo_id UUID NOT NULL REFERENCES public.ensayos_simce(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'completado', 'abandonado')),
  puntaje_obtenido NUMERIC(8,2) CHECK (puntaje_obtenido IS NULL OR puntaje_obtenido >= 0),
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_termino TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (actividad_id, ensayo_id) REFERENCES public.actividades(id, ensayo_id),
  FOREIGN KEY (sesion_acceso_id, participante_id, actividad_id)
    REFERENCES public.sesiones_acceso(id, participante_id, actividad_id) ON DELETE NO ACTION,
  UNIQUE (id, participante_id, actividad_id),
  UNIQUE (id, ensayo_id),
  CHECK ((estado = 'en_curso' AND fecha_termino IS NULL)
      OR (estado <> 'en_curso' AND fecha_termino IS NOT NULL AND fecha_termino >= fecha_inicio))
);

-- Necesaria para comprobar que cada respuesta de ensayo corresponde al mismo ensayo.
ALTER TABLE public.preguntas_ensayo ADD UNIQUE (id, ensayo_id);

CREATE TABLE public.respuestas_estudiante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  actividad_id UUID NOT NULL,
  sesion_acceso_id UUID NOT NULL,
  ejercicio_id UUID REFERENCES public.ejercicios(id) ON DELETE RESTRICT,
  pregunta_ensayo_id UUID REFERENCES public.preguntas_ensayo(id) ON DELETE RESTRICT,
  intento_ensayo_id UUID,
  ensayo_id UUID,
  respuesta_texto TEXT,
  respuesta_json JSONB,
  es_correcta BOOLEAN,
  puntaje_obtenido NUMERIC(6,2) CHECK (puntaje_obtenido IS NULL OR puntaje_obtenido >= 0),
  tiempo_empleado_segundos INTEGER CHECK (tiempo_empleado_segundos IS NULL OR tiempo_empleado_segundos >= 0),
  respondido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (sesion_acceso_id, participante_id, actividad_id)
    REFERENCES public.sesiones_acceso(id, participante_id, actividad_id) ON DELETE NO ACTION,
  FOREIGN KEY (actividad_id, ejercicio_id)
    REFERENCES public.actividades_ejercicios(actividad_id, ejercicio_id) ON DELETE RESTRICT,
  FOREIGN KEY (intento_ensayo_id, participante_id, actividad_id)
    REFERENCES public.intentos_ensayo(id, participante_id, actividad_id) ON DELETE CASCADE,
  FOREIGN KEY (intento_ensayo_id, ensayo_id)
    REFERENCES public.intentos_ensayo(id, ensayo_id) ON DELETE CASCADE,
  FOREIGN KEY (pregunta_ensayo_id, ensayo_id)
    REFERENCES public.preguntas_ensayo(id, ensayo_id) ON DELETE RESTRICT,
  CHECK (num_nonnulls(ejercicio_id, pregunta_ensayo_id) = 1),
  CHECK ((pregunta_ensayo_id IS NULL) = (intento_ensayo_id IS NULL)),
  CHECK ((pregunta_ensayo_id IS NULL) = (ensayo_id IS NULL)),
  CHECK (respuesta_texto IS NOT NULL OR respuesta_json IS NOT NULL),
  UNIQUE (intento_ensayo_id, pregunta_ensayo_id),
  UNIQUE (id, participante_id)
);

CREATE TABLE public.pasos_resolucion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  respuesta_id UUID NOT NULL REFERENCES public.respuestas_estudiante(id) ON DELETE CASCADE,
  numero_paso INTEGER NOT NULL CHECK (numero_paso > 0),
  desarrollo TEXT NOT NULL CHECK (length(btrim(desarrollo)) > 0),
  pistas_utilizadas INTEGER NOT NULL DEFAULT 0 CHECK (pistas_utilizadas >= 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (respuesta_id, numero_paso)
);

CREATE TABLE public.progreso_estudiante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  tema_id UUID NOT NULL REFERENCES public.temas(id) ON DELETE RESTRICT,
  ejercicios_resueltos INTEGER NOT NULL DEFAULT 0 CHECK (ejercicios_resueltos >= 0),
  ejercicios_correctos INTEGER NOT NULL DEFAULT 0 CHECK (ejercicios_correctos >= 0 AND ejercicios_correctos <= ejercicios_resueltos),
  porcentaje_acierto NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (porcentaje_acierto BETWEEN 0 AND 100),
  nivel_actual TEXT NOT NULL DEFAULT 'inicial' CHECK (nivel_actual IN ('inicial', 'intermedio', 'avanzado')),
  ultima_actividad_en TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participante_id, tema_id)
);

CREATE TABLE public.retroalimentacion_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  respuesta_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('correccion', 'explicacion', 'pista', 'motivacion', 'resumen')),
  contenido TEXT NOT NULL,
  modelo TEXT NOT NULL DEFAULT 'gemini',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (respuesta_id, participante_id)
    REFERENCES public.respuestas_estudiante(id, participante_id) ON DELETE CASCADE
);

CREATE TABLE public.sesiones_tutor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  actividad_id UUID NOT NULL,
  sesion_acceso_id UUID NOT NULL,
  tema_id UUID REFERENCES public.temas(id) ON DELETE SET NULL,
  ejercicio_id UUID REFERENCES public.ejercicios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL DEFAULT 'Sesión de tutoría',
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_en TIMESTAMPTZ,
    FOREIGN KEY (sesion_acceso_id, participante_id, actividad_id)
    REFERENCES public.sesiones_acceso(id, participante_id, actividad_id) ON DELETE NO ACTION,
  CHECK (cerrada_en IS NULL OR cerrada_en >= creada_en)
);

CREATE TABLE public.recomendaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES public.temas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('reforzamiento', 'avance', 'remedial', 'simce')),
  mensaje TEXT NOT NULL,
  prioridad SMALLINT NOT NULL DEFAULT 1 CHECK (prioridad BETWEEN 1 AND 5),
  leida BOOLEAN NOT NULL DEFAULT false,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mensajes_tutor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID NOT NULL REFERENCES public.sesiones_tutor(id) ON DELETE CASCADE,
  emisor TEXT NOT NULL CHECK (emisor IN ('alumno', 'tutor')),
  contenido TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'alerta', 'progreso', 'recordatorio')),
  leida BOOLEAN NOT NULL DEFAULT false,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_rol ON public.usuarios(rol_id);
CREATE INDEX idx_grupos_profesor ON public.grupos(profesor_id);
CREATE INDEX idx_grupos_curso ON public.grupos(curso_id);
CREATE INDEX idx_participantes_grupo ON public.participantes(grupo_id);
CREATE INDEX idx_actividades_grupo ON public.actividades(grupo_id);
CREATE INDEX idx_sesiones_participante ON public.sesiones_acceso(participante_id);
CREATE INDEX idx_intentos_participante_fecha ON public.intentos_ensayo(participante_id, fecha_inicio DESC);
CREATE INDEX idx_respuestas_participante_fecha ON public.respuestas_estudiante(participante_id, respondido_en DESC);
CREATE INDEX idx_progreso_participante ON public.progreso_estudiante(participante_id);
CREATE INDEX idx_retroalimentacion_participante ON public.retroalimentacion_ia(participante_id);
CREATE INDEX idx_tutor_participante ON public.sesiones_tutor(participante_id);
CREATE INDEX idx_mensajes_sesion ON public.mensajes_tutor(sesion_id, creado_en);
CREATE INDEX idx_recomendaciones_participante ON public.recomendaciones(participante_id);
CREATE INDEX idx_notificaciones_usuario ON public.notificaciones(usuario_id);
CREATE INDEX idx_temas_curso ON public.temas(curso_id);
CREATE INDEX idx_ejercicios_tema ON public.ejercicios(tema_id);

CREATE FUNCTION public.usuario_tiene_rol(roles_permitidos TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u JOIN public.roles r ON r.id = u.rol_id
    WHERE u.id = (SELECT auth.uid()) AND u.activo AND r.activo
      AND r.nombre = ANY (roles_permitidos)
  );
$$;

CREATE FUNCTION public.puede_ver_grupo(grupo_buscado UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.usuario_tiene_rol(ARRAY['administrador'])
    OR (public.usuario_tiene_rol(ARRAY['profesor']) AND EXISTS (
      SELECT 1 FROM public.grupos g
      WHERE g.id = grupo_buscado AND g.profesor_id = (SELECT auth.uid())
    ));
$$;

CREATE FUNCTION public.puede_ver_participante(participante_buscado UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.participantes p
    WHERE p.id = participante_buscado AND public.puede_ver_grupo(p.grupo_id)
  );
$$;

-- Solo el servidor puede comprobar un token; este RPC no expone hashes.
-- Tambien verifica que la credencial no haya expirado/revocado y que la actividad siga abierta.
CREATE FUNCTION public.validar_sesion_participante(hash_buscado TEXT)
RETURNS TABLE (sesion_id UUID, participante_id UUID, actividad_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT s.id, s.participante_id, s.actividad_id
  FROM public.sesiones_acceso s
  JOIN public.participantes p ON p.id = s.participante_id
  JOIN public.grupos g ON g.id = s.grupo_id
  JOIN public.actividades a ON a.id = s.actividad_id
  JOIN public.credenciales_participante c ON c.participante_id = p.id
  WHERE s.token_hash = hash_buscado AND s.revocada_en IS NULL
    AND s.creada_en <= now() AND s.expira_en > now()
    AND c.revocada_en IS NULL AND c.creada_en <= now() AND c.expira_en > now()
    AND p.activo AND g.activo AND g.conservar_hasta > now() AND a.activa
    AND a.abre_en <= now() AND a.cierra_en > now();
$$;

-- Validacion transversal: pertenencia curricular y propietario docente.
CREATE FUNCTION public.validar_contexto_educativo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE curso_grupo UUID;
BEGIN
  IF TG_TABLE_NAME = 'grupos' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.usuarios u JOIN public.roles r ON r.id = u.rol_id
      WHERE u.id = NEW.profesor_id AND u.activo AND r.activo AND r.nombre = 'profesor'
    ) THEN RAISE EXCEPTION 'El grupo requiere un profesor autorizado y activo'; END IF;
  ELSIF TG_TABLE_NAME = 'actividades' THEN
    SELECT g.curso_id INTO curso_grupo FROM public.grupos g WHERE g.id = NEW.grupo_id;
    IF NEW.tipo = 'practica' AND NOT EXISTS (
      SELECT 1 FROM public.temas t WHERE t.id = NEW.tema_id AND t.curso_id = curso_grupo
    ) THEN RAISE EXCEPTION 'El tema no pertenece al curso del grupo'; END IF;
    IF NEW.tipo = 'ensayo' AND NOT EXISTS (
      SELECT 1 FROM public.ensayos_simce e WHERE e.id = NEW.ensayo_id AND e.curso_id = curso_grupo
    ) THEN RAISE EXCEPTION 'El ensayo no pertenece al curso del grupo'; END IF;
  ELSIF TG_TABLE_NAME = 'actividades_ejercicios' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.actividades a JOIN public.ejercicios e ON e.id = NEW.ejercicio_id
      WHERE a.id = NEW.actividad_id AND a.tipo = 'practica' AND a.tema_id = e.tema_id
    ) THEN RAISE EXCEPTION 'Ejercicio incompatible con la actividad'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_grupo BEFORE INSERT OR UPDATE ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.validar_contexto_educativo();
CREATE TRIGGER validar_actividad BEFORE INSERT OR UPDATE ON public.actividades
  FOR EACH ROW EXECUTE FUNCTION public.validar_contexto_educativo();
CREATE TRIGGER validar_ejercicio_actividad BEFORE INSERT OR UPDATE ON public.actividades_ejercicios
  FOR EACH ROW EXECUTE FUNCTION public.validar_contexto_educativo();

CREATE FUNCTION public.revocar_sesiones_credencial()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.secreto_hash IS DISTINCT FROM OLD.secreto_hash
     OR NEW.revocada_en IS DISTINCT FROM OLD.revocada_en
     OR NEW.expira_en IS DISTINCT FROM OLD.expira_en THEN
    UPDATE public.sesiones_acceso SET revocada_en = now()
    WHERE participante_id = NEW.participante_id AND revocada_en IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER revocar_sesiones_credencial AFTER UPDATE ON public.credenciales_participante
  FOR EACH ROW EXECUTE FUNCTION public.revocar_sesiones_credencial();

-- Evita registrar nuevas respuestas con sesiones vencidas o actividades cerradas.
-- El servidor aun debe verificar la posesion del token y vincularlo a la operacion.
CREATE FUNCTION public.validar_escritura_participante()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sesion_buscada UUID; hash_sesion TEXT;
BEGIN
  IF TG_TABLE_NAME = 'pasos_resolucion' THEN
    SELECT r.sesion_acceso_id INTO sesion_buscada
      FROM public.respuestas_estudiante r WHERE r.id = NEW.respuesta_id;
  ELSIF TG_TABLE_NAME = 'mensajes_tutor' THEN
    SELECT s.sesion_acceso_id INTO sesion_buscada
      FROM public.sesiones_tutor s WHERE s.id = NEW.sesion_id;
  ELSE
    sesion_buscada := NEW.sesion_acceso_id;
  END IF;
  SELECT s.token_hash INTO hash_sesion FROM public.sesiones_acceso s WHERE s.id = sesion_buscada;
  IF NOT EXISTS (SELECT 1 FROM public.validar_sesion_participante(hash_sesion)) THEN
    RAISE EXCEPTION 'Sesion vencida, revocada o actividad no disponible';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_intento_activo BEFORE INSERT ON public.intentos_ensayo
  FOR EACH ROW EXECUTE FUNCTION public.validar_escritura_participante();
CREATE TRIGGER validar_respuesta_activa BEFORE INSERT ON public.respuestas_estudiante
  FOR EACH ROW EXECUTE FUNCTION public.validar_escritura_participante();
CREATE TRIGGER validar_tutoria_activa BEFORE INSERT ON public.sesiones_tutor
  FOR EACH ROW EXECUTE FUNCTION public.validar_escritura_participante();
CREATE TRIGGER validar_paso_activo BEFORE INSERT ON public.pasos_resolucion
  FOR EACH ROW EXECUTE FUNCTION public.validar_escritura_participante();
CREATE TRIGGER validar_mensaje_activo BEFORE INSERT ON public.mensajes_tutor
  FOR EACH ROW EXECUTE FUNCTION public.validar_escritura_participante();

REVOKE ALL ON FUNCTION public.usuario_tiene_rol(TEXT[]),
  public.puede_ver_grupo(UUID), public.puede_ver_participante(UUID),
  public.validar_sesion_participante(TEXT), public.validar_contexto_educativo(),
  public.revocar_sesiones_credencial(), public.validar_escritura_participante()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_rol(TEXT[]),
  public.puede_ver_grupo(UUID), public.puede_ver_participante(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_sesion_participante(TEXT) TO service_role;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soluciones_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ensayos_simce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preguntas_ensayo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soluciones_preguntas_ensayo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credenciales_participante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_ensayo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuestas_estudiante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasos_resolucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progreso_estudiante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retroalimentacion_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recomendaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.roles, public.usuarios, public.cursos, public.temas, public.ejercicios, public.soluciones_ejercicios, public.ensayos_simce, public.preguntas_ensayo, public.soluciones_preguntas_ensayo, public.grupos, public.participantes, public.credenciales_participante, public.actividades, public.actividades_ejercicios, public.sesiones_acceso, public.intentos_ensayo, public.respuestas_estudiante, public.pasos_resolucion, public.progreso_estudiante, public.retroalimentacion_ia, public.sesiones_tutor, public.recomendaciones, public.mensajes_tutor, public.notificaciones
FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON TABLE
  public.roles, public.usuarios, public.cursos, public.temas, public.ejercicios, public.soluciones_ejercicios, public.ensayos_simce, public.preguntas_ensayo, public.soluciones_preguntas_ensayo, public.grupos, public.participantes, public.credenciales_participante, public.actividades, public.actividades_ejercicios, public.sesiones_acceso, public.intentos_ensayo, public.respuestas_estudiante, public.pasos_resolucion, public.progreso_estudiante, public.retroalimentacion_ia, public.sesiones_tutor, public.recomendaciones, public.mensajes_tutor, public.notificaciones
TO service_role;

GRANT SELECT ON TABLE
  public.roles, public.usuarios, public.cursos, public.temas, public.ejercicios, public.ensayos_simce, public.preguntas_ensayo, public.grupos, public.participantes, public.actividades, public.actividades_ejercicios, public.intentos_ensayo, public.respuestas_estudiante, public.pasos_resolucion, public.progreso_estudiante, public.retroalimentacion_ia, public.sesiones_tutor, public.recomendaciones, public.mensajes_tutor, public.notificaciones
TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE
  public.cursos, public.temas, public.ejercicios, public.ensayos_simce, public.preguntas_ensayo
TO authenticated;
GRANT INSERT, DELETE ON public.grupos, public.participantes, public.actividades,
  public.actividades_ejercicios TO authenticated;
GRANT UPDATE (nombre, activo, conservar_hasta) ON public.grupos TO authenticated;
GRANT UPDATE (activo) ON public.participantes TO authenticated;
GRANT UPDATE (titulo, abre_en, cierra_en, activa) ON public.actividades TO authenticated;
GRANT UPDATE (orden) ON public.actividades_ejercicios TO authenticated;
GRANT UPDATE (leida) ON public.notificaciones TO authenticated;

CREATE POLICY roles_docentes_lectura ON public.roles
  FOR SELECT TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
CREATE POLICY usuarios_cuenta_propia ON public.usuarios
  FOR SELECT TO authenticated
  USING ((id = (SELECT auth.uid()) AND public.usuario_tiene_rol(ARRAY['profesor', 'administrador'])) OR public.usuario_tiene_rol(ARRAY['administrador']));
CREATE POLICY cursos_lectura_docente ON public.cursos
  FOR SELECT TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
CREATE POLICY cursos_gestion_administrativa ON public.cursos
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['administrador']));
CREATE POLICY temas_lectura_docente ON public.temas
  FOR SELECT TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
CREATE POLICY temas_gestion_administrativa ON public.temas
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['administrador']));
CREATE POLICY ejercicios_lectura_docente ON public.ejercicios
  FOR SELECT TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
CREATE POLICY ejercicios_gestion_administrativa ON public.ejercicios
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['administrador']));
CREATE POLICY ensayos_simce_lectura_docente ON public.ensayos_simce
  FOR SELECT TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
CREATE POLICY ensayos_simce_gestion_administrativa ON public.ensayos_simce
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['administrador']));
CREATE POLICY preguntas_ensayo_lectura_docente ON public.preguntas_ensayo
  FOR SELECT TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
CREATE POLICY preguntas_ensayo_gestion_administrativa ON public.preguntas_ensayo
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['administrador']));
CREATE POLICY grupos_propios ON public.grupos
  FOR ALL TO authenticated
  USING (public.puede_ver_grupo(id))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['administrador']) OR (profesor_id = (SELECT auth.uid()) AND public.usuario_tiene_rol(ARRAY['profesor'])));
CREATE POLICY participantes_grupo_propio ON public.participantes
  FOR ALL TO authenticated
  USING (public.puede_ver_grupo(grupo_id))
  WITH CHECK (public.puede_ver_grupo(grupo_id));
CREATE POLICY actividades_grupo_propio ON public.actividades
  FOR ALL TO authenticated
  USING (public.puede_ver_grupo(grupo_id))
  WITH CHECK (public.puede_ver_grupo(grupo_id));
CREATE POLICY actividad_ejercicios_grupo_propio ON public.actividades_ejercicios
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.actividades a WHERE a.id = actividad_id AND public.puede_ver_grupo(a.grupo_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.actividades a WHERE a.id = actividad_id AND public.puede_ver_grupo(a.grupo_id)));
CREATE POLICY intentos_ensayo_lectura_docente ON public.intentos_ensayo
  FOR SELECT TO authenticated
  USING (public.puede_ver_participante(participante_id));
CREATE POLICY respuestas_estudiante_lectura_docente ON public.respuestas_estudiante
  FOR SELECT TO authenticated
  USING (public.puede_ver_participante(participante_id));
CREATE POLICY progreso_estudiante_lectura_docente ON public.progreso_estudiante
  FOR SELECT TO authenticated
  USING (public.puede_ver_participante(participante_id));
CREATE POLICY retroalimentacion_ia_lectura_docente ON public.retroalimentacion_ia
  FOR SELECT TO authenticated
  USING (public.puede_ver_participante(participante_id));
CREATE POLICY sesiones_tutor_lectura_docente ON public.sesiones_tutor
  FOR SELECT TO authenticated
  USING (public.puede_ver_participante(participante_id));
CREATE POLICY recomendaciones_lectura_docente ON public.recomendaciones
  FOR SELECT TO authenticated
  USING (public.puede_ver_participante(participante_id));
CREATE POLICY pasos_lectura_docente ON public.pasos_resolucion
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.respuestas_estudiante r WHERE r.id = respuesta_id AND public.puede_ver_participante(r.participante_id)));
CREATE POLICY mensajes_lectura_docente ON public.mensajes_tutor
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sesiones_tutor s WHERE s.id = sesion_id AND public.puede_ver_participante(s.participante_id)));
CREATE POLICY notificaciones_propias_lectura ON public.notificaciones
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()) AND public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
CREATE POLICY notificaciones_propias_marcar ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()) AND public.usuario_tiene_rol(ARRAY['profesor', 'administrador']))
  WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));

-- anon no tiene permisos; los participantes usan rutas de servidor y tokens propios.
-- La clave service_role/secret permanece en servidor y omite RLS:
-- cada ruta debe validar sesion, actividad, pertenencia y el tipo de operacion.
COMMIT;

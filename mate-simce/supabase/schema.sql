-- Esquema inicial para un proyecto Supabase vacio; no migra tablas antiguas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE CHECK (nombre IN ('alumno', 'profesor', 'administrador')),
  descripcion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nivel TEXT NOT NULL CHECK (nivel IN ('1_medio', '2_medio', '3_medio', '4_medio')),
  descripcion TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nivel, nombre)
);

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  curso_actual_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL DEFAULT 'Estudiante',
  apellido TEXT NOT NULL DEFAULT '',
  correo TEXT UNIQUE,
  fecha_nacimiento DATE,
  establecimiento TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.temas (
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

CREATE TABLE IF NOT EXISTS public.ejercicios (
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

CREATE TABLE IF NOT EXISTS public.soluciones_ejercicios (
  ejercicio_id UUID PRIMARY KEY REFERENCES public.ejercicios(id) ON DELETE CASCADE,
  respuesta_correcta JSONB NOT NULL,
  desarrollo_paso_a_paso TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ensayos_simce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  tiempo_limite_minutos INTEGER CHECK (tiempo_limite_minutos IS NULL OR tiempo_limite_minutos > 0),
  publicado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.preguntas_ensayo (
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

CREATE TABLE IF NOT EXISTS public.soluciones_preguntas_ensayo (
  pregunta_id UUID PRIMARY KEY REFERENCES public.preguntas_ensayo(id) ON DELETE CASCADE,
  respuesta_correcta JSONB NOT NULL,
  desarrollo_paso_a_paso TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intentos_ensayo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  ensayo_id UUID NOT NULL REFERENCES public.ensayos_simce(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'completado', 'abandonado')),
  puntaje_obtenido NUMERIC(8,2) CHECK (puntaje_obtenido IS NULL OR puntaje_obtenido >= 0),
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_termino TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((estado = 'en_curso' AND fecha_termino IS NULL) OR (estado <> 'en_curso' AND fecha_termino IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.respuestas_estudiante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  ejercicio_id UUID REFERENCES public.ejercicios(id) ON DELETE RESTRICT,
  pregunta_ensayo_id UUID REFERENCES public.preguntas_ensayo(id) ON DELETE RESTRICT,
  intento_ensayo_id UUID REFERENCES public.intentos_ensayo(id) ON DELETE CASCADE,
  respuesta_texto TEXT,
  respuesta_json JSONB,
  es_correcta BOOLEAN,
  puntaje_obtenido NUMERIC(6,2) CHECK (puntaje_obtenido IS NULL OR puntaje_obtenido >= 0),
  tiempo_empleado_segundos INTEGER CHECK (tiempo_empleado_segundos IS NULL OR tiempo_empleado_segundos >= 0),
  respondido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(ejercicio_id, pregunta_ensayo_id) = 1),
  CHECK ((pregunta_ensayo_id IS NULL) = (intento_ensayo_id IS NULL)),
  CHECK (respuesta_texto IS NOT NULL OR respuesta_json IS NOT NULL),
  UNIQUE (intento_ensayo_id, pregunta_ensayo_id)
);

CREATE TABLE IF NOT EXISTS public.progreso_estudiante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tema_id UUID NOT NULL REFERENCES public.temas(id) ON DELETE RESTRICT,
  ejercicios_resueltos INTEGER NOT NULL DEFAULT 0 CHECK (ejercicios_resueltos >= 0),
  ejercicios_correctos INTEGER NOT NULL DEFAULT 0 CHECK (ejercicios_correctos >= 0 AND ejercicios_correctos <= ejercicios_resueltos),
  porcentaje_acierto NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (porcentaje_acierto BETWEEN 0 AND 100),
  nivel_actual TEXT NOT NULL DEFAULT 'inicial' CHECK (nivel_actual IN ('inicial', 'intermedio', 'avanzado')),
  ultima_actividad_en TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tema_id)
);

CREATE TABLE IF NOT EXISTS public.retroalimentacion_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  respuesta_id UUID REFERENCES public.respuestas_estudiante(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('correccion', 'explicacion', 'pista', 'motivacion', 'resumen')),
  contenido TEXT NOT NULL,
  modelo TEXT NOT NULL DEFAULT 'gemini',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sesiones_tutor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES public.temas(id) ON DELETE SET NULL,
  ejercicio_id UUID REFERENCES public.ejercicios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL DEFAULT 'Sesión de tutoría',
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_en TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.mensajes_tutor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID NOT NULL REFERENCES public.sesiones_tutor(id) ON DELETE CASCADE,
  emisor TEXT NOT NULL CHECK (emisor IN ('alumno', 'tutor')),
  contenido TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recomendaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES public.temas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('reforzamiento', 'avance', 'remedial', 'simce')),
  mensaje TEXT NOT NULL,
  prioridad SMALLINT NOT NULL DEFAULT 1 CHECK (prioridad BETWEEN 1 AND 5),
  leida BOOLEAN NOT NULL DEFAULT false,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'alerta', 'progreso', 'recordatorio')),
  leida BOOLEAN NOT NULL DEFAULT false,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON public.usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_curso_actual_id ON public.usuarios(curso_actual_id);
CREATE INDEX IF NOT EXISTS idx_temas_curso_categoria ON public.temas(curso_id, categoria, orden);
CREATE INDEX IF NOT EXISTS idx_ejercicios_tema_publicado ON public.ejercicios(tema_id, publicado);
CREATE INDEX IF NOT EXISTS idx_preguntas_ensayo_orden ON public.preguntas_ensayo(ensayo_id, numero_pregunta);
CREATE INDEX IF NOT EXISTS idx_intentos_usuario_fecha ON public.intentos_ensayo(usuario_id, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_respuestas_usuario_fecha ON public.respuestas_estudiante(usuario_id, respondido_en DESC);
CREATE INDEX IF NOT EXISTS idx_respuestas_intento ON public.respuestas_estudiante(intento_ensayo_id);
CREATE INDEX IF NOT EXISTS idx_progreso_usuario ON public.progreso_estudiante(usuario_id);
CREATE INDEX IF NOT EXISTS idx_retroalimentacion_usuario_fecha ON public.retroalimentacion_ia(usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_fecha ON public.sesiones_tutor(usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_sesion_fecha ON public.mensajes_tutor(sesion_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_usuario_fecha ON public.recomendaciones(usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha ON public.notificaciones(usuario_id, creada_en DESC);

CREATE OR REPLACE FUNCTION public.usuario_tiene_rol(roles_permitidos TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    JOIN public.roles AS rol ON rol.id = usuario.rol_id
    WHERE usuario.id = (SELECT auth.uid())
      AND usuario.activo
      AND rol.activo
      AND rol.nombre = ANY (roles_permitidos)
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_tiene_rol(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_rol(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.crear_perfil_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usuarios (id, rol_id, nombre, apellido, correo)
  SELECT
    NEW.id,
    rol.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'nombre', ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'Estudiante'),
    COALESCE(NEW.raw_user_meta_data ->> 'apellido', ''),
    NEW.email
  FROM public.roles AS rol
  WHERE rol.nombre = 'alumno' AND rol.activo
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_perfil_usuario() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS crear_perfil_al_registrar ON auth.users;
CREATE TRIGGER crear_perfil_al_registrar
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_usuario();

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soluciones_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ensayos_simce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preguntas_ensayo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soluciones_preguntas_ensayo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_ensayo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuestas_estudiante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progreso_estudiante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retroalimentacion_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recomendaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.roles, public.cursos, public.usuarios, public.temas, public.ejercicios,
  public.soluciones_ejercicios, public.ensayos_simce, public.preguntas_ensayo,
  public.soluciones_preguntas_ensayo, public.intentos_ensayo,
  public.respuestas_estudiante, public.progreso_estudiante,
  public.retroalimentacion_ia, public.sesiones_tutor, public.mensajes_tutor,
  public.recomendaciones, public.notificaciones
FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.roles, public.cursos, public.usuarios, public.temas,
  public.ensayos_simce, public.intentos_ensayo, public.respuestas_estudiante,
  public.progreso_estudiante, public.retroalimentacion_ia, public.sesiones_tutor,
  public.mensajes_tutor, public.recomendaciones, public.notificaciones
TO authenticated;
GRANT SELECT (id, tema_id, titulo, enunciado, instrucciones, tipo_respuesta, opciones,
  dificultad, nivel_desafio, tiempo_estimado_segundos, imagen_url, publicado, creado_en)
ON public.ejercicios TO authenticated;
GRANT SELECT (id, ensayo_id, tema_id, numero_pregunta, enunciado, tipo_respuesta, opciones,
  puntaje_maximo, creado_en)
ON public.preguntas_ensayo TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cursos, public.temas, public.ejercicios,
  public.ensayos_simce, public.preguntas_ensayo TO authenticated;
GRANT UPDATE (nombre, apellido, fecha_nacimiento, curso_actual_id, establecimiento)
ON public.usuarios TO authenticated;
GRANT INSERT (usuario_id, ensayo_id) ON public.intentos_ensayo TO authenticated;
GRANT INSERT (usuario_id, ejercicio_id, pregunta_ensayo_id, intento_ensayo_id,
  respuesta_texto, respuesta_json, tiempo_empleado_segundos)
ON public.respuestas_estudiante TO authenticated;
GRANT INSERT (usuario_id, tema_id, ejercicio_id, titulo) ON public.sesiones_tutor TO authenticated;
GRANT INSERT (sesion_id, emisor, contenido) ON public.mensajes_tutor TO authenticated;
GRANT UPDATE (leida) ON public.recomendaciones, public.notificaciones TO authenticated;
GRANT ALL ON public.soluciones_ejercicios, public.soluciones_preguntas_ensayo TO service_role;

DROP POLICY IF EXISTS roles_lectura_autenticada ON public.roles;
CREATE POLICY roles_lectura_autenticada ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cursos_lectura ON public.cursos;
CREATE POLICY cursos_lectura ON public.cursos
  FOR SELECT TO authenticated
  USING (activo OR public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
DROP POLICY IF EXISTS cursos_gestion_docente ON public.cursos;
CREATE POLICY cursos_gestion_docente ON public.cursos
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));

DROP POLICY IF EXISTS usuarios_lectura_propia ON public.usuarios;
CREATE POLICY usuarios_lectura_propia ON public.usuarios
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.usuario_tiene_rol(ARRAY['administrador']));
DROP POLICY IF EXISTS usuarios_actualizacion_propia ON public.usuarios;
CREATE POLICY usuarios_actualizacion_propia ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS temas_lectura ON public.temas;
CREATE POLICY temas_lectura ON public.temas
  FOR SELECT TO authenticated
  USING (
    (activo AND EXISTS (SELECT 1 FROM public.cursos AS curso WHERE curso.id = public.temas.curso_id AND curso.activo))
    OR public.usuario_tiene_rol(ARRAY['profesor', 'administrador'])
  );
DROP POLICY IF EXISTS temas_gestion_docente ON public.temas;
CREATE POLICY temas_gestion_docente ON public.temas
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));

DROP POLICY IF EXISTS ejercicios_lectura_publicada ON public.ejercicios;
CREATE POLICY ejercicios_lectura_publicada ON public.ejercicios
  FOR SELECT TO authenticated
  USING (
    (publicado AND EXISTS (SELECT 1 FROM public.temas AS tema WHERE tema.id = public.ejercicios.tema_id AND tema.activo))
    OR public.usuario_tiene_rol(ARRAY['profesor', 'administrador'])
  );
DROP POLICY IF EXISTS ejercicios_gestion_docente ON public.ejercicios;
CREATE POLICY ejercicios_gestion_docente ON public.ejercicios
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));

DROP POLICY IF EXISTS ensayos_lectura_publicados ON public.ensayos_simce;
CREATE POLICY ensayos_lectura_publicados ON public.ensayos_simce
  FOR SELECT TO authenticated
  USING (publicado OR public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));
DROP POLICY IF EXISTS ensayos_gestion_docente ON public.ensayos_simce;
CREATE POLICY ensayos_gestion_docente ON public.ensayos_simce
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));

DROP POLICY IF EXISTS preguntas_lectura_publicadas ON public.preguntas_ensayo;
CREATE POLICY preguntas_lectura_publicadas ON public.preguntas_ensayo
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ensayos_simce AS ensayo WHERE ensayo.id = public.preguntas_ensayo.ensayo_id AND ensayo.publicado)
    OR public.usuario_tiene_rol(ARRAY['profesor', 'administrador'])
  );
DROP POLICY IF EXISTS preguntas_gestion_docente ON public.preguntas_ensayo;
CREATE POLICY preguntas_gestion_docente ON public.preguntas_ensayo
  FOR ALL TO authenticated
  USING (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']))
  WITH CHECK (public.usuario_tiene_rol(ARRAY['profesor', 'administrador']));

DROP POLICY IF EXISTS intentos_lectura_propia ON public.intentos_ensayo;
CREATE POLICY intentos_lectura_propia ON public.intentos_ensayo
  FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS intentos_creacion_propia ON public.intentos_ensayo;
CREATE POLICY intentos_creacion_propia ON public.intentos_ensayo
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND estado = 'en_curso'
    AND EXISTS (SELECT 1 FROM public.ensayos_simce AS ensayo WHERE ensayo.id = public.intentos_ensayo.ensayo_id AND ensayo.publicado)
  );

DROP POLICY IF EXISTS respuestas_lectura_propia ON public.respuestas_estudiante;
CREATE POLICY respuestas_lectura_propia ON public.respuestas_estudiante
  FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS respuestas_creacion_propia ON public.respuestas_estudiante;
CREATE POLICY respuestas_creacion_propia ON public.respuestas_estudiante
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND (
      (ejercicio_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ejercicios AS ejercicio
        WHERE ejercicio.id = public.respuestas_estudiante.ejercicio_id AND ejercicio.publicado
      ))
      OR
      (pregunta_ensayo_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.preguntas_ensayo AS pregunta
        JOIN public.ensayos_simce AS ensayo ON ensayo.id = pregunta.ensayo_id
        JOIN public.intentos_ensayo AS intento ON intento.id = public.respuestas_estudiante.intento_ensayo_id
        WHERE pregunta.id = public.respuestas_estudiante.pregunta_ensayo_id
          AND ensayo.id = intento.ensayo_id
          AND ensayo.publicado
          AND intento.usuario_id = (SELECT auth.uid())
          AND intento.estado = 'en_curso'
      ))
    )
  );

DROP POLICY IF EXISTS progreso_lectura_propia ON public.progreso_estudiante;
CREATE POLICY progreso_lectura_propia ON public.progreso_estudiante
  FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS retroalimentacion_lectura_propia ON public.retroalimentacion_ia;
CREATE POLICY retroalimentacion_lectura_propia ON public.retroalimentacion_ia
  FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS sesiones_gestion_propia ON public.sesiones_tutor;
CREATE POLICY sesiones_gestion_propia ON public.sesiones_tutor
  FOR ALL TO authenticated
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS mensajes_lectura_propia ON public.mensajes_tutor;
CREATE POLICY mensajes_lectura_propia ON public.mensajes_tutor
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sesiones_tutor AS sesion WHERE sesion.id = sesion_id AND sesion.usuario_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS mensajes_alumno_escribe ON public.mensajes_tutor;
CREATE POLICY mensajes_alumno_escribe ON public.mensajes_tutor
  FOR INSERT TO authenticated
  WITH CHECK (
    emisor = 'alumno'
    AND EXISTS (SELECT 1 FROM public.sesiones_tutor AS sesion WHERE sesion.id = sesion_id AND sesion.usuario_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS recomendaciones_lectura_propia ON public.recomendaciones;
CREATE POLICY recomendaciones_lectura_propia ON public.recomendaciones
  FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS recomendaciones_actualizacion_propia ON public.recomendaciones;
CREATE POLICY recomendaciones_actualizacion_propia ON public.recomendaciones
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS notificaciones_lectura_propia ON public.notificaciones;
CREATE POLICY notificaciones_lectura_propia ON public.notificaciones
  FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS notificaciones_actualizacion_propia ON public.notificaciones;
CREATE POLICY notificaciones_actualizacion_propia ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (usuario_id = (SELECT auth.uid()));

COMMIT;

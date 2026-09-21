CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  rol_id UUID NOT NULL REFERENCES roles(id),
  fecha_nacimiento DATE,
  curso VARCHAR(50),
  grado VARCHAR(20),
  institucion VARCHAR(255),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  nivel VARCHAR(50) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS temas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  categoria VARCHAR(60) NOT NULL CHECK (
    categoria IN (
      'numeros',
      'geometria',
      'algebra_y_funciones',
      'estadistica_y_probabilidades',
      'simce_ensayo'
    )
  ),
  descripcion TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ejercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id UUID NOT NULL REFERENCES temas(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  tipo_ejercicio VARCHAR(40) NOT NULL CHECK (
    tipo_ejercicio IN ('ejercicio', 'ensayo', 'pregunta_abierta', 'simce')
  ),
  enunciado TEXT NOT NULL,
  instrucciones TEXT,
  opciones JSONB,
  respuesta_correcta TEXT,
  solucion_paso_a_paso TEXT,
  dificultad VARCHAR(30) NOT NULL DEFAULT 'media' CHECK (
    dificultad IN ('facil', 'media', 'dificil')
  ),
  nivel VARCHAR(30) NOT NULL DEFAULT 'basico' CHECK (
    nivel IN ('basico', 'intermedio', 'avanzado')
  ),
  tiempo_estimado INTEGER,
  imagen_url TEXT,
  publicado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ensayos_simce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  nivel VARCHAR(30) NOT NULL DEFAULT 'preparatoria' CHECK (
    nivel IN ('basico', 'intermedio', 'preparatoria', 'simce')
  ),
  tiempo_limite_min INTEGER,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preguntas_ensayo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ensayo_id UUID NOT NULL REFERENCES ensayos_simce(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES temas(id) ON DELETE SET NULL,
  numero_pregunta INTEGER NOT NULL,
  enunciado TEXT NOT NULL,
  tipo_pregunta VARCHAR(40) NOT NULL CHECK (
    tipo_pregunta IN ('opcion_multiple', 'respuesta_abierta', 'calculo', 'seleccion')
  ),
  opciones JSONB,
  respuesta_correcta TEXT,
  puntos NUMERIC(5,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ensayo_id, numero_pregunta)
);

CREATE TABLE IF NOT EXISTS respuestas_estudiante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ejercicio_id UUID REFERENCES ejercicios(id) ON DELETE SET NULL,
  ensayo_id UUID REFERENCES ensayos_simce(id) ON DELETE SET NULL,
  pregunta_id UUID REFERENCES preguntas_ensayo(id) ON DELETE SET NULL,
  respuesta TEXT,
  respuesta_json JSONB,
  es_correcta BOOLEAN,
  puntaje NUMERIC(5,2) DEFAULT 0,
  tiempo_segundos INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progreso_estudiante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tema_id UUID NOT NULL REFERENCES temas(id) ON DELETE CASCADE,
  ejercicios_resueltos INTEGER NOT NULL DEFAULT 0,
  ejercicios_correctos INTEGER NOT NULL DEFAULT 0,
  ensayos_completados INTEGER NOT NULL DEFAULT 0,
  porcentaje_acierto NUMERIC(5,2) NOT NULL DEFAULT 0,
  nivel_actual VARCHAR(30) NOT NULL DEFAULT 'basico' CHECK (
    nivel_actual IN ('basico', 'intermedio', 'avanzado')
  ),
  ultima_fecha TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tema_id)
);

CREATE TABLE IF NOT EXISTS retroalimentacion_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ejercicio_id UUID REFERENCES ejercicios(id) ON DELETE SET NULL,
  ensayo_id UUID REFERENCES ensayos_simce(id) ON DELETE SET NULL,
  tema_id UUID REFERENCES temas(id) ON DELETE SET NULL,
  tipo_feedback VARCHAR(50) NOT NULL CHECK (
    tipo_feedback IN ('correccion', 'explicacion', 'pista', 'motivacion', 'resumen')
  ),
  contenido TEXT NOT NULL,
  puntaje_confianza NUMERIC(5,2),
  modelo_ia VARCHAR(100) NOT NULL DEFAULT 'gemini',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesiones_tutor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES temas(id) ON DELETE SET NULL,
  ejercicio_id UUID REFERENCES ejercicios(id) ON DELETE SET NULL,
  mensaje_usuario TEXT NOT NULL,
  mensaje_tutor TEXT NOT NULL,
  contexto VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recomendaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES temas(id) ON DELETE SET NULL,
  tipo VARCHAR(50) NOT NULL CHECK (
    tipo IN ('reforzamiento', 'avance', 'remedial', 'simce')
  ),
  mensaje TEXT NOT NULL,
  prioridad INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(150) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT false,
  tipo VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (
    tipo IN ('info', 'alerta', 'progreso', 'ia', 'recordatorio')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_temas_curso_id ON temas(curso_id);
CREATE INDEX IF NOT EXISTS idx_ejercicios_tema_id ON ejercicios(tema_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_usuario_id ON respuestas_estudiante(usuario_id);
CREATE INDEX IF NOT EXISTS idx_progreso_usuario_id ON progreso_estudiante(usuario_id);
CREATE INDEX IF NOT EXISTS idx_retroalimentacion_usuario_id ON retroalimentacion_ia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_id ON sesiones_tutor(usuario_id);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_usuario_id ON recomendaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones(usuario_id);

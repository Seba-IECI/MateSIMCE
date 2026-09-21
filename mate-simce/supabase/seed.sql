INSERT INTO roles (nombre, descripcion)
VALUES
  ('alumno', 'Estudiante que resuelve ejercicios y revisa su progreso.'),
  ('profesor', 'Docente que gestiona contenido, cursos y seguimiento.'),
  ('administrador', 'Usuario con permisos para administrar la plataforma y usuarios.')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO cursos (nombre, nivel, descripcion)
VALUES
  ('Matemática preparación SIMCE', 'media', 'Contenido disciplinar para reforzar aprendizajes de matematicas para SIMCE.')
ON CONFLICT DO NOTHING;
